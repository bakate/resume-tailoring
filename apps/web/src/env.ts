import { z } from 'zod'

import { isQualifiedModelConfiguration } from './model-evaluation/qualified-model-configurations'
import { openAiReasoningEfforts } from './openai-model-configuration'

const defaultOpenAiStructuredModel = 'gpt-6-luna'
const defaultOpenAiStructuredReasoningEffort = 'low'
const defaultOpenAiWritingModel = 'gpt-6-sol'
const defaultOpenAiWritingReasoningEffort = 'medium'

const serverEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_STRUCTURED_FALLBACK_MODEL: z.string().trim().min(1).optional(),
  OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT: z.enum(openAiReasoningEfforts).optional(),
  OPENAI_STRUCTURED_MODEL: z.literal(defaultOpenAiStructuredModel)
    .default(defaultOpenAiStructuredModel),
  OPENAI_STRUCTURED_REASONING_EFFORT: z.literal(defaultOpenAiStructuredReasoningEffort)
    .default(defaultOpenAiStructuredReasoningEffort),
  OPENAI_WRITING_MODEL: z.literal(defaultOpenAiWritingModel).default(defaultOpenAiWritingModel),
  OPENAI_WRITING_FALLBACK_MODEL: z.string().trim().min(1).optional(),
  OPENAI_WRITING_FALLBACK_REASONING_EFFORT: z.enum(openAiReasoningEfforts).optional(),
  OPENAI_WRITING_REASONING_EFFORT: z.literal(defaultOpenAiWritingReasoningEffort)
    .default(defaultOpenAiWritingReasoningEffort),
}).superRefine((environment, context) => {
  validateFallback({
    context,
    model: environment.OPENAI_STRUCTURED_FALLBACK_MODEL,
    modelPath: 'OPENAI_STRUCTURED_FALLBACK_MODEL',
    reasoningEffort: environment.OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT,
    role: 'structured',
  })
  validateFallback({
    context,
    model: environment.OPENAI_WRITING_FALLBACK_MODEL,
    modelPath: 'OPENAI_WRITING_FALLBACK_MODEL',
    reasoningEffort: environment.OPENAI_WRITING_FALLBACK_REASONING_EFFORT,
    role: 'writing',
  })
})

export type ServerEnvironment = Readonly<{
  openAiApiKey: string
  openAiStructuredFallback?: Readonly<{ model: string; reasoningEffort: string }>
  openAiStructuredModel: string
  openAiStructuredReasoningEffort: typeof defaultOpenAiStructuredReasoningEffort
  openAiWritingModel: string
  openAiWritingFallback?: Readonly<{ model: string; reasoningEffort: string }>
  openAiWritingReasoningEffort: typeof defaultOpenAiWritingReasoningEffort
}>

type FallbackValidation = Readonly<{
  context: z.core.$RefinementCtx
  model?: string
  modelPath: string
  reasoningEffort?: string
  role: 'structured' | 'writing'
}>

export function validateServerEnvironment({
  environment,
}: Readonly<{ environment: Record<string, unknown> }>) {
  const result = serverEnvironmentSchema.safeParse(environment)
  if (!result.success) return createInvalidEnvironmentResult({ issues: result.error.issues })
  return { ok: true, value: createServerEnvironment({ environment: result.data }) } as const
}

function createServerEnvironment({
  environment,
}: Readonly<{ environment: z.infer<typeof serverEnvironmentSchema> }>): ServerEnvironment {
  return {
    openAiApiKey: environment.OPENAI_API_KEY,
    ...createFallbacks({ environment }),
    openAiStructuredModel: environment.OPENAI_STRUCTURED_MODEL,
    openAiStructuredReasoningEffort: environment.OPENAI_STRUCTURED_REASONING_EFFORT,
    openAiWritingModel: environment.OPENAI_WRITING_MODEL,
    openAiWritingReasoningEffort: environment.OPENAI_WRITING_REASONING_EFFORT,
  }
}

function createFallbacks({
  environment,
}: Readonly<{ environment: z.infer<typeof serverEnvironmentSchema> }>) {
  return {
    openAiStructuredFallback: createFallback({
      model: environment.OPENAI_STRUCTURED_FALLBACK_MODEL,
      reasoningEffort: environment.OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT,
    }),
    openAiWritingFallback: createFallback({
      model: environment.OPENAI_WRITING_FALLBACK_MODEL,
      reasoningEffort: environment.OPENAI_WRITING_FALLBACK_REASONING_EFFORT,
    }),
  }
}

function validateFallback({
  context,
  model,
  modelPath,
  reasoningEffort,
  role,
}: FallbackValidation) {
  if (model === undefined && reasoningEffort === undefined) return
  if (model !== undefined && reasoningEffort !== undefined
    && isQualifiedModelConfiguration({ model, reasoningEffort, role })) return
  context.addIssue({
    code: 'custom',
    message: 'Fallback model configuration has not passed the reference evaluation suite',
    path: [modelPath],
  })
}

function createFallback({
  model,
  reasoningEffort,
}: Readonly<{ model?: string; reasoningEffort?: string }>) {
  if (model === undefined || reasoningEffort === undefined) return undefined
  return { model, reasoningEffort }
}

function createInvalidEnvironmentResult({
  issues,
}: Readonly<{ issues: readonly z.core.$ZodIssue[] }>) {
  return {
    ok: false,
    error: {
      type: 'invalid-server-environment',
      issues: issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    },
  } as const
}
