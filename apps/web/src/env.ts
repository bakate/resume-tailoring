import { z } from 'zod'

const defaultOpenAiStructuredModel = 'gpt-6-luna'
const defaultOpenAiStructuredReasoningEffort = 'low'
const defaultOpenAiWritingModel = 'gpt-6-sol'
const defaultOpenAiWritingReasoningEffort = 'medium'

const serverEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_STRUCTURED_MODEL: z.literal(defaultOpenAiStructuredModel)
    .default(defaultOpenAiStructuredModel),
  OPENAI_STRUCTURED_REASONING_EFFORT: z.literal(defaultOpenAiStructuredReasoningEffort)
    .default(defaultOpenAiStructuredReasoningEffort),
  OPENAI_WRITING_MODEL: z.literal(defaultOpenAiWritingModel).default(defaultOpenAiWritingModel),
  OPENAI_WRITING_REASONING_EFFORT: z.literal(defaultOpenAiWritingReasoningEffort)
    .default(defaultOpenAiWritingReasoningEffort),
})

export type ServerEnvironment = Readonly<{
  openAiApiKey: string
  openAiStructuredModel: string
  openAiStructuredReasoningEffort: typeof defaultOpenAiStructuredReasoningEffort
  openAiWritingModel: string
  openAiWritingReasoningEffort: typeof defaultOpenAiWritingReasoningEffort
}>

export function validateServerEnvironment({
  environment,
}: Readonly<{ environment: Record<string, unknown> }>) {
  const result = serverEnvironmentSchema.safeParse(environment)
  if (!result.success) return createInvalidEnvironmentResult({ issues: result.error.issues })
  return {
    ok: true,
    value: {
      openAiApiKey: result.data.OPENAI_API_KEY,
      openAiStructuredModel: result.data.OPENAI_STRUCTURED_MODEL,
      openAiStructuredReasoningEffort: result.data.OPENAI_STRUCTURED_REASONING_EFFORT,
      openAiWritingModel: result.data.OPENAI_WRITING_MODEL,
      openAiWritingReasoningEffort: result.data.OPENAI_WRITING_REASONING_EFFORT,
    },
  } as const
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
