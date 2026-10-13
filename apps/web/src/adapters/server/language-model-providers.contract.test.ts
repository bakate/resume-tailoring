import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDeepSeekModelConfiguration, createOpenAiModelConfiguration } from '../../language-model-configuration'
import type { LanguageModelConfiguration } from '../../language-model-configuration'
import { readModelApiFailure } from './model-api-failure'
import { createModelJobMatchEvidenceMatcher, requestJobMatchEvidence } from './model-job-match-evidence-matcher'
import { createModelJobPostingExtractor } from './model-job-posting-extractor'
import { createModelResumeFieldValidator } from './model-resume-section-models'
import { createRecordedDeepSeekError, createRecordedDeepSeekResponse } from './recorded-deepseek-responses'
import { createRecordedOpenAiError, createRecordedOpenAiResponse } from './recorded-openai-responses'

type RecordedProvider = Readonly<{
  name: string
  endpoint: string
  structured: LanguageModelConfiguration
  answer: (answer: Readonly<{ outputText: string; usage?: Readonly<{ inputTokens: number; outputTokens: number }> }>) => Response
  exhaustedCredit: () => Response
  rateLimited: (retryAfter: string) => Response
  truncated: () => Response
}>

/** Each provider as it answers over HTTP; the cases below hold for every one of them alike. */
const recordedProviders: readonly RecordedProvider[] = [
  {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/responses',
    structured: createOpenAiModelConfiguration({ model: 'structured-model', reasoningEffort: 'low', role: 'structured' }),
    answer: ({ outputText, usage }) => createRecordedOpenAiResponse({ outputText, ...(usage === undefined ? {} : { usage }) }),
    exhaustedCredit: () => createRecordedOpenAiError({ code: 'insufficient_quota', status: 429 }),
    rateLimited: (retryAfter) => createRecordedOpenAiError({ code: 'rate_limit_exceeded', headers: { 'retry-after': retryAfter }, status: 429 }),
    truncated: () => createRecordedOpenAiResponse({ incompleteReason: 'max_output_tokens', outputText: '{"adjacentEvidence":[' }),
  },
  {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    structured: createDeepSeekModelConfiguration({ model: 'deepseek-flash', role: 'structured' }),
    answer: ({ outputText, usage }) => createRecordedDeepSeekResponse({ outputText, ...(usage === undefined ? {} : { usage }) }),
    exhaustedCredit: () => createRecordedDeepSeekError({ status: 402 }),
    rateLimited: (retryAfter) => createRecordedDeepSeekError({ headers: { 'retry-after': retryAfter }, status: 429 }),
    truncated: () => createRecordedDeepSeekResponse({ finishReason: 'length', outputText: '{"adjacentEvidence":[' }),
  },
]

