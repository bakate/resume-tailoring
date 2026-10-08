/* global Response */

/**
 * The daily limits that bound model spending. Each counts requests from one client IP, except the global ceiling,
 * which counts Tailored Resume preparations across all Candidates. Every window resets at 00:00 Europe/Paris.
 */
export const dailyLimits = {
  /** Tailored Resume preparations one client IP may start per day: the free daily quota the Candidate sees. */
  preparationsPerClient: 4,
  /** Tailored Resume preparations all Candidates together may start per day. Provisional: ≈ $0.10 each. */
  preparationsOverall: 30,
  /** Model-backed requests one client IP may send per day: a safety net that stops edit loops. */
  modelRequestsPerClient: 400,
  /** PDF renders one client IP may request per day. */
  rendersPerClient: 200,
}

/** The Job Posting extraction is the request that starts a Tailored Resume preparation. */
export const preparationPath = '/api/explainable-job-posting-extraction'

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
  preparations: dailyLimits.preparationsPerClient,
  'model-requests': dailyLimits.modelRequestsPerClient,
  renders: dailyLimits.rendersPerClient,
}
const overallPreparationsKey = 'overall:preparations'
const dayKey = 'day'
const parisTimeZone = 'Europe/Paris'

/**
 * Durable Object holding today's counters. One instance serves every request, so checking and consuming a limit is
 * atomic. It keeps only keyed digests of client IPs and forgets everything at the daily reset.
 */
export class DailySpendingLimits {
  #storage

  constructor(state) {
    this.#storage = state.storage
  }

  async fetch(request) {
    const { operation, clientKey, counters, day } = await request.json()
    if (operation === 'reserve') return Response.json(await this.#reserve({ clientKey, counters }))
    if (operation === 'release') return Response.json(await this.#release({ clientKey, counters, day }))
    return new Response('Unknown operation', { status: 400 })
  }

  async alarm() {
    await this.#storage.deleteAll()
  }

  /** Consumes one unit of every counter, or none when any of them is exhausted. */
  async #reserve({ clientKey, counters }) {
    const window = readDailyWindow({ now: Date.now() })
    await this.#startDay(window)
    const keys = counters.map((counter) => ({ key: `${clientKey}:${counter}`, limit: clientLimits[counter] }))
    if (counters.includes('preparations')) keys.push({ key: overallPreparationsKey, limit: dailyLimits.preparationsOverall })
    const counts = await Promise.all(keys.map(async ({ key }) => (await this.#storage.get(key)) ?? 0))
    const allowed = keys.every(({ limit }, position) => counts[position] < limit)
    if (allowed) await Promise.all(keys.map(({ key }, position) => this.#storage.put(key, counts[position] + 1)))
    const consumed = allowed ? 1 : 0
    // Both the client quota and the global ceiling bound the preparations this client can still start today.
    const remainingPreparations = counters.includes('preparations')
      ? Math.max(0, Math.min(...keys.flatMap(({ key, limit }, position) =>
        key.endsWith(':preparations') ? [limit - counts[position] - consumed] : [])))
      : undefined
    return { allowed, day: window.day, resetAt: window.resetAt, remainingPreparations }
  }

  /** Gives back what a reservation consumed when the origin did not serve it, unless the day already changed. */
  async #release({ clientKey, counters, day }) {
    if ((await this.#storage.get(dayKey)) !== day) return { released: false }
    const keys = counters.map((counter) => `${clientKey}:${counter}`)
    if (counters.includes('preparations')) keys.push(overallPreparationsKey)
    await Promise.all(keys.map(async (key) => {
      const count = (await this.#storage.get(key)) ?? 0
      if (count > 0) await this.#storage.put(key, count - 1)
    }))
    return { released: true }
  }

  async #startDay({ day, resetAt }) {
    if ((await this.#storage.get(dayKey)) === day) return
    await this.#storage.deleteAll()
    await this.#storage.put(dayKey, day)
    await this.#storage.setAlarm(Date.parse(resetAt))
  }
}

/** Today's calendar day in Europe/Paris and the instant of the next 00:00 there. */
export function readDailyWindow({ now }) {
  const today = readParisDate(now)
  const tomorrowAtUtcMidnight = Date.UTC(today.year, today.month - 1, today.day + 1)
  // Paris is ahead of UTC, so midnight there happens earlier; a second pass settles a DST change between the two.
  let resetAt = tomorrowAtUtcMidnight - readParisOffset(tomorrowAtUtcMidnight)
  resetAt = tomorrowAtUtcMidnight - readParisOffset(resetAt)
  const day = `${String(today.year)}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`
  return { day, resetAt: new Date(resetAt).toISOString() }
}

const parisDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: parisTimeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
})

function readParisDate(instant) {
  const parts = Object.fromEntries(parisDateFormat.formatToParts(new Date(instant))
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]))
  return parts
}

function readParisOffset(instant) {
  const parts = readParisDate(instant)
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return wallClock - Math.floor(instant / 1000) * 1000
}
