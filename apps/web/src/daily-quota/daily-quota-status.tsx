import { Text } from '@mantine/core'
import { useEffect, useSyncExternalStore } from 'react'

import type { Localization } from '../localization/localization'
import { dailyQuota, formatDailyQuotaReset } from './daily-quota'

/** The Daily Quota the edge last announced; asked once when shown, without spending anything. */
function useDailyQuota() {
  useEffect(() => { void dailyQuota.refresh(fetch) }, [])
  return useSyncExternalStore(dailyQuota.subscribe, dailyQuota.read, () => null)
}

/** Before a preparation starts: the free resumes left today, or when they come back. */
export function DailyQuotaStatus({ localization }: Readonly<{ localization: Localization }>) {
  const quota = useDailyQuota()
  const { translate } = localization
  if (quota === null) return null
  return <Text c="dimmed" size="sm">{quota.remaining > 0
    ? translate('dailyQuota.remaining').replace('{count}', String(quota.remaining))
    : translate('dailyQuota.none').replace('{time}',
      formatDailyQuotaReset({ locale: localization.locale, resetAt: new Date(quota.resetAt) }))}</Text>
}