describe.each(recordedProviders)('Server model adapters on $name', (provider) => {
  const apiKey = { value: 'test-api-key' } as const

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('extracts source-backed requirements from the recorded answer', async () => {
    const extractor = createModelJobPostingExtractor({ apiKey, configuration: provider.structured,
      request: () => Promise.resolve(provider.answer({ outputText: JSON.stringify(extractedJobPosting) })) })

    const result = await extractor.extract({ jobPostingContent })

    expect(result).toEqual({ ok: true, value: expectedExtractedJobPosting })
  })

  it('returns the match evidence proposal from the recorded answer', async () => {
    const matcher = createModelJobMatchEvidenceMatcher({ apiKey, configuration: provider.structured,
      request: () => Promise.resolve(provider.answer({ outputText: JSON.stringify(evidenceProposal) })) })

    const result = await matcher.match(matchRequest)

    expect(result).toEqual({ ok: true, value: evidenceProposal })
  })

  it('reports the token usage of the answer', async () => {
    const validator = createModelResumeFieldValidator({ apiKey, configuration: provider.structured,
      request: () => Promise.resolve(provider.answer({ outputText: JSON.stringify(fieldValidation),
        usage: { inputTokens: 900, outputTokens: 120 } })) })

    const result = await validator.validate(validationInput)

    expect(result).toEqual({ ok: true, value: { fields: [{ fieldId: 'degree', supported: true }] },
      usage: { inputTokens: 900, outputTokens: 120 } })
  })

  it('sends every call to the active provider alone, signed with the key it is given', async () => {
    const requests: Request[] = []
    const matcher = createModelJobMatchEvidenceMatcher({ apiKey, configuration: provider.structured, request: (input, init) => {
      requests.push(new Request(input, init))
      return Promise.resolve(provider.answer({ outputText: JSON.stringify(evidenceProposal) }))
    } })

    await matcher.match(matchRequest)

    expect(requests.map(({ headers, url }) => [url, headers.get('authorization')])).toEqual([[provider.endpoint, 'Bearer test-api-key']])
  })

  it('fails as invalid model output when the answer never conforms to the schema', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    const result = await requestJobMatchEvidence({ apiKey, configuration: provider.structured, matchRequest,
      request: () => Promise.resolve(provider.answer({ outputText: '{"evidence":"none"}' })) })

    expect(result).toEqual({ ok: false, error: { type: 'invalid-model-output' } })
  })

  it('fails an answer cut at its budget as an unavailable service, never as invalid model output', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    const result = await requestJobMatchEvidence({ apiKey, configuration: provider.structured, matchRequest,
      request: () => Promise.resolve(provider.truncated()) })

    expect(result.ok ? null : readModelApiFailure(result.error)).toEqual({ type: 'provider-unavailable' })
  })

  it('reads a rate limit with the delay it asks for', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    const result = await requestJobMatchEvidence({ apiKey, configuration: provider.structured, matchRequest,
      request: () => Promise.resolve(provider.rateLimited('15')) })

    expect(result.ok ? null : readModelApiFailure(result.error)).toEqual({ type: 'rate-limited', retryAfterSeconds: 15 })
  })

  it('reads exhausted operator credit as an unavailable service, never as a rate limit', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined)

    const result = await requestJobMatchEvidence({ apiKey, configuration: provider.structured, matchRequest,
      request: () => Promise.resolve(provider.exhaustedCredit()) })

    expect(result.ok ? null : readModelApiFailure(result.error)).toEqual({ type: 'provider-unavailable' })
  })
})

const jobPostingContent = 'We are hiring a Staff Engineer. TypeScript is required.'
const extractedJobPosting = {
  practicalConstraints: [],
  requirements: [{
    capability: { dimension: 'technical-expertise', name: 'TypeScript' },
    importance: 'critical',
    importanceRationale: 'The posting says required.',
    sourceExcerpt: 'TypeScript is required.',
    substitutableGroup: null,
    value: 'TypeScript',
  }],
  targetRole: { sourceExcerpt: 'We are hiring a Staff Engineer.', value: 'Staff Engineer' },
} as const

const expectedExtractedJobPosting = {
  ...extractedJobPosting,
  requirements: [{ ...extractedJobPosting.requirements[0], id: 'job-requirement-1' as const, substitutableGroup: undefined }],
}

const matchRequest = {
  candidateFacts: [{ id: 'source-fact-1', kind: 'skill', value: 'TypeScript' }],
  requirements: expectedExtractedJobPosting.requirements,
} as const

const evidenceProposal = {
  adjacentEvidence: [],
  evidence: [{
    coverage: 'covered',
    factMatches: [{ factExcerpt: 'TypeScript', factId: 'source-fact-1', requirementExcerpt: 'TypeScript' }],
    requirementId: 'job-requirement-1',
  }],
  relevance: [{
    factMatch: { factExcerpt: 'TypeScript', factId: 'source-fact-1', requirementExcerpt: 'TypeScript' },
    requirementId: 'job-requirement-1',
  }],
} as const

const fieldValidation = { fields: [{ fieldId: 'degree', supported: true, unsupportedProposition: null }] } as const

const validationInput = {
  section: { kind: 'education', key: 'education' },
  locale: 'en',
  purpose: 'tailored',
  fields: [{ id: 'degree', text: 'Computer Science degree', factIds: ['source-fact-education-0-qualification-0'] }],
  candidateFacts: [],
} as const
