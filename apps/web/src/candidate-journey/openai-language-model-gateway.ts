import {
  createLanguageModelGateway,
} from '@resume-tailoring/application/language-model-gateway'
import type {
  LanguageModelGateway,
  LanguageModelGatewayAdapter,
  LanguageModelResult,
  ProcessingConsent,
  ProcessingPolicy,
} from '@resume-tailoring/application/language-model-gateway'
import type {
  StructuredSourceProfileExtractor,
} from '@resume-tailoring/application/source-intake'
import type {
  JobPostingExtractor as ExplainableJobPostingExtractor,
  MatchEvidenceMatcher as ExplainableMatchEvidenceMatcher,
} from '@resume-tailoring/application/job-match'
import type {
  JobRequirementExtractor,
  MatchEvidenceMatcher,
  ResumeClaimSemanticValidator,
  ResumeClaimWriter,
  SourceProfileExtractor,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  createBrowserJobRequirementExtractor,
  createBrowserMatchEvidenceMatcher,
  createBrowserResumeClaimSemanticValidator,
  createBrowserResumeClaimWriter,
  createBrowserSourceProfileExtractor,
} from '../resume-tailoring/browser-adapters'
import { createBrowserStructuredSourceProfileExtractor } from './browser-structured-source-profile-extractor'
import {
  createBrowserJobMatchEvidenceMatcher,
  createBrowserJobPostingExtractor,
} from './browser-job-match-adapters'

type StructuredModelRequest =
  | ModelRequest<'explainable-job-posting-extraction', Parameters<ExplainableJobPostingExtractor['extract']>[0]>
  | ModelRequest<'explainable-match-evidence', Parameters<ExplainableMatchEvidenceMatcher['match']>[0]>
  | ModelRequest<'job-requirement-extraction', Parameters<JobRequirementExtractor['extract']>[0]>
  | ModelRequest<'match-analysis', Parameters<MatchEvidenceMatcher['match']>[0]>
  | ModelRequest<'resume-claim-validation', Parameters<ResumeClaimSemanticValidator['validate']>[0]>
  | ModelRequest<'source-profile-extraction', Parameters<SourceProfileExtractor['extract']>[0]>
  | ModelRequest<'structured-source-profile-extraction', Parameters<StructuredSourceProfileExtractor['extract']>[0]>
type WritingModelRequest =
  | ModelRequest<'resume-claim-reformulation', Parameters<ResumeClaimWriter['reformulate']>[0]>
  | ModelRequest<'resume-claim-writing', Parameters<ResumeClaimWriter['write']>[0]>
type StructuredModelValue =
  | ModelValue<'explainable-job-posting-extraction', ExplainableJobPostingExtractor['extract']>
  | ModelValue<'explainable-match-evidence', ExplainableMatchEvidenceMatcher['match']>
  | ModelValue<'job-requirement-extraction', JobRequirementExtractor['extract']>
  | ModelValue<'match-analysis', MatchEvidenceMatcher['match']>
  | ModelValue<'resume-claim-validation', ResumeClaimSemanticValidator['validate']>
  | ModelValue<'source-profile-extraction', SourceProfileExtractor['extract']>
  | ModelValue<'structured-source-profile-extraction', StructuredSourceProfileExtractor['extract']>
type WritingModelValue =
  | ModelValue<'resume-claim-reformulation', ResumeClaimWriter['reformulate']>
  | ModelValue<'resume-claim-writing', ResumeClaimWriter['write']>
type ModelRequest<TOperation extends string, TInput> = Readonly<{
  input: TInput
  operation: TOperation
}>
type ModelValue<TOperation extends string, TProcessor extends (...arguments_: never[]) => unknown> =
  Readonly<{ operation: TOperation; value: SuccessfulValue<Awaited<ReturnType<TProcessor>>> }>
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
  explainableJobPostingExtractor: ExplainableJobPostingExtractor
  explainableMatchEvidenceMatcher: ExplainableMatchEvidenceMatcher
  jobRequirementExtractor: JobRequirementExtractor
  matchEvidenceMatcher: MatchEvidenceMatcher
  resumeClaimSemanticValidator: ResumeClaimSemanticValidator
  resumeClaimWriter: ResumeClaimWriter
  sourceProfileExtractor: SourceProfileExtractor
  structuredSourceProfileExtractor: StructuredSourceProfileExtractor
}>

