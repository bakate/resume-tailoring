import type { PrivacySafeAnalyticsEvent } from './privacy-safe-analytics'
import { privacySafeAnalyticsEventSchema } from './privacy-safe-analytics'

type AnalyticsEventWriter = (event: PrivacySafeAnalyticsEvent) => void

export function recordPrivacySafeAnalytics({ value, writeEvent }: Readonly<{
  value: unknown
  writeEvent: AnalyticsEventWriter
}>) {
  const event = privacySafeAnalyticsEventSchema.safeParse(value)
  if (!event.success) return { ok: false } as const
  writeEvent(event.data)
  return { ok: true } as const
}

export function writePrivacySafeAnalyticsEvent(event: PrivacySafeAnalyticsEvent) {
  console.info(JSON.stringify(createPrivacySafeAggregateMetric(event)))
}

/**
 * A preparation phase timing also carries the DeepSeek pricing window its phase started in, so provider load can be
 * told apart from our own latency. The start is read back from the server's clock: arrival less the duration.
 */
export function createPrivacySafeAggregateMetric(event: PrivacySafeAnalyticsEvent,
  { recordedAt = Date.now() }: Readonly<{ recordedAt?: number }> = {}) {
  const { name: metric, ...dimensions } = event
  return {
    category: 'privacy-safe-mvp-analytics',
    metric,
    value: 1,
    dimensions: event.name === 'preparation-phase-timed'
      ? { ...dimensions, deepSeekWindow: readDeepSeekPricingWindow(recordedAt - event.durationMilliseconds) } : dimensions,
  } as const
}

/** DeepSeek's documented peak hours: 01:00–04:00 and 06:00–10:00 UTC on weekdays; every other hour is off-peak. */
export function readDeepSeekPricingWindow(instant: number): 'peak' | 'off-peak' {
  const date = new Date(instant)
  const weekday = date.getUTCDay() >= 1 && date.getUTCDay() <= 5
  const hour = date.getUTCHours()
  return weekday && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10)) ? 'peak' : 'off-peak'
}
