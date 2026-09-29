type OpenAiOperation =
  | 'job-requirement-extraction'
  | 'match-analysis'
  | 'resume-claim-validation'
  | 'resume-claim-writing'
  | 'source-profile-extraction'
  | 'structured-source-profile-extraction'
  | 'tailored-resume-pdf-validation'

type OpenAiRequesterDependencies = Readonly<{
  apiKey: string
  request?: typeof fetch
}>

type OpenAiRequestDetails = Readonly<{
  body: unknown
  deadlineSignal?: AbortSignal
  operation: OpenAiOperation
}>

export function createOpenAiRequester({
  apiKey,
  request = fetch,
}: OpenAiRequesterDependencies) {
  return {
    send: (details: OpenAiRequestDetails) => sendOpenAiRequest({ apiKey, request, ...details }),
  }
}

export function createOpenAiRequestDeadline() {
  return AbortSignal.timeout(openAiRequestTimeoutMilliseconds)
}

async function sendOpenAiRequest({
  apiKey,
  body,
  deadlineSignal = createOpenAiRequestDeadline(),
  operation,
  request,
}: OpenAiRequestDetails & Required<OpenAiRequesterDependencies>) {
  const startedAtMilliseconds = Date.now()
  const responseResult = await fetchOpenAiResponse({ apiKey, body, deadlineSignal, request })
  if (!responseResult.ok) {
    return recordFailure({ ...responseResult.error, operation, startedAtMilliseconds })
  }
  if (!responseResult.value.ok) {
    return recordFailure({
      cause: 'upstream-status', operation,
      startedAtMilliseconds, status: responseResult.value.status,
    })
  }
  return readOpenAiResponse({ operation, response: responseResult.value, startedAtMilliseconds })
}

async function fetchOpenAiResponse({
  apiKey, body, deadlineSignal, request,
}: Readonly<{
  apiKey: string
  body: unknown
  deadlineSignal: AbortSignal
  request: typeof fetch
}>) {
  try {
    const value = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: deadlineSignal,
    })
    return { ok: true, value } as const
  } catch (error) {
    return { ok: false, error: { cause: readFailureCause({ error }) } } as const
  }
}

async function readOpenAiResponse({
  operation, response, startedAtMilliseconds,
}: Readonly<{ operation: OpenAiOperation; response: Response; startedAtMilliseconds: number }>) {
  try {
    return { ok: true, value: await response.json() as unknown } as const
  } catch {
    return recordFailure({ cause: 'invalid-response', operation, startedAtMilliseconds })
  }
}

function readFailureCause({ error }: Readonly<{ error: unknown }>) {
  return error instanceof DOMException && error.name === 'TimeoutError'
    ? 'timeout' as const
    : 'transport' as const
}

function recordFailure({
  cause,
  operation,
  startedAtMilliseconds,
  status,
}: Readonly<{
  cause: 'invalid-response' | 'timeout' | 'transport' | 'upstream-status'
  operation: OpenAiOperation
  startedAtMilliseconds: number
  status?: number
}>) {
  const durationMilliseconds = Math.max(0, Date.now() - startedAtMilliseconds)
  const dimensions = status === undefined
    ? { cause, durationMilliseconds, operation }
    : { cause, durationMilliseconds, operation, status }
  console.info(JSON.stringify({
    category: 'privacy-safe-openai-request', metric: 'failed', value: 1, dimensions,
  }))
  return unavailableResult
}

const unavailableResult = { ok: false } as const
const openAiRequestTimeoutMilliseconds = 90_000
