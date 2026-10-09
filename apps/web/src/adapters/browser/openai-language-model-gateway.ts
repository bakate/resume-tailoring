import type { ResumeModelUsage, ResumeSectionModelResult } from '@resume-tailoring/application/candidate-journey'
import { createBrowserResumeCoherenceChecker, createBrowserResumeFieldValidator, createBrowserResumeSectionWriter } from './browser-resume-section-models'
import type { ResumeCoherenceChecker, ResumeFieldValidator, ResumeSectionWriter } from '@resume-tailoring/application/ports'
import {
  createLanguageModelGateway,
} from '@resume-tailoring/application/language-model-gateway'
import type {
  LanguageModelGateway,
  ProcessingConsent,
  ProcessingPolicy,
} from '@resume-tailoring/application/language-model-gateway'
import {
  createBrowserResumeClaimSemanticValidator,
  createBrowserResumeClaimReformulator,
} from './browser-adapters'
import { createBrowserStructuredSourceProfileExtractor } from './browser-structured-source-profile-extractor'
import {
  createBrowserJobMatchEvidenceMatcher,
  createBrowserJobPostingExtractor,
} from './browser-job-match-adapters'
import type { JobPostingExtractor as ExplainableJobPostingExtractor, LanguageModelGatewayAdapter,
  LanguageModelResult, MatchEvidenceMatcher as ExplainableMatchEvidenceMatcher, ReadApiFailure, ResumeClaimReformulator,
  ResumeClaimSemanticValidator, StructuredSourceProfileExtractor } from '@resume-tailoring/application/ports'

type StructuredModelRequest =
  | ModelRequest<'resume-section-validation', Parameters<ResumeFieldValidator['validate']>[0]>
  | ModelRequest<'resume-document-coherence', Parameters<ResumeCoherenceChecker['check']>[0]>
  | ModelRequest<'explainable-job-posting-extraction', Parameters<ExplainableJobPostingExtractor['extract']>[0]>
  | ModelRequest<'explainable-match-evidence', Parameters<ExplainableMatchEvidenceMatcher['match']>[0]>
  | ModelRequest<'resume-claim-validation', Parameters<ResumeClaimSemanticValidator['validate']>[0]>
  | ModelRequest<'structured-source-profile-extraction', Parameters<StructuredSourceProfileExtractor['extract']>[0]>
type WritingModelRequest =
  | ModelRequest<'resume-section-writing', Parameters<ResumeSectionWriter['write']>[0]>
  | ModelRequest<'resume-claim-reformulation', Parameters<ResumeClaimReformulator['reformulate']>[0]>
type StructuredModelValue =
  | MeteredModelValue<'resume-section-validation', ResumeFieldValidator['validate']>
  | MeteredModelValue<'resume-document-coherence', ResumeCoherenceChecker['check']>
  | ModelValue<'explainable-job-posting-extraction', ExplainableJobPostingExtractor['extract']>
  | ModelValue<'explainable-match-evidence', ExplainableMatchEvidenceMatcher['match']>
  | ModelValue<'resume-claim-validation', ResumeClaimSemanticValidator['validate']>
  | ModelValue<'structured-source-profile-extraction', StructuredSourceProfileExtractor['extract']>
type WritingModelValue =
  | MeteredModelValue<'resume-section-writing', ResumeSectionWriter['write']>
  | ModelValue<'resume-claim-reformulation', ResumeClaimReformulator['reformulate']>
type ModelRequest<TOperation extends string, TInput> = Readonly<{
  input: TInput
  operation: TOperation
}>
type ModelValue<TOperation extends string, TProcessor extends (...arguments_: never[]) => unknown> =
  Readonly<{ operation: TOperation; value: SuccessfulValue<Awaited<ReturnType<TProcessor>>> }>
type MeteredModelValue<TOperation extends string, TProcessor extends (...arguments_: never[]) => unknown> =
  Readonly<{ operation: TOperation; value: SuccessfulValue<Awaited<ReturnType<TProcessor>>>; usage?: ResumeModelUsage }>
type SuccessfulValue<TResult> = TResult extends Readonly<{ ok: true; value: infer TValue }>
  ? TValue
  : never

export type OpenAiLanguageModelGateway = LanguageModelGateway<
  StructuredModelRequest,
  StructuredModelValue,
  WritingModelRequest,
  WritingModelValue
>

type OpenAiModelAdapters = Readonly<{
  resumeSectionWriter: ResumeSectionWriter
  resumeFieldValidator: ResumeFieldValidator
  resumeCoherenceChecker: ResumeCoherenceChecker
  explainableJobPostingExtractor: ExplainableJobPostingExtractor
  explainableMatchEvidenceMatcher: ExplainableMatchEvidenceMatcher
  resumeClaimSemanticValidator: ResumeClaimSemanticValidator
  resumeClaimReformulator: ResumeClaimReformulator
  structuredSourceProfileExtractor: StructuredSourceProfileExtractor
}>

export const openAiProcessingPolicy = {
  provider: 'OpenAI',
  purposes: [
    'Extract and structure professional evidence',
    'Compare Candidate evidence with Job Posting requirements',
    'Write and validate supported Tailored Resume content',
  ],
  retentionPolicy: 'API inputs and outputs may be retained for abuse monitoring for up to 30 days, or longer when legally required.',
  storageBehavior: 'Candidate content remains browser-local; model requests are stateless with application storage disabled.',
  transmittedDataCategories: [
    'Minimized professional content',
    'Job Posting content',
    'Candidate Facts needed for matching, writing, and validation',
  ],
  version: '2026-09-29',
} as const satisfies ProcessingPolicy

