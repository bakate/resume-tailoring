import { z } from 'zod'

/** How many Tailored Resumes this client network may still start for free today, and when the count resets. */
export type DailyQuota = Readonly<{ remaining: number; resetAt: string }>

export type DailyQuotaStore = Readonly<{
  read: () => DailyQuota | null
  /** Reads the Daily Quota the edge announces on a response, when it announces one. */
  observe: (response: Response) => void
  /** Asks the edge without spending anything; without an edge, as in development, the Daily Quota stays unknown. */
  refresh: (request: typeof fetch) => Promise<void>
  subscribe: (listener: () => void) => () => void
}>

export function createDailyQuotaStore(): DailyQuotaStore {
  let quota: DailyQuota | null = null
  const listeners = new Set<() => void>()
  const update = (next: DailyQuota | null) => {
    if (next === null || (next.remaining === quota?.remaining && next.resetAt === quota.resetAt)) return
    quota = next
    listeners.forEach((listener) => { listener() })
  }
  return {
    read: () => quota,
    observe: (response) => { update(readAnnouncedQuota(response.headers)) },
    refresh: async (request) => {
      try {
        const response = await request('/api/daily-quota', { cache: 'no-store' })
        const answered = dailyQuotaResponseSchema.safeParse(await response.json())
        if (answered.success) update(answered.data.value)
      } catch { /* The Daily Quota stays unknown until a preparation announces it. */ }
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

function readAnnouncedQuota(headers: Headers): DailyQuota | null {
  const remaining = headers.get('x-resume-quota-remaining')
  const resetAt = headers.get('x-resume-quota-reset')
  if (remaining === null || resetAt === null || !/^\d+$/u.test(remaining) || Number.isNaN(Date.parse(resetAt))) return null
  return { remaining: Number(remaining), resetAt }
}

/**
 * The next 00:00 Europe/Paris, when every Daily Quota resets. It needs no edge, so a failure kept across a reload
 * still names the right time.
 */
export function readNextDailyQuotaReset(now: number) {
  const today = readParisDate(now)
  const tomorrowAtUtcMidnight = Date.UTC(today.year, today.month - 1, today.day + 1)
  // Paris is ahead of UTC, so midnight there happens earlier; a second pass settles a DST change between the two.
  const firstGuess = tomorrowAtUtcMidnight - readParisOffset(tomorrowAtUtcMidnight)
  return new Date(tomorrowAtUtcMidnight - readParisOffset(firstGuess))
}

/** The reset instant as the Candidate's own clock shows it, such as 00:00 in Paris or 23:00 in London. */
export function formatDailyQuotaReset({ locale, resetAt }: Readonly<{ locale: string; resetAt: Date }>) {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(resetAt)
}

/** The local time at which the Daily Quota of a refused preparation comes back, whenever the failure is shown. */
export function formatNextDailyQuotaReset({ locale }: Readonly<{ locale: string }>) {
  return formatDailyQuotaReset({ locale, resetAt: readNextDailyQuotaReset(Date.now()) })
}

const parisDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Paris', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
})

function readParisDate(instant: number) {
  const parts = Object.fromEntries(parisDateFormat.formatToParts(new Date(instant))
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]))
  return parts as Readonly<Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>>
}

function readParisOffset(instant: number) {
  const parts = readParisDate(instant)
  const wallClock = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return wallClock - Math.floor(instant / 1000) * 1000
}

const dailyQuotaResponseSchema = z.object({
  ok: z.literal(true),
  value: z.object({ remaining: z.number().int().nonnegative(), resetAt: z.iso.datetime() }),
})
