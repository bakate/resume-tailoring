/**
 * Transport doubles shaped as the Responses API answers over HTTP: a reasoning item, then one assistant message holding
 * the output text. Tests read model output through these instead of a hand-trimmed envelope the AI SDK would reject.
 */
export function createRecordedOpenAiResponse({
  incompleteReason,
  outputText,
  usage = { inputTokens: 120, outputTokens: 40 },
}: Readonly<{
  incompleteReason?: 'content_filter' | 'max_output_tokens'
  outputText?: string
  /** `null` leaves usage out, as a response that reports none. */
  usage?: Readonly<{ inputTokens: number; outputTokens: number }> | null
}>) {
  return Response.json({
    id: 'resp_recorded',
    object: 'response',
    created_at: 1_790_000_000,
    status: incompleteReason === undefined ? 'completed' : 'incomplete',
    incomplete_details: incompleteReason === undefined ? null : { reason: incompleteReason },
    model: 'gpt-6-luna',
    output: [
      { type: 'reasoning', id: 'rs_recorded', summary: [], encrypted_content: 'recorded-encrypted-reasoning' },
      ...(outputText === undefined ? [] : [{
        type: 'message', id: 'msg_recorded', status: 'completed', role: 'assistant',
        content: [{ type: 'output_text', text: outputText, annotations: [] }],
      }]),
    ],
    ...(usage === null ? {} : { usage: {
      input_tokens: usage.inputTokens,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: usage.outputTokens,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: usage.inputTokens + usage.outputTokens,
    } }),
  })
}

/** A Responses API error answer, as OpenAI sends it. */
export function createRecordedOpenAiError({
  code,
  headers,
  message = 'The request failed.',
  param = null,
  status,
}: Readonly<{
  code: string | null
  headers?: Readonly<Record<string, string>>
  message?: string
  param?: string | null
  status: number
}>) {
  return Response.json({ error: { code, message, param, type: 'invalid_request_error' } }, { headers, status })
}
