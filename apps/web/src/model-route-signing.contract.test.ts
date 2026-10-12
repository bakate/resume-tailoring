import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { groupedResumeDocument, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'

import { createDemoAccessCookie } from './demo-access/demo-access-session'
import { Route as JobPostingExtractionRoute } from './routes/api.explainable-job-posting-extraction'
import { Route as MatchEvidenceRoute } from './routes/api.explainable-match-evidence'
import { Route as ResumeClaimValidationRoute } from './routes/api.resume-claim-validation'
import { Route as ResumeClaimWritingRoute } from './routes/api.resume-claim-writing'
import { Route as ResumeDocumentCoherenceRoute } from './routes/api.resume-document-coherence'
import { Route as ResumeSectionValidationRoute } from './routes/api.resume-section-validation'
import { Route as ResumeSectionWritingRoute } from './routes/api.resume-section-writing'
import { Route as SourceProfileExtractionRoute } from './routes/api.structured-source-profile-extraction'

const environment = {
  DEMO_ACCESS_MODE: 'enforced',
  DEMO_ORIGIN_SECRET: 'an-origin-secret-with-at-least-32-characters',
  DEMO_PUBLIC_HOSTNAME: 'resume-studio.example.workers.dev',
  DEMO_SESSION_SECRET: 'a-session-secret-with-at-least-32-characters',
  OPENAI_API_KEY: 'sk-operator-key-that-signs-every-model-request',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  TURNSTILE_SITE_KEY: 'turnstile-site-key',
} as const
const proposedClaim = { segments: [{ text: 'Used React', factIds: ['source-fact-react'] }] }
const verifiedFacts = [{ id: 'source-fact-react', kind: 'skill', value: 'Used React' }]
/** Every model-backed route, each with a valid body, so only the provider's answer decides how it fails. */
const modelRoutes = [
  { name: 'Job Posting extraction', route: JobPostingExtractionRoute, body: { jobPostingContent: 'Senior engineer' } },
  { name: 'Source Profile extraction', route: SourceProfileExtractionRoute,
    body: { professionalContent: 'Engineer at Example' } },
  { name: 'Match Evidence', route: MatchEvidenceRoute, body: {
    candidateFacts: [{ id: 'source-fact-1', kind: 'skill', value: 'React' }],
    requirements: structuredResumeJobMatch.requirements.map(({ capability, id, importance, importanceRationale, sourceExcerpt, value }) =>
      ({ capability, id, importance, importanceRationale, sourceExcerpt, value })),
  } },
  { name: 'Resume Claim validation', route: ResumeClaimValidationRoute,
    body: { claim: { id: 'resume-claim-react', ...proposedClaim }, verifiedFacts } },
  { name: 'Resume Claim writing', route: ResumeClaimWritingRoute, body: { operation: 'reformulate', locale: 'en', verifiedFacts,
    evidence: [{ requirementId: 'job-requirement-react', factIds: ['source-fact-react'] }],
    requirements: [{ id: 'job-requirement-react', classification: 'required', value: 'React' }],
    claim: proposedClaim, feedback: [{ code: 'unsupported-meaning', segmentIndex: 0 }] } },
  { name: 'Resume Section writing', route: ResumeSectionWritingRoute, body: { section: { key: 'skills', kind: 'skills' },
    locale: 'en', purpose: 'tailored', targetRole: 'Frontend Engineer', jobRequirements: ['React'], relevantFactIds: [],
    rejectedFields: [], previousContent: null,
    candidateFacts: structuredResumeSource.candidateFacts.filter(({ path }) => path.startsWith('skills.')) } },
  { name: 'Resume Section validation', route: ResumeSectionValidationRoute, body: { section: { key: 'education', kind: 'education' },
    locale: 'en', purpose: 'tailored',
    fields: [{ id: 'degree', text: 'Computer Science degree', factIds: ['source-fact-education-0-qualification-0'] }],
    candidateFacts: structuredResumeSource.candidateFacts.filter(({ path }) => path.startsWith('education.')) } },
  { name: 'Resume document coherence', route: ResumeDocumentCoherenceRoute, body: { document: {
    purpose: groupedResumeDocument.purpose, locale: groupedResumeDocument.locale, targetRole: groupedResumeDocument.targetRole,
    valueProposition: groupedResumeDocument.valueProposition, experiences: groupedResumeDocument.experiences,
    sections: groupedResumeDocument.sections,
  } } },
] as const

describe('Signing model-backed routes', () => {
  beforeEach(() => {
    Object.entries(environment).forEach(([name, value]) => vi.stubEnv(name, value))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(modelRoutes)('$name signs a call with the operator key', async ({ body, route }) => {
    const provider = stubProvider(() => Response.json({ error: { code: 'server_error' } }, { status: 500 }))

    await postTo(route, createRequest({ body }))

    expect(provider.authorizations).toEqual([`Bearer ${environment.OPENAI_API_KEY}`])
  })

  it.each(modelRoutes)('$name signs a call that carries a Candidate API Key header with the operator key, as without it',
    async ({ body, route }) => {
      const provider = stubProvider(() => Response.json({ error: { code: 'server_error' } }, { status: 500 }))
      const withoutHeader = await postTo(route, createRequest({ body }))

      const withHeader = await postTo(route, createRequest({ body, candidateApiKeyHeader: 'sk-proj-LeftBehind0123456789abcdef' }))

      expect(withHeader.status).toBe(withoutHeader.status)
      await expect(withHeader.json()).resolves.toEqual(await withoutHeader.json())
      expect(provider.authorizations).toEqual([`Bearer ${environment.OPENAI_API_KEY}`, `Bearer ${environment.OPENAI_API_KEY}`])
    })

  it('reads exhausted operator credit as an unavailable service, not a rate limit', async () => {
    stubProvider(() => Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }))

    const response = await postTo(JobPostingExtractionRoute, createRequest({ body: { jobPostingContent: 'Senior engineer' } }))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'provider-unavailable' } })
  })

  it('never writes the operator key in server logs or metrics, even when the provider echoes it', async () => {
    const logs = recordServerLogs()
    stubProvider(() => Response.json({ error: { code: environment.OPENAI_API_KEY,
      param: environment.OPENAI_API_KEY.slice(3, 30), message: `Incorrect API key provided: ${environment.OPENAI_API_KEY}` } },
    { status: 401 }))

    await postTo(SourceProfileExtractionRoute, createRequest({ body: { professionalContent: 'Engineer at Example' } }))

    expect(logs.read()).toContain('privacy-safe-model-request')
    expect(logs.read()).not.toContain(environment.OPENAI_API_KEY.slice(3, 20))
    expect(logs.read()).not.toContain('sk-operator')
  })
})

