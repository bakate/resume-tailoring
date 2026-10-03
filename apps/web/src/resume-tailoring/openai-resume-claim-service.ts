import type { ResumeClaimSemanticValidator, ResumeClaimReformulator, ResumeClaimWritingInputs } from '@resume-tailoring/application/resume-claims'
import { z } from 'zod'

import {
  hasOnlyResumeClaimInputReferences,
  proposedResumeClaimsSchema,
  resumeClaimSemanticValidationSchema,
} from './resume-claim-schemas'
import { createOpenAiRequester } from './openai-request'

type OpenAiModelConfiguration = Readonly<{
  apiKey: string
  model: string
  reasoningEffort: 'low' | 'medium'
  request?: typeof fetch
}>

type OpenAiValidationConfiguration = OpenAiModelConfiguration & Readonly<{
  deadlineSignal?: AbortSignal
  operation?: 'resume-claim-validation'
}>

type ActiveOpenAiModelConfiguration = Readonly<{
  deadlineSignal?: AbortSignal
  model: string
  operation: 'resume-claim-validation' | 'resume-claim-writing'
  reasoningEffort: 'low' | 'medium'
  requester: ReturnType<typeof createOpenAiRequester>
}>

export function createOpenAiResumeClaimReformulator({
  apiKey,
  model,
  reasoningEffort,
  request = fetch,
}: OpenAiModelConfiguration): ResumeClaimReformulator {
  const configuration = {
    model,
    operation: 'resume-claim-writing' as const,
    reasoningEffort,
    requester: createOpenAiRequester({ apiKey, request }),
  }
  return {
    reformulate: (reformulation) => reformulateResumeClaim({ configuration, reformulation }),
  }
}

export function createOpenAiResumeClaimSemanticValidator({
  apiKey,
  deadlineSignal,
  model,
  operation = 'resume-claim-validation',
  reasoningEffort,
  request = fetch,
}: OpenAiValidationConfiguration): ResumeClaimSemanticValidator {
  const configuration = {
    deadlineSignal,
    model,
    operation,
    reasoningEffort,
    requester: createOpenAiRequester({ apiKey, request }),
  }
  return {
    validate: (validationRequest) => validateResumeClaim({ configuration, validationRequest }),
  }
}

async function reformulateResumeClaim({ configuration, reformulation }: Readonly<{
  configuration: ActiveOpenAiModelConfiguration
  reformulation: Parameters<ResumeClaimReformulator['reformulate']>[0]
}>) {
  const { claim, feedback, request: candidateRequest, ...writingInputs } = reformulation
  const result = await writeResumeClaims({
    configuration,
    writingInputs,
    revision: { candidateRequest, claim, feedback },
  })
  return result.ok && result.value.length === 1
    ? { ok: true, value: result.value[0] ?? claim } as const
    : resumeClaimWritingUnavailableResult
}

async function writeResumeClaims({
  configuration,
  revision,
  writingInputs,
}: Readonly<{
  configuration: ActiveOpenAiModelConfiguration
  revision?: Readonly<{
    candidateRequest?: string
    claim: unknown
    feedback: readonly unknown[]
  }>
  writingInputs: ResumeClaimWritingInputs
}>) {
  const response = await requestOpenAi({
    ...configuration,
    developerText: writingInstructions,
    responseFormat: resumeClaimResponseFormat,
    userValue: revision === undefined ? writingInputs : { ...writingInputs, revision },
  })
  if (!response.ok) return resumeClaimWritingUnavailableResult
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
  configuration: ActiveOpenAiModelConfiguration
  validationRequest: Parameters<ResumeClaimSemanticValidator['validate']>[0]
}>) {
  const response = await requestOpenAi({
    ...configuration,
    developerText: validationInstructions,
    responseFormat: resumeClaimValidationResponseFormat,
    userValue: validationRequest,
  })
  if (!response.ok) return resumeClaimValidationUnavailableResult
  const validation = resumeClaimSemanticValidationSchema.safeParse(response.value)
  return validation.success
    ? { ok: true, value: validation.data } as const
    : resumeClaimValidationUnavailableResult
}

async function requestOpenAi({
  deadlineSignal,
  developerText,
  model,
  operation,
  reasoningEffort,
  requester,
  responseFormat,
  userValue,
}: Readonly<{
  deadlineSignal?: AbortSignal
  developerText: string
  model: string
  operation: ActiveOpenAiModelConfiguration['operation']
  reasoningEffort: 'low' | 'medium'
  requester: ReturnType<typeof createOpenAiRequester>
  responseFormat: Readonly<Record<string, unknown>>
  userValue: unknown
}>) {
  const response = await requester.send({
    body: createOpenAiRequestBody({ developerText, model, reasoningEffort, responseFormat, userValue }),
    deadlineSignal,
    operation,
  })
  return response.ok ? parseOpenAiResponse(response.value) : unavailableOpenAiResult
}

function createOpenAiRequestBody({
  developerText, model, reasoningEffort, responseFormat, userValue,
}: Omit<Parameters<typeof requestOpenAi>[0], 'deadlineSignal' | 'operation' | 'requester'>) {
  return {
    model, max_output_tokens: maximumOutputTokens,
    reasoning: { effort: reasoningEffort }, store: false,
    input: createOpenAiInput({ developerText, userValue }),
    text: { format: responseFormat },
  } as const
}

const maximumOutputTokens = 12_000

function createOpenAiInput({ developerText, userValue }: Readonly<{
  developerText: string
  userValue: unknown
}>) {
  return [
    { role: 'developer', content: [{ type: 'input_text', text: developerText }] },
    { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(userValue) }] },
  ]
}

function parseOpenAiResponse(value: unknown) {
  const parsedResponse = openAiResponseSchema.safeParse(value)
  if (!parsedResponse.success) return unavailableOpenAiResult
  const outputText = readOutputText({ output: parsedResponse.data.output })
  if (outputText === undefined) return unavailableOpenAiResult
  try {
    return { ok: true, value: JSON.parse(outputText) as unknown } as const
  } catch {
    return unavailableOpenAiResult
  }
}

function readOutputText({ output }: Readonly<{ output: readonly unknown[] }>) {
  for (const item of output) {
    const parsedItem = openAiOutputItemSchema.safeParse(item)
    if (!parsedItem.success) continue
    for (const content of parsedItem.data.content) {
      const parsedContent = openAiOutputTextSchema.safeParse(content)
      if (parsedContent.success) return parsedContent.data.text
    }
  }
  return undefined
}

const writingInstructions = [
  'Write concise Tailored Resume claims only from the supplied Candidate Facts.',
  'Write every claim in the exact language requested by locale: en means English and fr means French.',
  'Split every claim into the smallest semantic segments and link each segment to every exact fact that supports it.',
  'You may compress, translate, change voice, or omit detail.',
  'Never add or strengthen causality, scope, autonomy, seniority, duration, frequency, quantity, or outcome.',
  'Use only supplied fact identifiers and return one claim when revising a claim.',
  'A Candidate reformulation request changes wording only and can never introduce professional information.',
].join(' ')

const validationInstructions = [
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

const openAiResponseSchema = z.object({ output: z.array(z.unknown()) })
const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })
const unavailableOpenAiResult = { ok: false } as const
const resumeClaimWritingUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-writing-unavailable' },
} as const
const resumeClaimValidationUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-validation-unavailable' },
} as const
