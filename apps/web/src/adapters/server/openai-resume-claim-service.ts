import type { ResumeClaimWritingInputs } from '@resume-tailoring/application/resume-claims'
import { z } from 'zod'

import {
  hasOnlyResumeClaimInputReferences,
  proposedResumeClaimsSchema,
  resumeClaimSemanticValidationSchema,
} from '../../resume-tailoring/resume-claim-schemas'
import type { LanguageModelConfiguration } from '../../language-model-configuration'
import { createModelRequester } from './language-model-request'
import type { ModelApiKey, ModelRequestFailure } from './language-model-request'
import { readModelApiFailure } from './model-api-failure'
import type { ResumeClaimReformulator, ResumeClaimSemanticValidator } from '@resume-tailoring/application/ports'
import { delimitSuppliedData, untrustedContentInstruction } from './untrusted-model-input'

type ResumeClaimModelSettings = Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  request?: typeof fetch
}>

type ResumeClaimValidationSettings = ResumeClaimModelSettings & Readonly<{
  deadlineSignal?: AbortSignal
  operation?: 'resume-claim-validation'
}>

type ActiveResumeClaimModel = Readonly<{
  deadlineSignal?: AbortSignal
  operation: 'resume-claim-validation' | 'resume-claim-writing'
  requester: ReturnType<typeof createModelRequester>
}>

export function createOpenAiResumeClaimReformulator({
  apiKey,
  configuration: modelConfiguration,
  request = fetch,
}: ResumeClaimModelSettings): ResumeClaimReformulator {
  const configuration = {
    operation: 'resume-claim-writing' as const,
    requester: createModelRequester({ apiKey, configuration: modelConfiguration, request }),
  }
  return {
    reformulate: (reformulation) => reformulateResumeClaim({ configuration, reformulation }),
  }
}

export function createOpenAiResumeClaimSemanticValidator({
  apiKey,
  configuration: modelConfiguration,
  deadlineSignal,
  operation = 'resume-claim-validation',
  request = fetch,
}: ResumeClaimValidationSettings): ResumeClaimSemanticValidator {
  const configuration = {
    deadlineSignal,
    operation,
    requester: createModelRequester({ apiKey, configuration: modelConfiguration, request }),
  }
  return {
    validate: (validationRequest) => validateResumeClaim({ configuration, validationRequest }),
  }
}

async function reformulateResumeClaim({ configuration, reformulation }: Readonly<{
  configuration: ActiveResumeClaimModel
  reformulation: Parameters<ResumeClaimReformulator['reformulate']>[0]
}>) {
  const { claim, feedback, request: candidateRequest, ...writingInputs } = reformulation
  const result = await writeResumeClaims({
    configuration,
    writingInputs,
    revision: { candidateRequest, claim, feedback },
  })
  if (!result.ok) return result
  return result.value.length === 1
    ? { ok: true, value: result.value[0] ?? claim } as const
    : resumeClaimWritingUnavailableResult
}

async function writeResumeClaims({
  configuration,
  revision,
  writingInputs,
}: Readonly<{
  configuration: ActiveResumeClaimModel
  revision?: Readonly<{
    candidateRequest?: string
    claim: unknown
    feedback: readonly unknown[]
  }>
  writingInputs: ResumeClaimWritingInputs
}>) {
  const response = await requestModel({
    ...configuration,
    instructions: writingInstructions,
    output: resumeClaimResponseFormat,
    userValue: revision === undefined ? writingInputs : { ...writingInputs, revision },
  })
  if (!response.ok) return withRequestFailure({ result: resumeClaimWritingUnavailableResult, response })
  return parseWrittenClaims({ value: response.value, writingInputs })
}

function parseWrittenClaims({ value, writingInputs }: Readonly<{
  value: unknown
  writingInputs: ResumeClaimWritingInputs
}>) {
  const parsedClaims = proposedResumeClaimsSchema.safeParse(value)
  if (!parsedClaims.success) return resumeClaimWritingUnavailableResult
  return hasOnlyResumeClaimInputReferences({
    claims: parsedClaims.data.claims,
    inputs: writingInputs,
  })
    ? { ok: true, value: parsedClaims.data.claims } as const
    : resumeClaimWritingUnavailableResult
}