type ServerRoute = Readonly<{ options: Readonly<{ server?: unknown }> }>
type PostHandler = (context: Readonly<{ request: Request }>) => Promise<Response> | Response

function postTo(route: ServerRoute, request: Request) {
  const { handlers } = route.options.server as Readonly<{ handlers: Readonly<{ POST: PostHandler }> }>
  return Promise.resolve(handlers.POST({ request }))
}

/** An earlier version of the interface sent a Candidate API Key in `x-candidate-api-key`; the server ignores it. */
function createRequest({ body, candidateApiKeyHeader }: Readonly<{ body?: unknown; candidateApiKeyHeader?: string }>) {
  return new Request('https://resume-studio.example/api', {
    body: JSON.stringify(body ?? {}),
    headers: {
      'content-type': 'application/json',
      'x-resume-studio-origin': environment.DEMO_ORIGIN_SECRET,
      cookie: createDemoAccessCookie({ issuedAtMilliseconds: Date.now(), sessionSecret: environment.DEMO_SESSION_SECRET }),
      ...(candidateApiKeyHeader === undefined ? {} : { 'x-candidate-api-key': candidateApiKeyHeader }),
    },
    method: 'POST',
  })
}

/** Answers every provider call and records how each one was signed. */
function stubProvider(answer: () => Response) {
  const authorizations: (string | null)[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
    authorizations.push(new Headers(init?.headers).get('authorization'))
    return Promise.resolve(answer())
  })
  return { authorizations }
}

function recordServerLogs() {
  const lines: string[] = []
  const record = (...values: unknown[]) => { lines.push(values.map(String).join(' ')) }
  for (const level of ['debug', 'error', 'info', 'log', 'warn'] as const) {
    vi.spyOn(console, level).mockImplementation(record)
  }
  return { read: () => lines.join('\n') }
}
