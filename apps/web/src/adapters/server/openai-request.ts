type OpenAiOperation =
  | 'resume-section-writing'
  | 'resume-section-validation'
  | 'resume-document-coherence'
  | 'explainable-job-posting-extraction'
  | 'explainable-match-evidence'
  | 'resume-claim-validation'
  | 'resume-claim-writing'
  | 'structured-source-profile-extraction'
  | 'candidate-api-key-validation'

/**
 * The key a model request is signed with: the operator's, or a Candidate API Key. A request is signed with the key it
 * was given or not sent; nothing here ever swaps one key for the other.
 */
export type ModelApiKey = Readonly<{ source: 'operator' | 'candidate'; value: string }>

export type OpenAiRequestFailure = Readonly<{
  type: 'invalid-response' | 'rate-limited' | 'timeout' | 'transport'
    | 'upstream-invalid-request' | 'upstream-failure'
    | 'candidate-api-key-invalid' | 'candidate-api-key-model-unavailable' | 'provider-credit-exhausted'
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
type OpenAiEndpoint = Readonly<{ method: 'GET' | 'POST'; path: string }>
const responsesEndpoint: OpenAiEndpoint = { method: 'POST', path: '/v1/responses' }

export function createOpenAiRequester({
  apiKey,
  request = fetch,
}: OpenAiRequesterDependencies) {
  return {
    send: (details: OpenAiRequestDetails) => sendOpenAiRequest({ apiKey, request, ...details }),
    /** Reads one model's description, which costs nothing, to learn whether the key may use that model. */
    checkModelAccess: async ({ model }: Readonly<{ model: string }>) => {
      const result = await sendOpenAiRequest({ apiKey, request, operation: 'candidate-api-key-validation',
        endpoint: { method: 'GET', path: `/v1/models/${encodeURIComponent(model)}` } })
      return result.ok ? { ok: true } as const : result
    },
  }
}

export function createOpenAiRequestDeadline() {
  return AbortSignal.timeout(openAiRequestTimeoutMilliseconds)
}

async function sendOpenAiRequest({
  apiKey,
  body,
  deadlineSignal = createOpenAiRequestDeadline(),
  endpoint = responsesEndpoint,
  operation,
  request,
}: Omit<OpenAiRequestDetails, 'body'> & Readonly<{ body?: unknown; endpoint?: OpenAiEndpoint }>
  & Required<OpenAiRequesterDependencies>) {
  const startedAtMilliseconds = Date.now()
  const requestCharacterCount = body === undefined ? 0 : JSON.stringify(body).length
  const apiKeySource = apiKey.source
  const responseResult = await fetchOpenAiResponse({ apiKey, body, deadlineSignal, endpoint, request })
  if (!responseResult.ok) {
    return recordFailure({ ...responseResult.error, apiKeySource, operation, requestCharacterCount, startedAtMilliseconds })
  }
  if (!responseResult.value.ok) {
    const { status } = responseResult.value
    const upstreamError = await readUpstreamErrorIdentifiers({ apiKey, response: responseResult.value })
    return recordFailure({
      apiKeySource, cause: readUpstreamFailure({ apiKeySource, status, upstreamErrorCode: upstreamError.upstreamErrorCode }),
      operation, retryAfter: responseResult.value.headers.get('retry-after') ?? undefined,
      requestCharacterCount, startedAtMilliseconds, status, ...upstreamError,
    })
  }
  return readOpenAiResponse({ apiKeySource, operation, requestCharacterCount, response: responseResult.value, startedAtMilliseconds })
}

async function fetchOpenAiResponse({
  apiKey, body, deadlineSignal, endpoint, request,
}: Readonly<{
  apiKey: ModelApiKey
  body: unknown
  deadlineSignal: AbortSignal
  endpoint: OpenAiEndpoint
  request: typeof fetch
}>) {
  try {
    const value = await request(`https://api.openai.com${endpoint.path}`, {
      method: endpoint.method,
      headers: { Authorization: `Bearer ${apiKey.value}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: deadlineSignal,
    })
    return { ok: true, value } as const
  } catch (error) {
    return { ok: false, error: { cause: readFailureCause({ error }) } } as const
  }
}

async function readOpenAiResponse({
  apiKeySource, operation, requestCharacterCount, response, startedAtMilliseconds,
}: Readonly<{
  apiKeySource: ModelApiKey['source']
  operation: OpenAiOperation
  requestCharacterCount: number
  response: Response
  startedAtMilliseconds: number
}>) {
  try {
    return { ok: true, value: await response.json() as unknown } as const
  } catch {
    return recordFailure({ apiKeySource, cause: 'invalid-response', operation, requestCharacterCount, startedAtMilliseconds })
  }
}

/**
 * Only identifier-like code and param values are logged; provider messages may echo Candidate content or the key
 * itself, so an identifier that looks like a key, or holds part of the one used, is dropped too.
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
  apiKeySource,
  cause,
  operation,
  requestCharacterCount,
  retryAfter,
  startedAtMilliseconds,
  status,
  upstreamErrorCode,
  upstreamErrorParam,
}: Readonly<{
  apiKeySource: ModelApiKey['source']
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
    apiKeySource, cause, durationMilliseconds, operation, requestCharacterCount,
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
 * Exhausted credit is not a rate limit: waiting does not restore it. A rejected key, a model it cannot reach, or
 * exhausted credit is the Candidate's to fix when it is their key, and a defect or an outage when it is the operator's.
 */
function readUpstreamFailure({ apiKeySource, status, upstreamErrorCode }: Readonly<{
  apiKeySource: ModelApiKey['source']; status: number; upstreamErrorCode: string | undefined
}>): OpenAiRequestFailure['type'] {
  const isCandidateKey = apiKeySource === 'candidate'
  if (status === 429 && upstreamErrorCode === 'insufficient_quota') {
    return isCandidateKey ? 'provider-credit-exhausted' : 'upstream-failure'
  }
  if (status === 429) return 'rate-limited'
  if (status >= 500) return 'upstream-failure'
  if (!isCandidateKey) return 'upstream-invalid-request'
  if ((status === 403 || status === 404) && upstreamErrorCode === 'model_not_found') return 'candidate-api-key-model-unavailable'
  if (status === 401 || status === 403) return 'candidate-api-key-invalid'
  return 'upstream-invalid-request'
}

const openAiRequestTimeoutMilliseconds = 90_000
