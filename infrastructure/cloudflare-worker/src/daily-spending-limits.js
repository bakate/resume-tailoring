/* global Response */

/**
 * The daily limits that bound model spending, each reset at 00:00 Europe/Paris. Measured on 32 real preparations
 * (2026-10): one sends 21 section requests on average, 30 at p90 and 46 at most, plus three for intake and matching,
 * and costs about $0.10.
 */
export const dailyLimits = {
  /** The Daily Quota: Tailored Resumes one client network may start per day. */
  dailyQuota: 4,
  /** Tailored Resumes all Candidates together may start per day: 30 at $0.10 stay near $90 a month. */
  preparationsOverall: 30,
  /** Model-backed requests per client network: four journeys with edits stay under 250, so it only stops loops. */
  modelRequestsPerClient: 400,
  /** PDF renders per client network: one per saved edit. */
  rendersPerClient: 200,
}

/** The Job Posting extraction starts a Tailored Resume, so it uses one unit of the Daily Quota. */
const preparationPath = '/api/explainable-job-posting-extraction'
const modelBackedPaths = new Set([
  '/api/structured-source-profile-extraction',
  preparationPath,
  '/api/explainable-match-evidence',
  '/api/resume-claim-validation',
  '/api/resume-claim-writing',
  '/api/resume-section-writing',
  '/api/resume-section-validation',
  '/api/resume-document-coherence',
])
const renderPath = '/api/resume-document'

/** The counters a request consumes, or none when its route is not limited. */
export function readLimitedCounters({ method, pathname }) {
  if (method !== 'POST') return []
  if (pathname === preparationPath) return ['model-requests', 'preparations']
  if (modelBackedPaths.has(pathname)) return ['model-requests']
  if (pathname === renderPath) return ['renders']
  return []
}

const clientLimits = {
  preparations: dailyLimits.dailyQuota,
  'model-requests': dailyLimits.modelRequestsPerClient,
  renders: dailyLimits.rendersPerClient,
}
const dayKey = 'day'

/**
 * Durable Object holding today's counters. One instance serves every request, so checking and consuming a limit is
 * atomic. It keeps only keyed digests of client networks and forgets everything at the daily reset.
 */
export class DailySpendingLimits {
  #storage

  constructor(state) {
    this.#storage = state.storage
  }

  async fetch(request) {
    const { operation, reservation } = await request.json()
    if (operation === 'reserve') return Response.json(await this.#reserve(reservation))
    if (operation === 'release') return Response.json(await this.#release(reservation))
    return new Response('Unknown operation', { status: 400 })
  }

  async alarm() {
    await this.#storage.deleteAll()
  }

  /** Consumes one unit of every counter, or none when any of them is exhausted. */
  async #reserve({ clientKey, counters }) {
    const window = readDailyWindow({ now: Date.now() })
    await this.#startDay(window)
    const keys = readCounterKeys({ clientKey, counters })
    const counts = await this.#readCounts(keys)
    const allowed = keys.every(({ limit }, position) => counts[position] < limit)
    if (!allowed) {
      return { allowed, resetAt: window.resetAt, remainingDailyQuota: hasDailyQuota(keys) ? 0 : undefined }
    }
    const consumed = counts.map((count) => count + 1)
    await Promise.all(keys.map(({ key }, position) => this.#storage.put(key, consumed[position])))
    return {
      allowed,
      reservation: { clientKey, counters, day: window.day },
      resetAt: window.resetAt,
      remainingDailyQuota: readRemainingDailyQuota({ keys, counts: consumed }),
    }
  }

  /** Gives back what a reservation consumed, unless the day already changed. */
  async #release({ clientKey, counters, day }) {
    const keys = readCounterKeys({ clientKey, counters })
    if ((await this.#storage.get(dayKey)) === day) {
      const counts = await this.#readCounts(keys)
      await Promise.all(keys.map(({ key }, position) => this.#storage.put(key, Math.max(0, counts[position] - 1))))
    }
    return { remainingDailyQuota: readRemainingDailyQuota({ keys, counts: await this.#readCounts(keys) }) }
  }

  #readCounts(keys) {
    return Promise.all(keys.map(async ({ key }) => (await this.#storage.get(key)) ?? 0))
  }

  async #startDay({ day, resetAt }) {
    if ((await this.#storage.get(dayKey)) === day) return
    await this.#storage.deleteAll()
    await this.#storage.put(dayKey, day)
    await this.#storage.setAlarm(Date.parse(resetAt))
  }
}

/** The stored counters behind a request's counters; a preparation also counts towards the global ceiling. */
function readCounterKeys({ clientKey, counters }) {
  return counters.flatMap((counter) => counter === 'preparations'
    ? [
      { key: `${clientKey}:preparations`, limit: dailyLimits.dailyQuota, boundsDailyQuota: true },
      { key: 'overall:preparations', limit: dailyLimits.preparationsOverall, boundsDailyQuota: true },
    ]
    : [{ key: `${clientKey}:${counter}`, limit: clientLimits[counter], boundsDailyQuota: false }])
}

function hasDailyQuota(keys) {
  return keys.some(({ boundsDailyQuota }) => boundsDailyQuota)
}

/** Both the client's Daily Quota and the global ceiling bound the Tailored Resumes it can still start today. */
function readRemainingDailyQuota({ keys, counts }) {
  if (!hasDailyQuota(keys)) return undefined
  return Math.max(0, Math.min(...keys.flatMap(({ limit, boundsDailyQuota }, position) =>
    boundsDailyQuota ? [limit - counts[position]] : [])))
}

/** Today's calendar day in Europe/Paris and the instant of the next 00:00 there. */
function readDailyWindow({ now }) {
  const today = readParisDate(now)
  const tomorrowAtUtcMidnight = Date.UTC(today.year, today.month - 1, today.day + 1)
  // Paris is ahead of UTC, so midnight there happens earlier; a second pass settles a DST change between the two.
  let resetAt = tomorrowAtUtcMidnight - readParisOffset(tomorrowAtUtcMidnight)
  resetAt = tomorrowAtUtcMidnight - readParisOffset(resetAt)
  const day = `${String(today.year)}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`
  return { day, resetAt: new Date(resetAt).toISOString() }
}

const parisDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
})

function readParisDate(instant) {
  return Object.fromEntries(parisDateFormat.formatToParts(new Date(instant))
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]))
}

function readParisOffset(instant) {
  const parts = readParisDate(instant)
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return wallClock - Math.floor(instant / 1000) * 1000
}
