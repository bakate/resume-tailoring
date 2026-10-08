import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDemoAccessCookie } from './demo-access/demo-access-session'
import { Route as CandidateApiKeyRoute } from './routes/api.candidate-api-key'
import { Route as JobPostingExtractionRoute } from './routes/api.explainable-job-posting-extraction'
import { Route as ResumeSectionWritingRoute } from './routes/api.resume-section-writing'
import { Route as SourceProfileExtractionRoute } from './routes/api.structured-source-profile-extraction'

const environment = {
  DEMO_ACCESS_MODE: 'enforced',
  DEMO_ORIGIN_SECRET: 'an-origin-secret-with-at-least-32-characters',
  DEMO_PUBLIC_HOSTNAME: 'resume-studio.example.workers.dev',
  DEMO_SESSION_SECRET: 'a-session-secret-with-at-least-32-characters',
  OPENAI_API_KEY: 'sk-operator-key-that-must-never-sign-candidate-requests',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  TURNSTILE_SITE_KEY: 'turnstile-site-key',
} as const
const candidateApiKey = 'sk-proj-CandidateSecret0123456789abcdef'
const modelRoutes = [
  { name: 'Job Posting extraction', route: JobPostingExtractionRoute, body: { jobPostingContent: 'Senior engineer' } },
  { name: 'Source Profile extraction', route: SourceProfileExtractionRoute,
    body: { professionalContent: 'Engineer at Example' } },
  { name: 'Resume Section writing', route: ResumeSectionWritingRoute, body: undefined },
] as const

describe('Candidate API Key on model-backed routes', () => {
  beforeEach(() => {
    Object.entries(environment).forEach(([name, value]) => vi.stubEnv(name, value))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it.each(modelRoutes.filter(({ body }) => body !== undefined))(
    '$name never signs a call with the operator key when the Candidate API Key is rejected', async ({ body, route }) => {
      const provider = stubProvider(() => Response.json({ error: { code: 'invalid_api_key',
        message: `Incorrect API key provided: ${candidateApiKey}` } }, { status: 401 }))

      const response = await postTo(route, createRequest({ body, candidateApiKey }))

      expect(response.status).toBe(401)
      await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'candidate-api-key-invalid' } })
      expect(provider.authorizations.length).toBeGreaterThan(0)
      expect(provider.authorizations.every((authorization) => authorization === `Bearer ${candidateApiKey}`)).toBe(true)
    })

  it.each(modelRoutes)('$name refuses a malformed Candidate API Key without calling the provider', async ({ body, route }) => {
    const provider = stubProvider(() => Response.json({ output: [] }))

    const response = await postTo(route, createRequest({ body: body ?? {}, candidateApiKey: 'not-a-provider-key' }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'candidate-api-key-invalid' } })
    expect(provider.authorizations).toEqual([])
  })

  it('reads exhausted credit on the Candidate API Key as its own failure, not a rate limit', async () => {
    stubProvider(() => Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }))

    const response = await postTo(JobPostingExtractionRoute, createRequest({
      body: { jobPostingContent: 'Senior engineer' }, candidateApiKey,
    }))

    expect(response.status).toBe(402)
    await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'provider-credit-exhausted' } })
  })

  it('never writes the Candidate API Key in server logs or metrics, even when the provider echoes it', async () => {
    const logs = recordServerLogs()
    stubProvider(() => Response.json({ error: { code: candidateApiKey, param: candidateApiKey.slice(3, 30),
      message: `Incorrect API key provided: ${candidateApiKey}` } }, { status: 401 }))

    const response = await postTo(SourceProfileExtractionRoute, createRequest({
      body: { professionalContent: 'Engineer at Example' }, candidateApiKey,
    }))

    expect(response.status).toBe(401)
    expect(logs.read()).toContain('privacy-safe-openai-request')
    expect(logs.read()).not.toContain('CandidateSecret')
    expect(logs.read()).not.toContain('sk-proj')
  })

  it('signs a request without the header with the operator key', async () => {
    const provider = stubProvider(() => Response.json({ error: { code: 'server_error' } }, { status: 500 }))

    await postTo(JobPostingExtractionRoute, createRequest({ body: { jobPostingContent: 'Senior engineer' } }))

    expect(provider.authorizations).toEqual([`Bearer ${environment.OPENAI_API_KEY}`])
  })

  it('validates a Candidate API Key by reading both model roles at no cost', async () => {
    const provider = stubProvider(() => Response.json({ id: 'model', object: 'model' }))

    const response = await postTo(CandidateApiKeyRoute, createRequest({ candidateApiKey }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(provider.calls).toEqual([
      { method: 'GET', url: 'https://api.openai.com/v1/models/gpt-6-luna' },
      { method: 'GET', url: 'https://api.openai.com/v1/models/gpt-6-sol' },
    ])
    expect(provider.authorizations.every((authorization) => authorization === `Bearer ${candidateApiKey}`)).toBe(true)
  })

  it.each([
    { status: 401, code: 'invalid_api_key', type: 'candidate-api-key-invalid' },
    { status: 404, code: 'model_not_found', type: 'candidate-api-key-model-unavailable' },
    { status: 429, code: 'insufficient_quota', type: 'provider-credit-exhausted' },
  ] as const)('reports $type when validating a key the provider answers with $code', async ({ code, status, type }) => {
    stubProvider(() => Response.json({ error: { code } }, { status }))

    const response = await postTo(CandidateApiKeyRoute, createRequest({ candidateApiKey }))

    await expect(response.json()).resolves.toEqual({ ok: false, error: { type } })
  })

  it('never validates the operator key', async () => {
    const provider = stubProvider(() => Response.json({ id: 'model', object: 'model' }))

    const response = await postTo(CandidateApiKeyRoute, createRequest({}))

    expect(response.status).toBe(401)
    expect(provider.authorizations).toEqual([])
  })
})

type ServerRoute = Readonly<{ options: Readonly<{ server?: unknown }> }>
type PostHandler = (context: Readonly<{ request: Request }>) => Promise<Response> | Response

function postTo(route: ServerRoute, request: Request) {
  const { handlers } = route.options.server as Readonly<{ handlers: Readonly<{ POST: PostHandler }> }>
  return Promise.resolve(handlers.POST({ request }))
}

function createRequest({ body, candidateApiKey: key }: Readonly<{ body?: unknown; candidateApiKey?: string }>) {
  return new Request('https://resume-studio.example/api', {
    body: JSON.stringify(body ?? {}),
    headers: {
      'content-type': 'application/json',
      'x-resume-studio-origin': environment.DEMO_ORIGIN_SECRET,
      cookie: createDemoAccessCookie({ issuedAtMilliseconds: Date.now(), sessionSecret: environment.DEMO_SESSION_SECRET }),
      ...(key === undefined ? {} : { 'x-candidate-api-key': key }),
    },
    method: 'POST',
  })
}

/** Answers every provider call and records how each one was signed. */
function stubProvider(answer: () => Response) {
  const authorizations: (string | null)[] = []
  const calls: Readonly<{ method: string; url: string }>[] = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    authorizations.push(new Headers(init?.headers).get('authorization'))
    calls.push({ method: init?.method ?? 'GET', url: input instanceof Request ? input.url : String(input) })
    return Promise.resolve(answer())
  })
  return { authorizations, calls }
}

function recordServerLogs() {
  const lines: string[] = []
  const record = (...values: unknown[]) => { lines.push(values.map(String).join(' ')) }
  for (const level of ['debug', 'error', 'info', 'log', 'warn'] as const) {
    vi.spyOn(console, level).mockImplementation(record)
  }
  return { read: () => lines.join('\n') }
}
