import type {
  ResumeClaimSemanticValidator,
  ResumeClaimWriter,
  ResumeClaimWritingInputs,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import {
  hasOnlyResumeClaimInputReferences,
  proposedResumeClaimsSchema,
} from './resume-claim-schemas'

type OpenAiModelConfiguration = Readonly<{
  apiKey: string
  model: string
  reasoningEffort: 'low' | 'medium'
  request?: typeof fetch
}>

type ActiveOpenAiModelConfiguration = Readonly<{
  apiKey: string
  model: string
  reasoningEffort: 'low' | 'medium'
  request: typeof fetch
}>

export function createOpenAiResumeClaimWriter({
  apiKey,
  model,
  reasoningEffort,
  request = fetch,
}: OpenAiModelConfiguration): ResumeClaimWriter {
  const configuration = { apiKey, model, reasoningEffort, request }
  return {
    write: (writingInputs) => writeResumeClaims({ configuration, writingInputs }),
    reformulate: (reformulation) => reformulateResumeClaim({ configuration, reformulation }),
  }
}

export function createOpenAiResumeClaimSemanticValidator({
  apiKey,
  model,
  reasoningEffort,
  request = fetch,
}: OpenAiModelConfiguration): ResumeClaimSemanticValidator {
  const configuration = { apiKey, model, reasoningEffort, request }
  return {
    validate: (validationRequest) => validateResumeClaim({ configuration, validationRequest }),
  }
}

async function reformulateResumeClaim({ configuration, reformulation }: Readonly<{
  configuration: ActiveOpenAiModelConfiguration
  reformulation: Parameters<ResumeClaimWriter['reformulate']>[0]
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
  const validation = semanticValidationSchema.safeParse(response.value)
  return validation.success
    ? { ok: true, value: validation.data } as const
    : resumeClaimValidationUnavailableResult
}

async function requestOpenAi({
  apiKey,
  developerText,
  model,
  reasoningEffort,
  request,
  responseFormat,
  userValue,
}: Readonly<{
  apiKey: string
  developerText: string
  model: string
  reasoningEffort: 'low' | 'medium'
  request: typeof fetch
  responseFormat: Readonly<Record<string, unknown>>
  userValue: unknown
}>) {
  try {
    const response = await request('https://api.openai.com/v1/responses', createOpenAiRequest({
      apiKey, developerText, model, reasoningEffort, responseFormat, userValue,
    }))
    if (!response.ok) return unavailableOpenAiResult
    return parseOpenAiResponse(await response.json())
  } catch {
    return unavailableOpenAiResult
  }
}

function createOpenAiRequest({
  apiKey, developerText, model, reasoningEffort, responseFormat, userValue,
}: Omit<Parameters<typeof requestOpenAi>[0], 'request'>) {
  return {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, reasoning: { effort: reasoningEffort }, store: false,
      input: createOpenAiInput({ developerText, userValue }),
      text: { format: responseFormat },
    }),
    signal: AbortSignal.timeout(resumeClaimTimeoutMilliseconds),
  } as const
}

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
  return { ok: true, value: JSON.parse(outputText) as unknown } as const
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
  'Write concise Tailored Resume claims only from the supplied Verified Facts.',
  'Split every claim into the smallest semantic segments and link each segment to every exact fact that supports it.',
  'You may compress, translate, change voice, or omit detail.',
  'Never add or strengthen causality, scope, autonomy, seniority, duration, frequency, quantity, or outcome.',
  'Use only supplied fact identifiers and return one claim when revising a claim.',
  'A Candidate reformulation request changes wording only and can never introduce professional information.',
].join(' ')

const validationInstructions = [
  'Decide whether every Resume Claim segment is fully supported by its referenced Verified Facts.',
  'Reject additions or strengthening of causality, scope, autonomy, seniority, duration, frequency, quantity, or outcome.',
  'Faithful compression, translation, voice changes, and omission are supported.',
  'Return supported false when any semantic fragment goes beyond its referenced facts.',
  'For each failure, return its segmentIndex and the exact strengthened dimension as feedback.',
].join(' ')

const segmentJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'factIds'],
  properties: {
    text: { type: 'string', minLength: 1, maxLength: 500 },
    factIds: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: { type: 'string', pattern: '^source-fact-.+$' },
    },
  },
} as const

const resumeClaimResponseFormat = {
  type: 'json_schema',
  name: 'resume_claims',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['claims'],
    properties: {
      claims: {
        type: 'array',
        maxItems: 100,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['segments'],
          properties: {
            segments: { type: 'array', minItems: 1, maxItems: 20, items: segmentJsonSchema },
          },
        },
      },
    },
  },
} as const

const resumeClaimValidationResponseFormat = {
  type: 'json_schema',
  name: 'resume_claim_validation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['supported', 'feedback'],
    properties: {
      supported: { type: 'boolean' },
      feedback: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['code', 'segmentIndex'],
          properties: {
            code: {
              type: 'string',
              enum: [
                'unsupported-meaning',
                'strengthened-autonomy',
                'strengthened-causality',
                'strengthened-duration',
                'strengthened-frequency',
                'strengthened-outcome',
                'strengthened-quantity',
                'strengthened-scope',
                'strengthened-seniority',
              ],
            },
            segmentIndex: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
  },
} as const

const openAiResponseSchema = z.object({ output: z.array(z.unknown()) })
const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })
const semanticValidationSchema = z.object({
  supported: z.boolean(),
  feedback: z.array(z.object({
    code: z.enum([
      'unsupported-meaning',
      'strengthened-autonomy',
      'strengthened-causality',
      'strengthened-duration',
      'strengthened-frequency',
      'strengthened-outcome',
      'strengthened-quantity',
      'strengthened-scope',
      'strengthened-seniority',
    ]),
    segmentIndex: z.number().int().min(0),
  })).max(20),
}).superRefine((validation, context) => {
  if (!validation.supported && validation.feedback.length === 0) {
    context.addIssue({ code: 'custom', path: ['feedback'], message: 'Feedback is required' })
  }
  if (validation.supported && validation.feedback.length > 0) {
    context.addIssue({ code: 'custom', path: ['feedback'], message: 'Feedback must be empty' })
  }
})
const resumeClaimTimeoutMilliseconds = 30_000
const unavailableOpenAiResult = { ok: false } as const
const resumeClaimWritingUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-writing-unavailable' },
} as const
const resumeClaimValidationUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-validation-unavailable' },
} as const
