/* global Headers, Request, Response, TextEncoder, URL, crypto, fetch */

import { DailySpendingLimits, readLimitedCounters } from './daily-spending-limits.js'

export { DailySpendingLimits }

const originHeaderName = 'x-resume-studio-origin'
const quotaRemainingHeaderName = 'x-resume-quota-remaining'
const quotaResetHeaderName = 'x-resume-quota-reset'
/** One instance holds every counter, so the per-client quota and the global ceiling are checked together. */
const limitsInstanceName = 'daily-spending-limits'

export default {
  async fetch(request, environment) {
    if (!isConfiguredEnvironment(environment)) {
      return new Response('Service unavailable', { status: 503 })
    }

    const incomingUrl = new URL(request.url)
    const counters = readLimitedCounters({ method: request.method, pathname: incomingUrl.pathname })
    if (counters.length === 0) return forwardToOrigin({ request, environment, incomingUrl })

    const limits = environment.DAILY_SPENDING_LIMITS.get(environment.DAILY_SPENDING_LIMITS.idFromName(limitsInstanceName))
    const clientKey = await readClientKey({ request, environment })
    const reservation = await callLimits({ limits, body: { operation: 'reserve', clientKey, counters } })
    if (!reservation.allowed) return withQuotaHeaders({ response: rateLimitedResponse(reservation), reservation })

    const response = await forwardToOrigin({ request, environment, incomingUrl })
    if (!response.ok) {
      await callLimits({ limits, body: { operation: 'release', clientKey, counters, day: reservation.day } })
      return withQuotaHeaders({ response, reservation: { ...reservation, remainingPreparations: addOne(reservation.remainingPreparations) } })
    }
    return withQuotaHeaders({ response, reservation })
  },
}

function forwardToOrigin({ request, environment, incomingUrl }) {
  const originUrl = new URL(environment.ORIGIN_URL)
  originUrl.pathname = incomingUrl.pathname
  originUrl.search = incomingUrl.search

  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete(originHeaderName)
  headers.set(originHeaderName, environment.ORIGIN_SECRET)

  const originRequest = new Request(originUrl, {
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    // The standard option a streamed body requires outside Workers; Workers accept it.
    duplex: 'half',
    headers,
    method: request.method,
    redirect: 'manual',
  })
  return fetch(originRequest)
}

async function callLimits({ limits, body }) {
  const response = await limits.fetch('https://daily-spending-limits.internal/', {
    method: 'POST', body: JSON.stringify(body),
  })
  return response.json()
}

/** Counters are keyed by a digest of the client IP, never by the demo access cookie, which renews every 30 minutes. */
async function readClientKey({ request, environment }) {
  const clientIp = request.headers.get('cf-connecting-ip') ?? 'unknown'
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(environment.ORIGIN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(clientIp)))
  return `client:${Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/** The API Failure the application already answers with, so the Candidate gets the wait-and-retry Recovery. */
function rateLimitedResponse({ resetAt }) {
  const retryAfterSeconds = Math.max(0, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000))
  return Response.json({ ok: false, error: { type: 'rate-limited', retryAfterSeconds } }, {
    status: 429,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', 'Retry-After': String(retryAfterSeconds) },
  })
}

/** Responses to a request that starts a preparation tell the Candidate how many remain today and when they reset. */
function withQuotaHeaders({ response, reservation }) {
  if (reservation.remainingPreparations === undefined) return response
  const decorated = new Response(response.body, response)
  decorated.headers.set(quotaRemainingHeaderName, String(reservation.remainingPreparations))
  decorated.headers.set(quotaResetHeaderName, reservation.resetAt)
  return decorated
}

function addOne(remaining) {
  return remaining === undefined ? undefined : remaining + 1
}

function isConfiguredEnvironment(environment) {
  return typeof environment.ORIGIN_URL === 'string'
    && environment.ORIGIN_URL.startsWith('https://')
    && typeof environment.ORIGIN_SECRET === 'string'
    && environment.ORIGIN_SECRET.length >= 32
    && typeof environment.DAILY_SPENDING_LIMITS?.idFromName === 'function'
}
