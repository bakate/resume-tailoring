import { z } from 'zod'

const defaultOpenAiStructuredModel = 'gpt-6-luna'

const serverEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().trim().min(1),
  OPENAI_STRUCTURED_MODEL: z.string().trim().min(1).default(defaultOpenAiStructuredModel),
})

export type ServerEnvironment = Readonly<{
  openAiApiKey: string
  openAiStructuredModel: string
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
