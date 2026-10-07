import type { ResumeSectionModelResult } from '@resume-tailoring/application/candidate-journey'
import type { JobPostingExtractor, LanguageModelResult, MatchEvidenceMatcher, ResumeSectionModels,
  StructuredSourceProfileExtractor } from '@resume-tailoring/application/ports'
import type { OpenAiLanguageModelGateway } from './openai-language-model-gateway'

type GatewayDependencies = Readonly<{ languageModelGateway: OpenAiLanguageModelGateway }>

export function createGatewayJobPostingExtractor({ languageModelGateway }: GatewayDependencies): JobPostingExtractor {
  return { extract: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'explainable-job-posting-extraction',
    })
    return result.ok && result.value.operation === 'explainable-job-posting-extraction'
      ? { ok: true, value: result.value.value }
      : { ok: false, error: 'job-posting-extraction-unavailable' as const, ...readApiFailure(result) }
  } }
}

export function createGatewayMatchEvidenceMatcher({ languageModelGateway }: GatewayDependencies): MatchEvidenceMatcher {
  return { match: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'explainable-match-evidence',
    })
    return result.ok && result.value.operation === 'explainable-match-evidence'
      ? { ok: true, value: result.value.value }
      : { ok: false, error: 'match-evidence-unavailable' as const, ...readApiFailure(result) }
  } }
}

export function createGatewaySourceProfileExtractor({
  languageModelGateway,
}: GatewayDependencies): StructuredSourceProfileExtractor {
  return { extract: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'structured-source-profile-extraction',
    })
    if (result.ok && result.value.operation === 'structured-source-profile-extraction') {
      return { ok: true, value: result.value.value }
    }
    return readSourceProfileFailure({ result })
  } }
}

function readSourceProfileFailure({ result }: Readonly<{
  result: Awaited<ReturnType<OpenAiLanguageModelGateway['structured']['process']>>
}>) {
  return {
    ok: false as const,
    error: !result.ok && result.error.type === 'processing-consent-required'
      ? 'processing-consent-required' as const
      : 'source-profile-extraction-unavailable' as const,
    ...readApiFailure(result),
  }
}

/** The API Failure the gateway kept, when a browser adapter read one; an answer for another operation has none. */
function readApiFailure(result: LanguageModelResult<unknown>) {
  return result.ok || result.error.apiFailure === undefined ? {} : { apiFailure: result.error.apiFailure }
}

export function createGatewayResumeSectionModels({ languageModelGateway: gateway }: GatewayDependencies): ResumeSectionModels {
  return {
    writeSection: async (input) => toSectionModelResult({ operation: 'resume-section-writing',
      result: await gateway.writing.process({ operation: 'resume-section-writing', input }) }),
    validateFields: async (input) => toSectionModelResult({ operation: 'resume-section-validation',
      result: await gateway.structured.process({ operation: 'resume-section-validation', input }) }),
    checkCoherence: async (input) => toSectionModelResult({ operation: 'resume-document-coherence',
      result: await gateway.structured.process({ operation: 'resume-document-coherence', input }) }),
  }
}

type GatewayValue = Readonly<{ operation: string; value: unknown; usage?: ResumeSectionModelResult<unknown>['usage'] }>

function toSectionModelResult<TOperation extends string, TResult extends GatewayValue>({ operation, result }: Readonly<{
  operation: TOperation; result: LanguageModelResult<TResult>
}>): ResumeSectionModelResult<Extract<TResult, { operation: TOperation }>['value']> {
  if (!result.ok) return { ok: false, error: result.error.type === 'processing-consent-required' ? { type: 'consent-required' }
    : result.error.apiFailure ?? { type: 'unexpected-response' } }
  if (!isOperation(result.value, operation)) return { ok: false, error: { type: 'unexpected-response' } }
  return { ok: true, value: result.value.value, ...(result.value.usage === undefined ? {} : { usage: result.value.usage }) }
}

function isOperation<TOperation extends string, TResult extends GatewayValue>(value: TResult, operation: TOperation):
  value is Extract<TResult, { operation: TOperation }> {
  return value.operation === operation
}
