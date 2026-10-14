import { z } from 'zod'

import { isQualifiedModelConfiguration } from './model-evaluation/qualified-model-configurations'
import {
  deepSeekStructuredModelConfiguration,
  deepSeekWritingModelConfiguration,
  structuredModelConfiguration,
  writingModelConfiguration,
} from './model-evaluation/model-configurations'
import {
  createDeepSeekModelConfiguration,
  createOpenAiModelConfiguration,
  languageModelProviders,
  openAiReasoningEfforts,
} from './language-model-configuration'
import type {
  ActiveLanguageModel,
  LanguageModelProvider,
  LanguageModelSelection,
  ModelRole,
  OpenAiReasoningEffort,
} from './language-model-configuration'

/** DeepSeek is the provider production runs on (BAK-168), so a server started without a choice behaves like it. */
const providerEnvironmentSchema = z.object({
  LANGUAGE_MODEL_PROVIDER: z.enum(languageModelProviders).default('deepseek'),
})

/** Only the active provider's key is required: a deployment never holds the key of a provider it does not call. */
const providerKeySchemas = {
  deepseek: z.object({ DEEPSEEK_API_KEY: z.string().trim().min(1) }).transform(({ DEEPSEEK_API_KEY }) => DEEPSEEK_API_KEY),
  openai: z.object({ OPENAI_API_KEY: z.string().trim().min(1) }).transform(({ OPENAI_API_KEY }) => OPENAI_API_KEY),
} as const satisfies Record<LanguageModelProvider, z.ZodType<string>>

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

/**
 * DeepSeek's thinking and output budget are frozen per operation in its Qualified Model Configuration, so only the
 * model of each role is a setting.
 */
const deepSeekModelSettingsSchema = z.object({
  DEEPSEEK_STRUCTURED_MODEL: z.string().trim().min(1).default(deepSeekStructuredModelConfiguration.model),
  DEEPSEEK_WRITING_MODEL: z.string().trim().min(1).default(deepSeekWritingModelConfiguration.model),
}).superRefine((environment, context) => {
  for (const role of modelRoles) {
    const path = role === 'structured' ? 'DEEPSEEK_STRUCTURED_MODEL' : 'DEEPSEEK_WRITING_MODEL'
    const configuration = createDeepSeekModelConfiguration({ model: environment[path], role })
    if (isQualifiedModelConfiguration({ configuration })) continue
    context.addIssue({ code: 'custom', message: unqualifiedConfigurationMessage, path: [path] })
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
  const provider = providerEnvironmentSchema.safeParse(environment)
  const key = provider.success ? providerKeySchemas[provider.data.LANGUAGE_MODEL_PROVIDER].safeParse(environment) : undefined
  if (!selection.ok || key?.success !== true) {
    return createInvalidEnvironmentResult({ issues: [
      ...(selection.ok ? [] : selection.error.issues),
      ...(key === undefined || key.success ? [] : readIssues({ issues: key.error.issues })),
    ] })
  }
  const languageModel: ActiveLanguageModel = { apiKey: key.data, ...selection.value }
  return { ok: true, value: { languageModel } } as const
}

/**
 * The active provider and its per-role model settings, without the provider key: what the Processing Policy and the
 * deployment check depend on.
 */
export function readLanguageModelSelection({ environment }: Readonly<{ environment: Record<string, unknown> }>) {
  const provider = providerEnvironmentSchema.safeParse(environment)
  if (!provider.success) return createInvalidEnvironmentResult({ issues: readIssues({ issues: provider.error.issues }) })
  if (provider.data.LANGUAGE_MODEL_PROVIDER === 'deepseek') {
    const settings = deepSeekModelSettingsSchema.safeParse(environment)
    if (!settings.success) return createInvalidEnvironmentResult({ issues: readIssues({ issues: settings.error.issues }) })
    return { ok: true, value: createDeepSeekSelection({ environment: settings.data }) } as const
  }
  const settings = openAiModelSettingsSchema.safeParse(environment)
  if (!settings.success) return createInvalidEnvironmentResult({ issues: readIssues({ issues: settings.error.issues }) })
  return { ok: true, value: createOpenAiSelection({ environment: settings.data }) } as const
}

function createDeepSeekSelection({ environment }: Readonly<{
  environment: z.infer<typeof deepSeekModelSettingsSchema>
}>): LanguageModelSelection {
  return {
    provider: 'deepseek',
    structured: { active: createDeepSeekModelConfiguration({ model: environment.DEEPSEEK_STRUCTURED_MODEL, role: 'structured' }) },
    writing: { active: createDeepSeekModelConfiguration({ model: environment.DEEPSEEK_WRITING_MODEL, role: 'writing' }) },
  }
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
    message: unqualifiedConfigurationMessage,
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
const unqualifiedConfigurationMessage = 'Model configuration has no passing qualification run'
