type OpenAiOperation =
  | 'explainable-job-posting-extraction'
  | 'explainable-match-evidence'
  | 'job-requirement-extraction'
  | 'match-analysis'
  | 'resume-claim-validation'
  | 'resume-claim-writing'
  | 'source-profile-extraction'
  | 'structured-source-profile-extraction'
  | 'tailored-resume-pdf-validation'

export type OpenAiRequestFailure = Readonly<{
  type: 'invalid-response' | 'rate-limited' | 'timeout' | 'transport'
    | 'upstream-invalid-request' | 'upstream-failure'
  status?: number
  retryAfter?: string
}>

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
  const requestCharacterCount = JSON.stringify(body).length
  const responseResult = await fetchOpenAiResponse({ apiKey, body, deadlineSignal, request })
  if (!responseResult.ok) {
    return recordFailure({ ...responseResult.error, operation, requestCharacterCount, startedAtMilliseconds })
  }
  if (!responseResult.value.ok) {
    return recordFailure({
      cause: readUpstreamFailure({ status: responseResult.value.status }), operation,
      retryAfter: responseResult.value.headers.get('retry-after') ?? undefined,
      requestCharacterCount, startedAtMilliseconds, status: responseResult.value.status,
    })
  }
  return readOpenAiResponse({ operation, requestCharacterCount, response: responseResult.value, startedAtMilliseconds })
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
  operation, requestCharacterCount, response, startedAtMilliseconds,
}: Readonly<{
  operation: OpenAiOperation
  requestCharacterCount: number
  response: Response
  startedAtMilliseconds: number
}>) {
  try {
    return { ok: true, value: await response.json() as unknown } as const
  } catch {
    return recordFailure({ cause: 'invalid-response', operation, requestCharacterCount, startedAtMilliseconds })
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
  requestCharacterCount,
  retryAfter,
  startedAtMilliseconds,
  status,
}: Readonly<{
  cause: OpenAiRequestFailure['type']
  operation: OpenAiOperation
  requestCharacterCount: number
  retryAfter?: string
  startedAtMilliseconds: number
  status?: number
}>) {
  const durationMilliseconds = Math.max(0, Date.now() - startedAtMilliseconds)
  const dimensions = {
    cause, durationMilliseconds, operation, requestCharacterCount,
    ...(retryAfter === undefined ? {} : { retryAfter }),
    ...(status === undefined ? {} : { status }),
  }
  console.info(JSON.stringify({
    category: 'privacy-safe-openai-request', metric: 'failed', value: 1, dimensions,
  }))
  return { ok: false, error: {
    ...(retryAfter === undefined ? {} : { retryAfter }),
    ...(status === undefined ? {} : { status }),
    type: cause,
  } } as const
}

function readUpstreamFailure({ status }: Readonly<{ status: number }>) {
  if (status === 429) return 'rate-limited' as const
  if (status >= 500) return 'upstream-failure' as const
  return 'upstream-invalid-request' as const
}

const openAiRequestTimeoutMilliseconds = 90_000
