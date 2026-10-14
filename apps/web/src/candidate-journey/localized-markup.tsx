import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import type { Locale, Localization } from '../localization/localization'
import { LocalizationProvider, useLocalization } from '../localization/localization'

/** The static markup of a component rendered in one interface language, as component tests read it. */
export function renderLocalizedMarkup({ locale, render }: Readonly<{
  locale: Locale; render: (localization: Localization) => ReactNode
}>) {
  return renderToStaticMarkup(<MantineProvider><LocalizationProvider renderedLocale={locale}>
    <WithLocalization>{render}</WithLocalization>
  </LocalizationProvider></MantineProvider>).replaceAll('&#x27;', '\'')
}

function WithLocalization({ children }: Readonly<{ children: (localization: Localization) => ReactNode }>) {
  const localization = useLocalization()
  return localization.ok ? children(localization.value) : null
}