const openAiProcessingPolicy = {
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
    explainableJobPostingExtractor: createBrowserJobPostingExtractor({ request }),
    explainableMatchEvidenceMatcher: createBrowserJobMatchEvidenceMatcher({ request }),
    jobRequirementExtractor: createBrowserJobRequirementExtractor({ request }),
    matchEvidenceMatcher: createBrowserMatchEvidenceMatcher({ request }),
    resumeClaimSemanticValidator: createBrowserResumeClaimSemanticValidator({ request }),
    resumeClaimWriter: createBrowserResumeClaimWriter({ request }),
    sourceProfileExtractor: createBrowserSourceProfileExtractor({ request }),
    structuredSourceProfileExtractor: createBrowserStructuredSourceProfileExtractor({ request }),
  }
}

type ProcessStructuredRequest = Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredModelRequest
}>

async function processStructured({ modelAdapters, modelRequest }: ProcessStructuredRequest) {
  if (modelRequest.operation === 'explainable-job-posting-extraction') {
    return processJobPostingExtraction({ modelAdapters, modelRequest })
  }
  if (modelRequest.operation === 'explainable-match-evidence') {
    return processExplainableMatchEvidence({ modelAdapters, modelRequest })
  }
  if (modelRequest.operation === 'source-profile-extraction') {
    return processSourceProfileExtraction({ modelAdapters, modelRequest })
  }
  if (modelRequest.operation === 'structured-source-profile-extraction') {
    return processStructuredSourceProfileExtraction({ modelAdapters, modelRequest })
  }
  if (modelRequest.operation === 'job-requirement-extraction') {
    return processJobRequirementExtraction({ modelAdapters, modelRequest })
  }
  return processStructuredAnalysis({ modelAdapters, modelRequest })
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

async function processSourceProfileExtraction({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredRequest<'source-profile-extraction'>
}>) {
  const result = await modelAdapters.sourceProfileExtractor.extract(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processStructuredSourceProfileExtraction({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredRequest<'structured-source-profile-extraction'>
}>) {
  const result = await modelAdapters.structuredSourceProfileExtractor.extract(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processJobRequirementExtraction({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: StructuredRequest<'job-requirement-extraction'>
}>) {
  const result = await modelAdapters.jobRequirementExtractor.extract(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processStructuredAnalysis({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: Exclude<StructuredModelRequest,
  { readonly operation:
    | 'explainable-job-posting-extraction'
    | 'explainable-match-evidence'
    | 'job-requirement-extraction'
    | 'source-profile-extraction'
    | 'structured-source-profile-extraction'
  }>
}>): Promise<LanguageModelResult<StructuredModelValue>> {
  if (modelRequest.operation === 'match-analysis') {
    const result = await modelAdapters.matchEvidenceMatcher.match(modelRequest.input)
    return toGatewayResult({ operation: modelRequest.operation, result })
  }
  const result = await modelAdapters.resumeClaimSemanticValidator.validate(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

async function processWriting({ modelAdapters, modelRequest }: Readonly<{
  modelAdapters: OpenAiModelAdapters
  modelRequest: WritingModelRequest
}>): Promise<LanguageModelResult<WritingModelValue>> {
  if (modelRequest.operation === 'resume-claim-writing') {
    const result = await modelAdapters.resumeClaimWriter.write(modelRequest.input)
    return toGatewayResult({ operation: modelRequest.operation, result })
  }
  const result = await modelAdapters.resumeClaimWriter.reformulate(modelRequest.input)
  return toGatewayResult({ operation: modelRequest.operation, result })
}

function toGatewayResult<TOperation extends string, TValue>({ operation, result }: Readonly<{
  operation: TOperation
  result: Readonly<{ ok: true; value: TValue }> | Readonly<{ ok: false }>
}>): LanguageModelResult<Readonly<{ operation: TOperation; value: TValue }>> {
  return result.ok
    ? { ok: true, value: { operation, value: result.value } }
    : unavailableResult
}

const unavailableResult = {
  ok: false,
  error: { type: 'language-model-unavailable' },
} as const
