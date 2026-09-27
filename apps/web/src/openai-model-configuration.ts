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
