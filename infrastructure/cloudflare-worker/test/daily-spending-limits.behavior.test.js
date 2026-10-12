/* global Request, Response, URL */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker, { DailySpendingLimits, dailyLimits } from '@resume-tailoring/cloudflare-worker'

const tenInTheMorningInParis = '2026-10-08T08:00:00.000Z'
const nextMidnightInParis = '2026-10-08T22:00:00.000Z'
const secondsUntilMidnight = 14 * 60 * 60
/** Six measured journeys with edits stayed under 375 model-backed requests, so eight stay under 500. */
const modelRequestsOfEightJourneysWithEdits = 375 * 8 / 6

describe('Daily spending limits at the edge', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(tenInTheMorningInParis)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('serves a Tailored Resume under the Daily Quota and tells how many remain until midnight in Paris', async () => {
    const system = createSystemUnderTest()

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    await system.expectServedByOrigin()
    system.expectRemainingDailyQuota({ remaining: dailyLimits.dailyQuota - 1, resetAt: nextMidnightInParis })
  })

  it('refuses the ninth Tailored Resume from the same IP as past the Daily Quota until the reset', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: 8 })

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'daily-quota' })
    system.expectRemainingDailyQuota({ remaining: 0, resetAt: nextMidnightInParis })
  })

  it('keeps the Daily Quota of an IP whatever demo access cookie its request carries', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: dailyLimits.dailyQuota })

    await system.startTailoredResume({ clientIp: '198.51.100.1', cookie: 'demo_access=renewed' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'daily-quota' })
  })

  it('keeps a separate Daily Quota for another IP', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: dailyLimits.dailyQuota })

    await system.startTailoredResume({ clientIp: '198.51.100.2' })

    await system.expectServedByOrigin()
  })

  it('shares one Daily Quota across the addresses of one IPv6 /64', async () => {
    const system = createSystemUnderTest()
    const spellings = ['2001:db8:1:2::1', '2001:0db8:0001:0002:aaaa::', '2001:db8:1:2:ffff:ffff:ffff:ffff']
    await system.givenTailoredResumesFromAddresses({
      clientIps: Array.from({ length: dailyLimits.dailyQuota }, (_, index) =>
        spellings[index] ?? `2001:db8:1:2::${String(index + 1)}`),
    })

    await system.startTailoredResume({ clientIp: '2001:db8:1:2::99' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'daily-quota' })
  })

  it('refuses every new Tailored Resume once the global daily ceiling is reached', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesFromAddresses({
      clientIps: Array.from({ length: dailyLimits.preparationsOverall }, (_, index) => `203.0.113.${String(index)}`),
    })

    await system.startTailoredResume({ clientIp: '203.0.113.250' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'overall' })
    system.expectRemainingDailyQuota({ remaining: 0, resetAt: nextMidnightInParis })
  })

  it('opens a fresh Daily Quota at 00:00 Europe/Paris', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: dailyLimits.dailyQuota })
    system.givenTimeIs(nextMidnightInParis)

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    await system.expectServedByOrigin()
    system.expectRemainingDailyQuota({ remaining: dailyLimits.dailyQuota - 1, resetAt: '2026-10-09T22:00:00.000Z' })
  })

  it.each([
    ['in summer time', '2026-07-01T21:59:59.000Z', '2026-07-01T22:00:00.000Z'],
    ['in winter time', '2026-12-01T23:00:00.000Z', '2026-12-02T23:00:00.000Z'],
    ['on the night summer time ends', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z'],
    ['on the night summer time starts', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z'],
  ])('announces the reset at 00:00 Europe/Paris %s', async (_season, now, resetAt) => {
    const system = createSystemUnderTest()
    system.givenTimeIs(now)

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    system.expectRemainingDailyQuota({ remaining: dailyLimits.dailyQuota - 1, resetAt })
  })

  it('gives the Tailored Resume back when the origin refuses the request before any model call', async () => {
    const system = createSystemUnderTest({ originStatus: 401 })

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    system.expectRemainingDailyQuota({ remaining: dailyLimits.dailyQuota, resetAt: nextMidnightInParis })
  })

  it('keeps the Tailored Resume counted when the provider failed after the model was called', async () => {
    const system = createSystemUnderTest({ originStatus: 502 })

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    system.expectRemainingDailyQuota({ remaining: dailyLimits.dailyQuota - 1, resetAt: nextMidnightInParis })
  })

  it('stops model-backed requests from one IP at the technical ceiling, even when they keep failing', async () => {
    const system = createSystemUnderTest({ originStatus: 502 })
    await system.givenModelRequestsSent({ clientIp: '198.51.100.1', count: dailyLimits.modelRequestsPerClient })

    await system.sendModelRequest({ clientIp: '198.51.100.1' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'model-requests' })
    system.expectNoDailyQuotaAnnounced()
  })

  it('announces no remaining Tailored Resume when the technical ceiling refuses one', async () => {
    const system = createSystemUnderTest()
    await system.givenModelRequestsSent({ clientIp: '198.51.100.1', count: dailyLimits.modelRequestsPerClient })

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'model-requests' })
    system.expectRemainingDailyQuota({ remaining: 0, resetAt: nextMidnightInParis })
  })

  it('stops PDF renders from one IP at the render limit', async () => {
    const system = createSystemUnderTest()
    await system.givenRendersRequested({ clientIp: '198.51.100.1', count: dailyLimits.rendersPerClient })

    await system.requestRender({ clientIp: '198.51.100.1' })

    await system.expectRateLimitedUntilReset({ retryAfterSeconds: secondsUntilMidnight })
  })

  it('serves every model request of eight journeys with edits under the technical ceiling', async () => {
    const system = createSystemUnderTest()
    await system.givenModelRequestsSent({
      clientIp: '198.51.100.1', count: modelRequestsOfEightJourneysWithEdits - 1,
    })

    await system.sendModelRequest({ clientIp: '198.51.100.1' })

    await system.expectServedByOrigin()
  })

  it('refuses a Tailored Resume past the Daily Quota whatever Candidate API Key header it carries', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: dailyLimits.dailyQuota })

    await system.startTailoredResume({ clientIp: '198.51.100.1', candidateApiKeyHeader: 'sk-candidate' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'daily-quota' })
    system.expectRemainingDailyQuota({ remaining: 0, resetAt: nextMidnightInParis })
  })

  it('refuses a model-backed request past the technical ceiling whatever Candidate API Key header it carries', async () => {
    const system = createSystemUnderTest()
    await system.givenModelRequestsSent({ clientIp: '198.51.100.1', count: dailyLimits.modelRequestsPerClient })

    await system.sendModelRequest({ clientIp: '198.51.100.1', candidateApiKeyHeader: 'sk-candidate' })

    await system.expectDailyQuotaReachedUntilReset({ retryAfterSeconds: secondsUntilMidnight, scope: 'model-requests' })
  })

  it('counts a Tailored Resume that carries a Candidate API Key header against the Daily Quota', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: 2, candidateApiKeyHeader: 'sk-candidate' })

    await system.startTailoredResume({ clientIp: '198.51.100.1' })

    system.expectRemainingDailyQuota({ remaining: dailyLimits.dailyQuota - 3, resetAt: nextMidnightInParis })
  })

  it.each([
    ['a model-backed route', '/api/resume-section-writing'],
    ['the PDF render', '/api/resume-document'],
    ['a page', '/'],
  ])('strips a Candidate API Key header before it reaches %s', async (_route, path) => {
    const system = createSystemUnderTest()

    await system.sendWithCandidateApiKeyHeader({ clientIp: '198.51.100.1', path, candidateApiKeyHeader: 'sk-candidate' })

    await system.expectServedByOrigin()
    system.expectOriginReceivedNoCandidateApiKeyHeader()
  })

  it('tells how many Tailored Resumes remain today without spending one', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: 1 })

    await system.readDailyQuota({ clientIp: '198.51.100.1' })

    await system.expectDailyQuotaAnswered({ remaining: dailyLimits.dailyQuota - 1, resetAt: nextMidnightInParis })
  })

  it('tells that no Tailored Resume remains once the global daily ceiling is reached', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesFromAddresses({
      clientIps: Array.from({ length: dailyLimits.preparationsOverall }, (_, index) => `203.0.113.${String(index)}`),
    })

    await system.readDailyQuota({ clientIp: '198.51.100.1' })

    await system.expectDailyQuotaAnswered({ remaining: 0, resetAt: nextMidnightInParis })
  })

  it('never limits pages', async () => {
    const system = createSystemUnderTest()
    await system.givenTailoredResumesStarted({ clientIp: '198.51.100.1', count: dailyLimits.dailyQuota })

    await system.openPage({ clientIp: '198.51.100.1' })

    await system.expectServedByOrigin()
  })
})

