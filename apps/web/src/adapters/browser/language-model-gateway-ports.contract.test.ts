import { describe, expect, it } from 'vitest'
import { groupedResumeDocument } from '@resume-tailoring/application/structured-resume-fixtures'
import { noMatchEvidence, testProcessingPolicy } from '@resume-tailoring/application/testing'
import type { OpenAiLanguageModelGateway } from './openai-language-model-gateway'
import {
  createGatewayJobPostingExtractor,
  createGatewayMatchEvidenceMatcher,
  createGatewayResumeSectionModels,
  createGatewaySourceProfileExtractor,
} from './language-model-gateway-ports'

type StructuredGatewayResult = Awaited<ReturnType<OpenAiLanguageModelGateway['structured']['process']>>

const coherentDocument = { coherent: true, languageMatches: true, issues: [] }
const sectionValidationInput = { section: { key: 'skills', kind: 'skills' }, fields: [], candidateFacts: [],
  locale: 'en', purpose: 'tailored' } as const
const coherenceInput = { document: groupedResumeDocument }

describe('Candidate Journey ports over the Language Model Gateway', () => {
  it('reports missing Processing Consent when the gateway refuses a Source Profile extraction', async () => {
    const extractor = createGatewaySourceProfileExtractor({
      languageModelGateway: createAnsweringGateway({ ok: false, error: { type: 'processing-consent-required' } }),
    })

    const result = await extractor.extract({ professionalContent: 'Built billing screens' })

    expect(result).toEqual({ ok: false, error: 'processing-consent-required' })
  })

  it('reports an unavailable Source Profile extraction when the model is unavailable', async () => {
    const extractor = createGatewaySourceProfileExtractor({
      languageModelGateway: createAnsweringGateway({ ok: false, error: { type: 'language-model-unavailable' } }),
    })

    const result = await extractor.extract({ professionalContent: 'Built billing screens' })

    expect(result).toEqual({ ok: false, error: 'source-profile-extraction-unavailable' })
  })

  it('reports an unavailable Job Posting extraction when the gateway answers another operation', async () => {
    const extractor = createGatewayJobPostingExtractor({ languageModelGateway: createAnsweringGateway(otherOperation) })

    const result = await extractor.extract({ jobPostingContent: 'React engineer' })

    expect(result).toEqual({ ok: false, error: 'job-posting-extraction-unavailable' })
  })

  it('reports unavailable Match Evidence when the gateway refuses the comparison', async () => {
    const matcher = createGatewayMatchEvidenceMatcher({
      languageModelGateway: createAnsweringGateway({ ok: false, error: { type: 'processing-consent-required' } }),
    })

    const result = await matcher.match({ candidateFacts: [], requirements: [] })

    expect(result).toEqual({ ok: false, error: 'match-evidence-unavailable' })
  })

  it.each([
    [{ type: 'processing-consent-required' }, 'consent-required'],
    [{ type: 'language-model-unavailable', cause: 'timeout' }, 'timeout'],
    [{ type: 'language-model-unavailable', cause: 'permanent', transient: true }, 'permanent'],
    [{ type: 'language-model-unavailable', transient: true }, 'transient'],
    [{ type: 'language-model-unavailable' }, 'permanent'],
  ] as const)('classifies the gateway failure %o as a %s section model failure', async (error, failure) => {
    const models = createGatewayResumeSectionModels({ languageModelGateway: createAnsweringGateway({ ok: false, error }) })

    const result = await models.checkCoherence(coherenceInput)

    expect(result).toEqual({ ok: false, error: { type: failure } })
  })

  it('treats a section model answer for another operation as a permanent failure', async () => {
    const models = createGatewayResumeSectionModels({ languageModelGateway: createAnsweringGateway(otherOperation) })

    const result = await models.validateFields(sectionValidationInput)

    expect(result).toEqual({ ok: false, error: { type: 'permanent' } })
  })

  it('keeps the model usage of a section model answer', async () => {
    const models = createGatewayResumeSectionModels({ languageModelGateway: createAnsweringGateway({ ok: true, value: {
      operation: 'resume-document-coherence', value: coherentDocument, usage: { inputTokens: 12, outputTokens: 3 },
    } }) })

    const result = await models.checkCoherence(coherenceInput)

    expect(result).toEqual({ ok: true, value: coherentDocument, usage: { inputTokens: 12, outputTokens: 3 } })
  })
})

const otherOperation = {
  ok: true, value: { operation: 'explainable-match-evidence', value: noMatchEvidence },
} as const satisfies StructuredGatewayResult

function createAnsweringGateway(result: StructuredGatewayResult): OpenAiLanguageModelGateway {
  return {
    processingPolicy: testProcessingPolicy,
    structured: { process: () => Promise.resolve(result) },
    writing: { process: () => Promise.resolve({ ok: false, error: { type: 'language-model-unavailable' } }) },
  }
}
