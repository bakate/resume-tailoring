import { z } from 'zod'

import { isQualifiedModelConfiguration } from './model-evaluation/qualified-model-configurations'
import { structuredModelConfiguration, writingModelConfiguration } from './model-evaluation/model-configurations'
import { createOpenAiModelConfiguration, languageModelProviders, openAiReasoningEfforts } from './language-model-configuration'
import type { ActiveLanguageModel, LanguageModelSelection, ModelRole, OpenAiReasoningEffort } from './language-model-configuration'

const providerEnvironmentSchema = z.object({
  LANGUAGE_MODEL_PROVIDER: z.enum(languageModelProviders).default('openai'),
})

const openAiKeySchema = z.object({ OPENAI_API_KEY: z.string().trim().min(1) })

const openAiModelSettingsSchema = z.object({
  OPENAI_STRUCTURED_FALLBACK_MODEL: z.string().trim().min(1).optional(),
  OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT: z.enum(openAiReasoningEfforts).optional(),
  OPENAI_STRUCTURED_MODEL: z.string().trim().min(1).default(structuredModelConfiguration.model),
  OPENAI_STRUCTURED_REASONING_EFFORT: z.enum(openAiReasoningEfforts)
    .default(structuredModelConfiguration.providerOptions.reasoningEffort),
  OPENAI_WRITING_FALLBACK_MODEL: z.string().trim().min(1).optional(),
  OPENAI_WRITING_FALLBACK_REASONING_EFFORT: z.enum(openAiReasoningEfforts).optional(),
  OPENAI_WRITING_MODEL: z.string().trim().min(1).default(writingModelConfiguration.model),
  OPENAI_WRITING_REASONING_EFFORT: z.enum(openAiReasoningEfforts)
    .default(writingModelConfiguration.providerOptions.reasoningEffort),
}).superRefine((environment, context) => {
  for (const role of modelRoles) {
    const settings = readOpenAiRoleSettings({ environment, role })
    validateConfiguration({ context, path: settings.modelPath, role, ...settings.active })
    if (settings.fallback.model === undefined && settings.fallback.reasoningEffort === undefined) continue
    validateConfiguration({ context, path: settings.fallbackModelPath, role, ...settings.fallback })
  }
})

export type ServerEnvironment = Readonly<{ languageModel: ActiveLanguageModel }>

/**
 * Exactly one Language Model Provider is active, chosen by `LANGUAGE_MODEL_PROVIDER`. The server refuses a provider, a
 * model or a reasoning effort that no Qualified Model Configuration backs.
 */
export function validateServerEnvironment({
  environment,
}: Readonly<{ environment: Record<string, unknown> }>) {
  const selection = readLanguageModelSelection({ environment })
  const key = openAiKeySchema.safeParse(environment)
  if (!selection.ok || !key.success) {
    return createInvalidEnvironmentResult({ issues: [
      ...(selection.ok ? [] : selection.error.issues),
      ...(key.success ? [] : readIssues({ issues: key.error.issues })),
    ] })
  }
  const languageModel: ActiveLanguageModel = { apiKey: key.data.OPENAI_API_KEY, ...selection.value }
  return { ok: true, value: { languageModel } } as const
}

/**
 * The active provider and its per-role model settings, without the provider key: what the Processing Policy and the
 * deployment check depend on.
 */
export function readLanguageModelSelection({ environment }: Readonly<{ environment: Record<string, unknown> }>) {
  const provider = providerEnvironmentSchema.safeParse(environment)
  if (!provider.success) return createInvalidEnvironmentResult({ issues: readIssues({ issues: provider.error.issues }) })
  const settings = openAiModelSettingsSchema.safeParse(environment)
  if (!settings.success) return createInvalidEnvironmentResult({ issues: readIssues({ issues: settings.error.issues }) })
  return { ok: true, value: createOpenAiSelection({ environment: settings.data }) } as const
}

type OpenAiEnvironment = z.infer<typeof openAiModelSettingsSchema>
type ModelSettings = Readonly<{ model?: string; reasoningEffort?: OpenAiReasoningEffort }>

function createOpenAiSelection({ environment }: Readonly<{ environment: OpenAiEnvironment }>): LanguageModelSelection {
  return {
    provider: 'openai',
    structured: createRoleConfigurations({ environment, role: 'structured' }),
    writing: createRoleConfigurations({ environment, role: 'writing' }),
  }
}

function createRoleConfigurations({ environment, role }: Readonly<{ environment: OpenAiEnvironment; role: ModelRole }>) {
  const { active, fallback } = readOpenAiRoleSettings({ environment, role })
  const fallbackConfiguration = createConfiguration({ role, ...fallback })
  return {
    active: createOpenAiModelConfiguration({ role, ...active }),
    ...(fallbackConfiguration === undefined ? {} : { fallback: fallbackConfiguration }),
  }
}

function readOpenAiRoleSettings({ environment, role }: Readonly<{ environment: OpenAiEnvironment; role: ModelRole }>) {
  return role === 'structured'
    ? {
        active: { model: environment.OPENAI_STRUCTURED_MODEL, reasoningEffort: environment.OPENAI_STRUCTURED_REASONING_EFFORT },
        fallback: { model: environment.OPENAI_STRUCTURED_FALLBACK_MODEL,
          reasoningEffort: environment.OPENAI_STRUCTURED_FALLBACK_REASONING_EFFORT },
        fallbackModelPath: 'OPENAI_STRUCTURED_FALLBACK_MODEL',
        modelPath: 'OPENAI_STRUCTURED_MODEL',
      }
    : {
        active: { model: environment.OPENAI_WRITING_MODEL, reasoningEffort: environment.OPENAI_WRITING_REASONING_EFFORT },
        fallback: { model: environment.OPENAI_WRITING_FALLBACK_MODEL,
          reasoningEffort: environment.OPENAI_WRITING_FALLBACK_REASONING_EFFORT },
        fallbackModelPath: 'OPENAI_WRITING_FALLBACK_MODEL',
        modelPath: 'OPENAI_WRITING_MODEL',
      }
}

function createConfiguration({ model, reasoningEffort, role }: ModelSettings & Readonly<{ role: ModelRole }>) {
  if (model === undefined || reasoningEffort === undefined) return undefined
  return createOpenAiModelConfiguration({ model, reasoningEffort, role })
}

function validateConfiguration({ context, path, ...settings }: ModelSettings & Readonly<{
  context: z.core.$RefinementCtx
  path: string
  role: ModelRole
}>) {
  const configuration = createConfiguration(settings)
  if (configuration !== undefined && isQualifiedModelConfiguration({ configuration })) return
  context.addIssue({
    code: 'custom',
    message: 'Model configuration has not passed the reference evaluation suite',
    path: [path],
  })
}

/** An issue names the setting and the rule it breaks, never the value it holds. */
function readIssues({ issues }: Readonly<{ issues: readonly z.core.$ZodIssue[] }>) {
  return issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
}

function createInvalidEnvironmentResult({ issues }: Readonly<{ issues: readonly string[] }>) {
  return { ok: false, error: { type: 'invalid-server-environment', issues } } as const
}

const modelRoles = ['structured', 'writing'] as const satisfies readonly ModelRole[]
