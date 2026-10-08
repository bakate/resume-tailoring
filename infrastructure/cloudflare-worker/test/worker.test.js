/* global Request, Response, URL */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import worker, { DailySpendingLimits } from '../src/worker.js'
import { dailyLimits, readDailyWindow } from '../src/daily-spending-limits.js'

const morningInParis = '2026-10-08T08:00:00.000Z'
const nextResetInParis = '2026-10-08T22:00:00.000Z'

describe('Worker daily spending limits', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(morningInParis)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('forwards a preparation under the quota and tells the Candidate how many remain and when they reset', async () => {
    const system = createSystemUnderTest()

    const response = await system.startPreparation({ clientIp: '198.51.100.1' })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-resume-quota-remaining')).toBe(String(dailyLimits.preparationsPerClient - 1))
    expect(response.headers.get('x-resume-quota-reset')).toBe(nextResetInParis)
    expect(system.originRequests()).toEqual(['/api/explainable-job-posting-extraction'])
  })

  it('refuses the fifth preparation from the same IP with the rate-limited API Failure until the reset', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparationsStarted({ clientIp: '198.51.100.1', count: dailyLimits.preparationsPerClient })

    const response = await system.startPreparation({ clientIp: '198.51.100.1' })

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe(String(14 * 60 * 60))
    expect(response.headers.get('x-resume-quota-remaining')).toBe('0')
    expect(await response.json()).toEqual({ ok: false, error: { type: 'rate-limited', retryAfterSeconds: 14 * 60 * 60 } })
    expect(system.originRequests()).toHaveLength(dailyLimits.preparationsPerClient)
  })

  it('keeps the quota per IP, whatever demo access cookie the request carries', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparationsStarted({ clientIp: '198.51.100.1', count: dailyLimits.preparationsPerClient })

    const sameIpWithNewCookie = await system.startPreparation({ clientIp: '198.51.100.1', cookie: 'demo_access=renewed' })
    const otherIp = await system.startPreparation({ clientIp: '198.51.100.2' })

    expect(sameIpWithNewCookie.status).toBe(429)
    expect(otherIp.status).toBe(200)
  })

  it('refuses every new preparation once the global daily ceiling is reached', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparationsFromDistinctIps({ count: dailyLimits.preparationsOverall })

    const response = await system.startPreparation({ clientIp: '203.0.113.250' })

    expect(response.status).toBe(429)
    expect((await response.json()).error.type).toBe('rate-limited')
    expect(response.headers.get('x-resume-quota-remaining')).toBe('0')
  })

  it('opens a fresh quota at 00:00 Europe/Paris', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparationsStarted({ clientIp: '198.51.100.1', count: dailyLimits.preparationsPerClient })
    vi.setSystemTime(nextResetInParis)

    const response = await system.startPreparation({ clientIp: '198.51.100.1' })

    expect(response.status).toBe(200)
    expect(response.headers.get('x-resume-quota-remaining')).toBe(String(dailyLimits.preparationsPerClient - 1))
    expect(response.headers.get('x-resume-quota-reset')).toBe('2026-10-09T22:00:00.000Z')
  })

  it('gives the preparation back when the origin does not serve it', async () => {
    const system = createSystemUnderTest({ originStatus: 401 })

    const response = await system.startPreparation({ clientIp: '198.51.100.1' })

    expect(response.status).toBe(401)
    expect(response.headers.get('x-resume-quota-remaining')).toBe(String(dailyLimits.preparationsPerClient))
  })

  it('stops model-backed requests from one IP at the technical ceiling without touching the preparation quota', async () => {
    const system = createSystemUnderTest()
    await system.givenModelRequestsSent({ clientIp: '198.51.100.1', count: dailyLimits.modelRequestsPerClient })

    const response = await system.sendModelRequest({ clientIp: '198.51.100.1' })

    expect(response.status).toBe(429)
    expect(response.headers.get('x-resume-quota-remaining')).toBeNull()
    expect(await response.json()).toEqual({ ok: false, error: { type: 'rate-limited', retryAfterSeconds: 14 * 60 * 60 } })
  })

  it('stops PDF renders from one IP at the render limit', async () => {
    const system = createSystemUnderTest()
    await system.givenRendersRequested({ clientIp: '198.51.100.1', count: dailyLimits.rendersPerClient })

    const response = await system.requestRender({ clientIp: '198.51.100.1' })

    expect(response.status).toBe(429)
  })

  it('never limits pages or other routes', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparationsStarted({ clientIp: '198.51.100.1', count: dailyLimits.preparationsPerClient })

    const response = await system.openPage({ clientIp: '198.51.100.1' })

    expect(response.status).toBe(200)
  })
})

describe('Daily window', () => {
  it.each([
    ['summer time', '2026-07-01T21:59:59.000Z', '2026-07-01', '2026-07-01T22:00:00.000Z'],
    ['winter time', '2026-12-01T23:00:00.000Z', '2026-12-02', '2026-12-02T23:00:00.000Z'],
    ['the night summer time ends', '2026-10-24T22:00:00.000Z', '2026-10-25', '2026-10-25T23:00:00.000Z'],
    ['the night summer time starts', '2026-03-28T23:00:00.000Z', '2026-03-29', '2026-03-29T22:00:00.000Z'],
  ])('resets at 00:00 Europe/Paris in %s', (_season, now, day, resetAt) => {
    expect(readDailyWindow({ now: Date.parse(now) })).toEqual({ day, resetAt })
  })
})

function createSystemUnderTest({ originStatus = 200 } = {}) {
  const originPaths = []
  vi.stubGlobal('fetch', vi.fn(async (request) => {
    originPaths.push(new URL(request.url).pathname)
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
  const send = ({ path, clientIp, method = 'POST', cookie }) => worker.fetch(new Request(`https://demo.example${path}`, {
    method,
    headers: { 'cf-connecting-ip': clientIp, ...(cookie === undefined ? {} : { cookie }) },
    ...(method === 'POST' ? { body: '{}' } : {}),
  }), environment)
  const repeat = async (count, sendOne) => {
    for (let index = 0; index < count; index += 1) await sendOne(index)
  }
  const startPreparation = ({ clientIp, cookie }) => send({ path: '/api/explainable-job-posting-extraction', clientIp, cookie })
  const sendModelRequest = ({ clientIp }) => send({ path: '/api/resume-section-writing', clientIp })
  const requestRender = ({ clientIp }) => send({ path: '/api/resume-document', clientIp })

  return {
    startPreparation,
    sendModelRequest,
    requestRender,
    openPage: ({ clientIp }) => send({ path: '/', clientIp, method: 'GET' }),
    givenPreparationsStarted: ({ clientIp, count }) => repeat(count, () => startPreparation({ clientIp })),
    givenPreparationsFromDistinctIps: ({ count }) => repeat(count, (index) => startPreparation({ clientIp: `203.0.113.${String(index)}` })),
    givenModelRequestsSent: ({ clientIp, count }) => repeat(count, () => sendModelRequest({ clientIp })),
    givenRendersRequested: ({ clientIp, count }) => repeat(count, () => requestRender({ clientIp })),
    originRequests: () => originPaths,
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
