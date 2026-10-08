/* global Headers, Request, Response, TextEncoder, URL, crypto, fetch */

import { DailySpendingLimits, acceptsCandidateApiKey, dailyLimits, readLimitedCounters } from './daily-spending-limits.js'

export { DailySpendingLimits, dailyLimits }

const originHeaderName = 'x-resume-studio-origin'
/** One instance holds every counter, so the Daily Quota and the global ceiling are checked together. */
const limitsInstanceName = 'daily-spending-limits'
/** Statuses the application answers before any model call: missing access, invalid or oversized input. */
const unservedStatuses = new Set([400, 401, 403, 413])
const candidateApiKeyHeaderName = 'x-candidate-api-key'
const dailyQuotaPath = '/api/daily-quota'
/** Limits a Candidate API Key lifts: past them, the Candidate may continue with their own key. */
const modelLimitScopes = new Set(['daily-quota', 'overall', 'model-requests'])

export default {
  async fetch(request, environment) {
    if (!isConfiguredEnvironment(environment)) {
      return new Response('Service unavailable', { status: 503 })
    }

    const incomingUrl = new URL(request.url)
    const limits = environment.DAILY_SPENDING_LIMITS.get(environment.DAILY_SPENDING_LIMITS.idFromName(limitsInstanceName))
    if (request.method === 'GET' && incomingUrl.pathname === dailyQuotaPath) {
      return readDailyQuota({ limits, clientKey: await readClientKey({ request, environment }) })
    }
    const counters = readLimitedCounters({
      method: request.method, pathname: incomingUrl.pathname,
      carriesCandidateApiKey: request.headers.has(candidateApiKeyHeaderName),
    })
    if (counters.length === 0) return forwardToOrigin({ request, environment, incomingUrl })

    const clientKey = await readClientKey({ request, environment })
    const reserved = await sendToDailySpendingLimits({ limits, operation: 'reserve', reservation: { clientKey, counters } })
    if (!reserved.allowed) return withDailyQuotaHeaders({ response: rateLimitedResponse(reserved), quota: reserved })

    const response = await forwardToOrigin({ request, environment, incomingUrl })
    if (!unservedStatuses.has(response.status)) return withDailyQuotaHeaders({ response, quota: reserved })
    // The request never reached the model, such as a renewal of demo access, so it costs the Candidate nothing.
    const released = await sendToDailySpendingLimits({ limits, operation: 'release', reservation: reserved.reservation })
    return withDailyQuotaHeaders({ response, quota: { ...reserved, ...released } })
  },
}

function forwardToOrigin({ request, environment, incomingUrl }) {
  const originUrl = new URL(environment.ORIGIN_URL)
  originUrl.pathname = incomingUrl.pathname
  originUrl.search = incomingUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete(originHeaderName)
  if (!acceptsCandidateApiKey({ pathname: incomingUrl.pathname })) headers.delete(candidateApiKeyHeaderName)
  headers.set(originHeaderName, environment.ORIGIN_SECRET)

  const originRequest = new Request(originUrl, {
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    // The Fetch standard requires it for a streamed body; Node enforces it and Workers accept it.
    duplex: 'half',
    headers,
    method: request.method,
    redirect: 'manual',
  })
  return fetch(originRequest)
}

/** The Daily Quota left to a client, so the interface can show it before the Candidate starts a preparation. */
async function readDailyQuota({ limits, clientKey }) {
  const quota = await sendToDailySpendingLimits({ limits, operation: 'peek', reservation: { clientKey } })
  return withDailyQuotaHeaders({
    response: Response.json({ ok: true, value: { remaining: quota.remainingDailyQuota, resetAt: quota.resetAt } },
      { headers: privateHeaders }),
    quota,
  })
}

async function sendToDailySpendingLimits({ limits, operation, reservation }) {
  const response = await limits.fetch('https://daily-spending-limits.internal/', {
    method: 'POST', body: JSON.stringify({ operation, reservation }),
  })
  return response.json()
}

/**
 * Counters are keyed by a digest of the client network, never by the demo access cookie, which renews every
 * 30 minutes. An IPv6 client is keyed by its /64, the block one subscriber usually holds.
 */
async function readClientKey({ request, environment }) {
  const clientNetwork = readClientNetwork(request.headers.get('cf-connecting-ip') ?? 'unknown')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(environment.ORIGIN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(clientNetwork)))
  return `client:${Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function readClientNetwork(clientIp) {
  if (!clientIp.includes(':')) return clientIp
  // An IPv4-mapped IPv6 address, such as ::ffff:192.0.2.1, is an IPv4 client.
  if (clientIp.includes('.')) return clientIp.slice(clientIp.lastIndexOf(':') + 1)
  const [head, tail] = clientIp.toLowerCase().split('::')
  const headGroups = head === '' ? [] : head.split(':')
  const tailGroups = tail === undefined || tail === '' ? [] : tail.split(':')
  const groups = tail === undefined
    ? headGroups
    : [...headGroups, ...Array(8 - headGroups.length - tailGroups.length).fill('0'), ...tailGroups]
  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(':')}::/64`
}

/**
 * Past a model limit, the request fails as past the Daily Quota, and names which limit refused it, so the Candidate
 * can continue with a Candidate API Key or come back after the reset. Past a limit no key lifts, it is rate limited.
 */
function rateLimitedResponse({ exhaustedLimit, resetAt }) {
  const retryAfterSeconds = Math.max(0, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000))
  const liftedByCandidateApiKey = modelLimitScopes.has(exhaustedLimit)
  const type = liftedByCandidateApiKey ? 'daily-quota-reached' : 'rate-limited'
  return Response.json({ ok: false, error: { type, retryAfterSeconds } }, {
    status: 429,
    headers: {
      ...privateHeaders, 'Retry-After': String(retryAfterSeconds),
      ...(liftedByCandidateApiKey ? { 'x-resume-quota-scope': exhaustedLimit, 'x-resume-quota-reset': resetAt } : {}),
    },
  })
}

const privateHeaders = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }

/** Responses to a request that starts a Tailored Resume tell the Candidate how many remain today and when they reset. */
function withDailyQuotaHeaders({ response, quota }) {
  if (quota.remainingDailyQuota === undefined) return response
  const decorated = new Response(response.body, response)
  decorated.headers.set('x-resume-quota-remaining', String(quota.remainingDailyQuota))
  decorated.headers.set('x-resume-quota-reset', quota.resetAt)
  return decorated
}

function isConfiguredEnvironment(environment) {
  return typeof environment.ORIGIN_URL === 'string'
    && environment.ORIGIN_URL.startsWith('https://')
    && typeof environment.ORIGIN_SECRET === 'string'
    && environment.ORIGIN_SECRET.length >= 32
    && typeof environment.DAILY_SPENDING_LIMITS?.idFromName === 'function'
}
