export const openAiReasoningEfforts = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const

export type OpenAiReasoningEffort = typeof openAiReasoningEfforts[number]

export type ModelRole = 'structured' | 'writing'

/** The model-backed operations each model role performs. */
export const modelRoleOperations = {
  structured: [
    'explainable-job-posting-extraction',
    'explainable-match-evidence',
    'resume-claim-validation',
    'resume-document-coherence',
    'resume-section-validation',
    'structured-source-profile-extraction',
  ],
  writing: ['resume-claim-writing', 'resume-section-writing'],
} as const satisfies Record<ModelRole, readonly string[]>

export type ModelOperation = typeof modelRoleOperations[ModelRole][number]

/** Every Language Model Provider a Qualified Model Configuration may name. */
export const languageModelProviders = ['openai', 'deepseek'] as const

export type LanguageModelProvider = typeof languageModelProviders[number]

/** The environment variable holding each provider's operator key. */
export const languageModelApiKeyVariables = {
  deepseek: 'DEEPSEEK_API_KEY',
  openai: 'OPENAI_API_KEY',
} as const satisfies Record<LanguageModelProvider, string>

/**
 * What one operation may spend: its output token budget, reasoning included where the provider counts it there, and
 * the deadline of the whole operation, a conformance retry included. Both are qualified with the rest.
 */
export type ModelOperationSettings = Readonly<{
  deadlineMilliseconds: number
  maxOutputTokens: number
}>

type OperationSettingsByOperation<TSettings extends ModelOperationSettings> = Readonly<Partial<Record<ModelOperation, TSettings>>>

/** OpenAI requests are stateless and answer under strict Structured Outputs; only the reasoning effort varies. */
export type OpenAiProviderOptions = Readonly<{
  reasoningEffort: OpenAiReasoningEffort
  store: false
  strictJsonSchema: true
}>

/** DeepSeek thinks or not per operation; `low`, `high` and `max` are the only efforts it accepts. */
export const deepSeekThinkingModes = ['disabled', 'low', 'high', 'max'] as const

export type DeepSeekThinkingMode = typeof deepSeekThinkingModes[number]

export type DeepSeekOperationSettings = ModelOperationSettings & Readonly<{ thinking: DeepSeekThinkingMode }>

/**
 * One provider, one model and one model role with frozen provider options and per-operation settings. Only a
 * configuration a recorded qualification baseline backs is ever used to send Candidate content.
 */
export type LanguageModelConfiguration =
  | Readonly<{
    provider: 'openai'
    model: string
    role: ModelRole
    providerOptions: OpenAiProviderOptions
    operations: OperationSettingsByOperation<ModelOperationSettings>
  }>
  | Readonly<{
    provider: 'deepseek'
    model: string
    role: ModelRole
    operations: OperationSettingsByOperation<DeepSeekOperationSettings>
  }>

export type ProviderModelConfiguration<TProvider extends LanguageModelProvider> =
  Extract<LanguageModelConfiguration, Readonly<{ provider: TProvider }>>

/** A role's configuration and its optional fallback, which never names another provider than the active one. */
export type RoleModelConfigurations<TProvider extends LanguageModelProvider> = Readonly<{
  active: ProviderModelConfiguration<TProvider>
  fallback?: ProviderModelConfiguration<TProvider>
}>

/** The one Language Model Provider every model role uses, with each role's Qualified Model Configurations. */
export type LanguageModelSelection = {
  [TProvider in LanguageModelProvider]: Readonly<{
    provider: TProvider
    structured: RoleModelConfigurations<TProvider>
    writing: RoleModelConfigurations<TProvider>
  }>
}[LanguageModelProvider]

/** The selection with the key that signs its requests. */
export type ActiveLanguageModel = LanguageModelSelection & Readonly<{ apiKey: string }>

export function createOpenAiModelConfiguration({ model, reasoningEffort, role }: Readonly<{
  model: string
  reasoningEffort: OpenAiReasoningEffort
  role: ModelRole
}>): ProviderModelConfiguration<'openai'> {
  return { provider: 'openai', model, role, providerOptions: { reasoningEffort, store: false, strictJsonSchema: true },
    operations: selectRoleOperations<ModelOperationSettings>({ role, settings: openAiOperationSettings }) }
}