function createSystemUnderTest({ originStatus = 200 } = {}) {
  const originPaths = []
  const originCandidateApiKeyHeaders = []
  vi.stubGlobal('fetch', vi.fn(async (request) => {
    originPaths.push(new URL(request.url).pathname)
    originCandidateApiKeyHeaders.push(request.headers.get('x-candidate-api-key'))
    return Response.json({ ok: originStatus < 400 }, { status: originStatus })
  }))
  const limits = new DailySpendingLimits({ storage: createInMemoryStorage() })
  const environment = {
    ORIGIN_URL: 'https://origin.example',
    ORIGIN_SECRET: 'origin-secret-of-at-least-32-characters',
    DAILY_SPENDING_LIMITS: {
      idFromName: (name) => name,
      get: () => ({ fetch: async (url, init) => limits.fetch(new Request(url, init)) }),
    },
  }
  // An earlier version of the interface sent a Candidate API Key in this header; the edge must ignore and strip it.
  const send = ({ path, clientIp, method = 'POST', cookie, candidateApiKeyHeader }) => worker.fetch(new Request(`https://demo.example${path}`, {
    method,
    headers: { 'cf-connecting-ip': clientIp, ...(cookie === undefined ? {} : { cookie }),
      ...(candidateApiKeyHeader === undefined ? {} : { 'x-candidate-api-key': candidateApiKeyHeader }) },
    ...(method === 'POST' ? { body: '{}' } : {}),
  }), environment)
  const preparation = ({ clientIp, cookie, candidateApiKeyHeader }) => send({
    path: '/api/explainable-job-posting-extraction', clientIp, cookie, candidateApiKeyHeader,
  })
  const modelRequest = ({ clientIp, candidateApiKeyHeader }) => send({
    path: '/api/resume-section-writing', clientIp, candidateApiKeyHeader,
  })
  const render = ({ clientIp }) => send({ path: '/api/resume-document', clientIp })
  const repeat = async ({ count, sendOne }) => {
    for (let index = 0; index < count; index += 1) await sendOne()
  }

  let response = null
  let originRequestsBeforeAction = 0
  const recordAction = async (sendAction) => {
    originRequestsBeforeAction = originPaths.length
    response = await sendAction()
  }
  const readResponse = () => {
    if (response === null) throw new Error('No action was taken: send a request before reading its outcome.')
    return response
  }

  return {
    givenTimeIs: (instant) => { vi.setSystemTime(instant) },
    givenTailoredResumesStarted: ({ clientIp, count, candidateApiKeyHeader }) => repeat({
      count, sendOne: () => preparation({ clientIp, candidateApiKeyHeader }),
    }),
    givenTailoredResumesFromAddresses: async ({ clientIps }) => {
      for (const clientIp of clientIps) await preparation({ clientIp })
    },
    givenModelRequestsSent: ({ clientIp, count }) => repeat({ count, sendOne: () => modelRequest({ clientIp }) }),
    givenRendersRequested: ({ clientIp, count }) => repeat({ count, sendOne: () => render({ clientIp }) }),

    startTailoredResume: ({ clientIp, cookie, candidateApiKeyHeader }) => recordAction(() => preparation({
      clientIp, cookie, candidateApiKeyHeader,
    })),
    sendModelRequest: ({ clientIp, candidateApiKeyHeader }) => recordAction(() => modelRequest({
      clientIp, candidateApiKeyHeader,
    })),
    requestRender: ({ clientIp }) => recordAction(() => render({ clientIp })),
    sendWithCandidateApiKeyHeader: ({ clientIp, path, candidateApiKeyHeader }) => recordAction(() => send({
      path, clientIp, method: path.startsWith('/api/') ? 'POST' : 'GET', candidateApiKeyHeader,
    })),
    readDailyQuota: ({ clientIp }) => recordAction(() => send({ path: '/api/daily-quota', clientIp, method: 'GET' })),
    openPage: ({ clientIp }) => recordAction(() => send({ path: '/', clientIp, method: 'GET' })),

    expectOriginReceivedNoCandidateApiKeyHeader() {
      readResponse()
      expect(originCandidateApiKeyHeaders.at(-1)).toBeNull()
    },
    async expectServedByOrigin() {
      const served = readResponse()
      expect(served.status).toBe(200)
      expect(originPaths.length).toBe(originRequestsBeforeAction + 1)
    },
    async expectRateLimitedUntilReset({ retryAfterSeconds }) {
      const refused = readResponse()
      expect(refused.status).toBe(429)
      expect(refused.headers.get('Retry-After')).toBe(String(retryAfterSeconds))
      expect(await refused.json()).toEqual({ ok: false, error: { type: 'rate-limited', retryAfterSeconds } })
      expect(originPaths.length).toBe(originRequestsBeforeAction)
    },
    async expectDailyQuotaReachedUntilReset({ retryAfterSeconds, scope }) {
      const refused = readResponse()
      expect(refused.status).toBe(429)
      expect(refused.headers.get('Retry-After')).toBe(String(retryAfterSeconds))
      expect(refused.headers.get('x-resume-quota-scope')).toBe(scope)
      expect(await refused.json()).toEqual({ ok: false, error: { type: 'daily-quota-reached', retryAfterSeconds } })
      expect(originPaths.length).toBe(originRequestsBeforeAction)
    },
    async expectDailyQuotaAnswered({ remaining, resetAt }) {
      const answered = readResponse()
      expect(answered.status).toBe(200)
      expect(answered.headers.get('Cache-Control')).toContain('no-store')
      expect(await answered.json()).toEqual({ ok: true, value: { remaining, resetAt } })
      expect(originPaths.length).toBe(originRequestsBeforeAction)
    },
    expectRemainingDailyQuota({ remaining, resetAt }) {
      const headers = readResponse().headers
      expect(headers.get('x-resume-quota-remaining')).toBe(String(remaining))
      expect(headers.get('x-resume-quota-reset')).toBe(resetAt)
    },
    expectNoDailyQuotaAnnounced() {
      expect(readResponse().headers.get('x-resume-quota-remaining')).toBeNull()
    },
  }
}

/** The subset of Durable Object storage the limits use, kept in memory. */
function createInMemoryStorage() {
  const values = new Map()
  return {
    get: async (key) => values.get(key),
    put: async (key, value) => { values.set(key, value) },
    deleteAll: async () => { values.clear() },
    setAlarm: async () => {},
  }
}