async function validateResumeClaim({
  configuration,
  validationRequest,
}: Readonly<{
  configuration: ActiveResumeClaimModel
  validationRequest: Parameters<ResumeClaimSemanticValidator['validate']>[0]
}>) {
  const response = await requestModel({
    ...configuration,
    instructions: validationInstructions,
    output: resumeClaimValidationResponseFormat,
    userValue: validationRequest,
  })
  if (!response.ok) return withRequestFailure({ result: resumeClaimValidationUnavailableResult, response })
  const validation = resumeClaimSemanticValidationSchema.safeParse(response.value)
  return validation.success
    ? { ok: true, value: validation.data } as const
    : resumeClaimValidationUnavailableResult
}

async function requestModel({
  deadlineSignal,
  instructions,
  operation,
  output,
  requester,
  userValue,
}: ActiveResumeClaimModel & Readonly<{
  instructions: string
  output: Readonly<{ name: string; schema: Readonly<Record<string, unknown>> }>
  userValue: unknown
}>) {
  const response = await requester.send({
    deadlineSignal,
    instructions,
    maxOutputTokens: maximumOutputTokens,
    operation,
    output,
    userText: delimitSuppliedData(userValue),
  })
  return response.ok ? parseModelOutput({ outputText: response.value.text })
    : { ok: false, requestFailure: response.error } as const
}

/** Keeps why a provider call failed, so the Candidate reads the Failure Cause the provider's answer implies. */
function withRequestFailure<TType extends string>({ result, response }: Readonly<{
  result: Readonly<{ ok: false; error: Readonly<{ type: TType }> }>
  response: Readonly<{ ok: false; requestFailure?: ModelRequestFailure }>
}>) {
  return response.requestFailure === undefined ? result
    : { ok: false, error: { ...result.error, apiFailure: readModelApiFailure(response.requestFailure) } } as const
}

const maximumOutputTokens = 12_000

function parseModelOutput({ outputText }: Readonly<{ outputText?: string }>) {
  if (outputText === undefined) return unavailableModelResult
  try {
    return { ok: true, value: JSON.parse(outputText) as unknown } as const
  } catch {
    return unavailableModelResult
  }
}

const writingInstructions = [
  untrustedContentInstruction,
  'Write concise Tailored Resume claims only from the supplied Candidate Facts.',
  'Write every claim in the exact language requested by locale: en means English and fr means French.',
  'Split every claim into the smallest semantic segments and link each segment to every exact fact that supports it.',
  'You may compress, translate, change voice, or omit detail.',
  'Never add or strengthen causality, scope, autonomy, seniority, duration, frequency, quantity, or outcome.',
  'Use only supplied fact identifiers and return one claim when revising a claim.',
  'A Candidate reformulation request changes wording only and can never introduce professional information.',
].join(' ')

const validationInstructions = [
  untrustedContentInstruction,
  'Decide whether every Resume Claim segment is fully supported by its referenced Candidate Facts.',
  'Every referenced fact must directly support that segment; reject unrelated or redundant fact references as inexact-fact-reference.',
  'Reject additions or strengthening of causality, scope, autonomy, seniority, duration, frequency, quantity, or outcome.',
  'Faithful compression, translation, voice changes, and omission are supported.',
  'Return supported false when any semantic fragment goes beyond its referenced facts.',
  'For each failure, return its segmentIndex and the exact failure code as feedback.',
].join(' ')

const resumeClaimResponseFormat = createStructuredOutputFormat({
  name: 'resume_claims',
  schema: proposedResumeClaimsSchema,
})

const resumeClaimValidationResponseFormat = createStructuredOutputFormat({
  name: 'resume_claim_validation',
  schema: resumeClaimSemanticValidationSchema,
})

function createStructuredOutputFormat({ name, schema }: Readonly<{
  name: string
  schema: z.ZodType
}>) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7' })
  const schemaWithoutDialect = Object.fromEntries(Object.entries(jsonSchema)
    .filter(([propertyName]) => propertyName !== '$schema'))
  return { type: 'json_schema', name, strict: true, schema: schemaWithoutDialect } as const
}

const unavailableModelResult = { ok: false } as const
const resumeClaimWritingUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-writing-unavailable' },
} as const
const resumeClaimValidationUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-validation-unavailable' },
} as const
