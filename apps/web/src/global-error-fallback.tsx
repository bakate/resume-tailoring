import { Button, Group } from '@mantine/core'
import { useEffect } from 'react'

import { BrandMark } from './brand-mark'
import { reportUncaughtRenderError } from './composition-root'
import { LocalizationFailure, useLocalization } from './localization/localization'

/**
 * Replaces a page that threw while rendering. The Candidate Session lives in this browser, so reloading or returning
 * to the documents restores the Candidate Session.
 */
export function GlobalErrorFallback() {
  useEffect(() => { reportUncaughtRenderError() }, [])
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  const { translate } = localizationResult.value
  return (
    <main className="standalone-page">
      <p className="standalone-page-brand"><BrandMark size={28} />{translate('brand.name')}</p>
      <h1>{translate('safetyNet.title')}</h1>
      <p>{translate('safetyNet.explanation')}</p>
      <Group>
        <Button onClick={() => { window.location.reload() }}>{translate('safetyNet.reload')}</Button>
        {/* A full navigation leaves the crashed state behind; a router navigation would keep it. */}
        <Button component="a" href="/" variant="default">{translate('safetyNet.returnToDocuments')}</Button>
      </Group>
    </main>
  )
}