export function createDeepSeekModelConfiguration({ model, role }: Readonly<{
  model: string
  role: ModelRole
}>): ProviderModelConfiguration<'deepseek'> {
  return { provider: 'deepseek', model, role, operations: selectRoleOperations<DeepSeekOperationSettings>({ role, settings: deepSeekOperationSettings }) }
}

/** The settings of the operation a configuration's role performs; another role's operation has none. */
export function readModelOperationSettings<TConfiguration extends LanguageModelConfiguration>({ configuration, operation }: Readonly<{
  configuration: TConfiguration
  operation: ModelOperation
}>): NonNullable<TConfiguration['operations'][ModelOperation]> {
  const settings = configuration.operations[operation] as TConfiguration['operations'][ModelOperation]
  if (settings === undefined) throw new Error(`The ${configuration.role} role does not perform ${operation}`)
  return settings
}

function selectRoleOperations<TSettings extends ModelOperationSettings>({ role, settings }: Readonly<{
  role: ModelRole
  settings: Readonly<Record<ModelOperation, TSettings>>
}>) {
  return Object.fromEntries(modelRoleOperations[role].map((operation) => [operation, settings[operation]])) as
    OperationSettingsByOperation<TSettings>
}

/** The Lambda answers within 120 s (`template.yaml`); every operation deadline leaves it time to answer. */
const defaultDeadlineMilliseconds = 90_000

/** OpenAI counts reasoning apart from the answer, so these budgets bound the answer alone. */
const openAiOperationSettings = {
  'explainable-job-posting-extraction': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 20_000 },
  'explainable-match-evidence': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 8_000 },
  'resume-claim-validation': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 12_000 },
  'resume-claim-writing': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 12_000 },
  'resume-document-coherence': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 8_000 },
  'resume-section-validation': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 8_000 },
  'resume-section-writing': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 16_000 },
  'structured-source-profile-extraction': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 16_000 },
} as const satisfies Record<ModelOperation, ModelOperationSettings>

/**
 * The most reasoning tokens DeepSeek spent per call in the BAK-171 spike (`docs/evaluations/deepseek-spike-2026-10.md`):
 * up to 10,600 on extraction at `low`, and 1,475 on section writing at `high`. Unmeasured operations are assumed alike;
 * `max` was not measured, so no operation uses it.
 */
export const deepSeekMeasuredReasoningTokens = { disabled: 0, low: 10_600, high: 1_475 } as const satisfies
  Partial<Record<DeepSeekThinkingMode, number>>

/**
 * DeepSeek counts reasoning inside `max_tokens`, so each budget is the OpenAI answer budget of the operation plus the
 * reasoning measured at its thinking mode, rounded up for headroom. Match evidence gets the 32,000 the spike needed:
 * at 8,000, 7 of 20 answers came back empty or truncated. Its p95 was 82 s at `low`, hence its longer deadline.
 * Source Profile extraction thinks not at all: it was conformant and fully source-backed without, at a fraction of the
 * latency. Job Posting extraction thinks at `low`: without thinking, BAK-167 measured its recall at about 60% (generic
 * duties split, distinct technologies merged) against about 94% at `low`, for 15–21 s and under 4,000 tokens.
 */
const deepSeekOperationSettings = {
  'explainable-job-posting-extraction': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 31_000, thinking: 'low' },
  'explainable-match-evidence': { deadlineMilliseconds: 110_000, maxOutputTokens: 32_000, thinking: 'low' },
  'resume-claim-validation': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 24_000, thinking: 'low' },
  'resume-claim-writing': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 16_000, thinking: 'high' },
  'resume-document-coherence': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 20_000, thinking: 'low' },
  'resume-section-validation': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 20_000, thinking: 'low' },
  'resume-section-writing': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 20_000, thinking: 'high' },
  'structured-source-profile-extraction': { deadlineMilliseconds: defaultDeadlineMilliseconds, maxOutputTokens: 16_000, thinking: 'disabled' },
} as const satisfies Record<ModelOperation, DeepSeekOperationSettings>
