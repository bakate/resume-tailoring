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

export function createPrivacySafeAggregateMetric(event: PrivacySafeAnalyticsEvent) {
  const { name: metric, ...dimensions } = event
  return {
    category: 'privacy-safe-mvp-analytics',
    metric,
    value: 1,
    dimensions,
  } as const
}
