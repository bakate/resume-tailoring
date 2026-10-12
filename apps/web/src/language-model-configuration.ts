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

/** Every Language Model Provider a Qualified Model Configuration may name. */
export const languageModelProviders = ['openai'] as const

export type LanguageModelProvider = typeof languageModelProviders[number]

/** OpenAI requests are stateless and answer under strict Structured Outputs; only the reasoning effort varies. */
export type OpenAiProviderOptions = Readonly<{
  reasoningEffort: OpenAiReasoningEffort
  store: false
  strictJsonSchema: true
}>

/**
 * One provider, one model and one model role with frozen provider options. Only a configuration a recorded
 * qualification baseline backs is ever used to send Candidate content.
 */
export type LanguageModelConfiguration = Readonly<{
  provider: 'openai'
  model: string
  role: ModelRole
  providerOptions: OpenAiProviderOptions
}>

type ProviderModelConfiguration<TProvider extends LanguageModelProvider> =
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
}>): LanguageModelConfiguration {
  return { provider: 'openai', model, role, providerOptions: { reasoningEffort, store: false, strictJsonSchema: true } }
}
