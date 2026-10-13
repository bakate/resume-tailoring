/**
 * Transport doubles shaped as DeepSeek's Chat Completions API answers over HTTP: one choice holding the reasoning and
 * the JSON-mode content, with the reason the model stopped. Tests read model output through these.
 */
export function createRecordedDeepSeekResponse({
  finishReason = 'stop',
  outputText,
  usage = { inputTokens: 120, outputTokens: 40 },
}: Readonly<{
  finishReason?: 'content_filter' | 'insufficient_system_resource' | 'length' | 'stop'
  outputText?: string
  /** `null` leaves usage out, as a response that reports none. */
  usage?: Readonly<{ inputTokens: number; outputTokens: number }> | null
}>) {
  return Response.json({
    id: 'chatcmpl-recorded',
    object: 'chat.completion',
    created: 1_790_000_000,
    model: 'deepseek-flash',
    choices: [{
      index: 0,
      // DeepSeek answers an empty content rather than none, even in JSON mode.
      message: { role: 'assistant', content: outputText ?? '', reasoning_content: 'Recorded reasoning.' },
      finish_reason: finishReason,
    }],
    ...(usage === null ? {} : { usage: {
      prompt_tokens: usage.inputTokens,
      prompt_cache_hit_tokens: 0,
      prompt_cache_miss_tokens: usage.inputTokens,
      completion_tokens: usage.outputTokens,
      completion_tokens_details: { reasoning_tokens: Math.floor(usage.outputTokens / 2) },
      total_tokens: usage.inputTokens + usage.outputTokens,
    } }),
  })
}

/** A Chat Completions error answer, as DeepSeek sends it. */
export function createRecordedDeepSeekError({
  code = 'invalid_request_error',
  headers,
  message = 'The request failed.',
  status,
}: Readonly<{
  code?: string | null
  headers?: Readonly<Record<string, string>>
  message?: string
  status: number
}>) {
  return Response.json({ error: { code, message, param: null, type: 'invalid_request_error' } }, { headers, status })
}