export function createOpenAiLanguageModelGateway({
  readProcessingConsent,
  request = fetch,
}: Readonly<{
  readProcessingConsent: () => ProcessingConsent | null
  request?: typeof fetch
}>): OpenAiLanguageModelGateway {
  return createLanguageModelGateway({
    adapter: createOpenAiLanguageModelGatewayAdapter({ request }),
    readProcessingConsent,
  })
}

function createOpenAiLanguageModelGatewayAdapter({ request }: Readonly<{
  request: typeof fetch
}>): LanguageModelGatewayAdapter<
  StructuredModelRequest, StructuredModelValue, WritingModelRequest, WritingModelValue
> {
  const modelAdapters = createOpenAiModelAdapters({ request })
  return {
    processingPolicy: openAiProcessingPolicy,
    structured: { process: (modelRequest) => processStructured({ modelAdapters, modelRequest }) },
    writing: { process: (modelRequest) => processWriting({ modelAdapters, modelRequest }) },
  }
}

function createOpenAiModelAdapters({ request }: Readonly<{
  request: typeof fetch
}>): OpenAiModelAdapters {
  return {
    resumeSectionWriter: createBrowserResumeSectionWriter({ request }),
    resumeFieldValidator: createBrowserResumeFieldValidator({ request }),
    resumeCoherenceChecker: createBrowserResumeCoherenceChecker({ request }),
    explainableJobPostingExtractor: createBrowserJobPostingExtractor({ request }),
    explainableMatchEvidenceMatcher: createBrowserJobMatchEvidenceMatcher({ request }),
    resumeClaimSemanticValidator: createBrowserResumeClaimSemanticValidator({ request }),
    resumeClaimReformulator: createBrowserResumeClaimReformulator({ request }),
    structuredSourceProfileExtractor: createBrowserStructuredSourceProfileExtractor({ request }),
  }
}

type ProcessStructuredRequest = Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredModelRequest
}>

async function processStructured({ modelAdapters, modelRequest }: ProcessStructuredRequest) {
  if (modelRequest.operation === 'resume-section-validation') {
    const result = await modelAdapters.resumeFieldValidator.validate(modelRequest.input)
    return toSectionGatewayResult({ operation: modelRequest.operation, result })
  }
  if (modelRequest.operation === 'resume-document-coherence') {
    const result = await modelAdapters.resumeCoherenceChecker.check(modelRequest.input)
    return toSectionGatewayResult({ operation: modelRequest.operation, result })
  }
  if (modelRequest.operation === 'explainable-job-posting-extraction') {
    return processJobPostingExtraction({ modelAdapters, modelRequest })
  }
  if (modelRequest.operation === 'explainable-match-evidence') {
    return processExplainableMatchEvidence({ modelAdapters, modelRequest })
  }
  if (modelRequest.operation === 'structured-source-profile-extraction') {
    return processStructuredSourceProfileExtraction({ modelAdapters, modelRequest })
  }
  return processResumeClaimValidation({ modelAdapters, modelRequest })
}

type StructuredRequest<TOperation extends StructuredModelRequest['operation']> =
  Extract<StructuredModelRequest, { readonly operation: TOperation }>

async function processJobPostingExtraction({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredRequest<'explainable-job-posting-extraction'>
}>) {
  const result = await modelAdapters.explainableJobPostingExtractor.extract(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processExplainableMatchEvidence({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredRequest<'explainable-match-evidence'>
}>) {
  const result = await modelAdapters.explainableMatchEvidenceMatcher.match(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processStructuredSourceProfileExtraction({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredRequest<'structured-source-profile-extraction'>
}>) {
  const result = await modelAdapters.structuredSourceProfileExtractor.extract(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processResumeClaimValidation({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredRequest<'resume-claim-validation'>
}>): Promise<LanguageModelResult<StructuredModelValue>> {
  const result = await modelAdapters.resumeClaimSemanticValidator.validate(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processWriting({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: WritingModelRequest
}>): Promise<LanguageModelResult<WritingModelValue>> {
  if (modelRequest.operation === 'resume-section-writing') {
    const result = await modelAdapters.resumeSectionWriter.write(modelRequest.input)
    return toSectionGatewayResult({ operation: modelRequest.operation, result })
  }
  const result = await modelAdapters.resumeClaimReformulator.reformulate(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

/** Keeps the API Failure an adapter read, whether it reports it beside its error or inside it. */
function toGatewayResult<TOperation extends string, TValue>({ operation, result }: Readonly<{
  operation: TOperation
  result: Readonly<{ ok: true; value: TValue }> | Readonly<{
    ok: false; apiFailure?: ReadApiFailure; error: string | Readonly<{ apiFailure?: ReadApiFailure }>
  }>
}>): LanguageModelResult<Readonly<{ operation: TOperation; value: TValue }>> {
  if (result.ok) return { ok: true, value: { operation, value: result.value } }
  const apiFailure = typeof result.error === 'string' ? result.apiFailure : result.error.apiFailure
  return { ok: false, error: { type: 'language-model-unavailable', ...(apiFailure === undefined ? {} : { apiFailure }) } }
}

function toSectionGatewayResult<TOperation extends string, TValue>({ operation, result }: Readonly<{
  operation: TOperation; result: ResumeSectionModelResult<TValue>
}>): LanguageModelResult<Readonly<{ operation: TOperation; value: TValue; usage?: ResumeModelUsage }>> {
  if (result.ok) return { ok: true, value: { operation, value: result.value, ...(result.usage === undefined ? {} : { usage: result.usage }) } }
  if (result.error.type === 'consent-required') return { ok: false, error: { type: 'processing-consent-required' } }
  return { ok: false, error: { type: 'language-model-unavailable', apiFailure: result.error } }
}
