type OpenAiOperation =
  | 'resume-section-writing'
  | 'resume-section-validation'
  | 'resume-document-coherence'
  | 'explainable-job-posting-extraction'
  | 'explainable-match-evidence'
  | 'resume-claim-validation'
  | 'resume-claim-writing'
  | 'structured-source-profile-extraction'

/** The operator key every model request is signed with. */
export type ModelApiKey = Readonly<{ value: string }>

export type OpenAiRequestFailure = Readonly<{
  type: 'invalid-response' | 'rate-limited' | 'timeout' | 'transport'
    | 'upstream-invalid-request' | 'upstream-failure'
  status?: number
  retryAfter?: string
}>

type OpenAiRequesterDependencies = Readonly<{
  apiKey: ModelApiKey
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
    const { status } = responseResult.value
    const upstreamError = await readUpstreamErrorIdentifiers({ apiKey, response: responseResult.value })
    return recordFailure({
      cause: readUpstreamFailure({ status, upstreamErrorCode: upstreamError.upstreamErrorCode }),
      operation, retryAfter: responseResult.value.headers.get('retry-after') ?? undefined,
      requestCharacterCount, startedAtMilliseconds, status, ...upstreamError,
    })
  }
  return readOpenAiResponse({ operation, requestCharacterCount, response: responseResult.value, startedAtMilliseconds })
}

async function fetchOpenAiResponse({
  apiKey, body, deadlineSignal, request,
}: Readonly<{
  apiKey: ModelApiKey
  body: unknown
  deadlineSignal: AbortSignal
  request: typeof fetch
}>) {
  try {
    const value = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.value}`, 'Content-Type': 'application/json' },
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

/**
 * Only identifier-like code and param values are logged; provider messages may echo Candidate content or the operator
 * key itself, so an identifier that looks like a key, or holds part of the one used, is dropped too.
 */
async function readUpstreamErrorIdentifiers({ apiKey, response }: Readonly<{ apiKey: ModelApiKey; response: Response }>) {
  try {
    const { error } = await response.json() as { error?: { code?: unknown; param?: unknown } }
    const upstreamErrorCode = readErrorIdentifier({ apiKey, value: error?.code })
    const upstreamErrorParam = readErrorIdentifier({ apiKey, value: error?.param })
    return {
      ...(upstreamErrorCode === undefined ? {} : { upstreamErrorCode }),
      ...(upstreamErrorParam === undefined ? {} : { upstreamErrorParam }),
    }
  } catch {
    return {}
  }
}

function readErrorIdentifier({ apiKey, value }: Readonly<{ apiKey: ModelApiKey; value: unknown }>) {
  if (typeof value !== 'string' || !/^[\w.[\]$-]{1,120}$/u.test(value)) return undefined
  return mayHoldApiKey({ apiKey, value }) ? undefined : value
}

/** Provider keys start with `sk-`; any eight consecutive characters of the key used also count as holding it. */
function mayHoldApiKey({ apiKey, value }: Readonly<{ apiKey: ModelApiKey; value: string }>) {
  if (/sk-/iu.test(value)) return true
  const fragmentLength = 8
  for (let start = 0; start + fragmentLength <= apiKey.value.length; start += 1) {
    if (value.includes(apiKey.value.slice(start, start + fragmentLength))) return true
  }
  return false
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
  upstreamErrorCode,
  upstreamErrorParam,
}: Readonly<{
  cause: OpenAiRequestFailure['type']
  operation: OpenAiOperation
  requestCharacterCount: number
  retryAfter?: string
  startedAtMilliseconds: number
  status?: number
  upstreamErrorCode?: string
  upstreamErrorParam?: string
}>) {
  const durationMilliseconds = Math.max(0, Date.now() - startedAtMilliseconds)
  const dimensions = {
    cause, durationMilliseconds, operation, requestCharacterCount,
    ...(retryAfter === undefined ? {} : { retryAfter }),
    ...(status === undefined ? {} : { status }),
    ...(upstreamErrorCode === undefined ? {} : { upstreamErrorCode }),
    ...(upstreamErrorParam === undefined ? {} : { upstreamErrorParam }),
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

/**
 * Exhausted operator credit is not a rate limit: waiting does not restore it, so it is an outage the operator must
 * fix. A rejected request is a defect, never the Candidate's to fix.
 */
function readUpstreamFailure({ status, upstreamErrorCode }: Readonly<{
  status: number; upstreamErrorCode: string | undefined
}>): OpenAiRequestFailure['type'] {
  if (status === 429 && upstreamErrorCode === 'insufficient_quota') return 'upstream-failure'
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'upstream-failure'
  return 'upstream-invalid-request'
}

const openAiRequestTimeoutMilliseconds = 90_000
