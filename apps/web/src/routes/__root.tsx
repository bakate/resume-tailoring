import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { MantineProvider } from '@mantine/core'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { candidateJourneyCssVariablesResolver, candidateJourneyTheme } from '../candidate-journey/candidate-journey-theme'
import { listenForUncaughtBrowserErrors } from '../composition-root'
import { GlobalErrorFallback } from '../global-error-fallback'
import {
  LocalizationFailure,
  LocalizationProvider,
  defaultDocumentTitle,
  useLocalization,
} from '../localization/localization'
import type { Locale, Localization } from '../localization/localization'
// Served from our own origin so no request from the Candidate's browser reaches a font provider.
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/600.css'
import '@fontsource/dm-serif-display/400.css'
import '@mantine/core/styles.css'
import '@mantine/dropzone/styles.css'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { title: defaultDocumentTitle },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
    ],
  }),
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <LocalizationProvider>
      <LocalizedRoot>
        <Outlet />
      </LocalizedRoot>
    </LocalizationProvider>
  )
}

/** The root route renders the document itself, so its fallback must render the document too. */
function RootErrorComponent() {
  return (
    <LocalizationProvider>
      <LocalizedRoot>
        <GlobalErrorFallback />
      </LocalizedRoot>
    </LocalizationProvider>
  )
}

function LocalizedRoot({ children }: Readonly<{ children: ReactNode }>) {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationUnavailableDocument />
  const { locale, readiness } = localizationResult.value
  return (
    <RootDocument locale={locale} readiness={readiness}>
      {children}
    </RootDocument>
  )
}

function NotFound() {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  const { translate } = localizationResult.value
  return (
    <main className="standalone-page">
      <p className="standalone-page-brand">{translate('brand.name')}</p>
      <h1>{translate('notFound.title')}</h1>
      <p>{translate('notFound.description')}</p>
      <Link to="/">{translate('notFound.return')}</Link>
    </main>
  )
}

function RootDocument({ children, locale, readiness }: Readonly<{
  children: ReactNode
  locale: Locale
  readiness: Localization['readiness']
}>) {
  useEffect(() => listenForUncaughtBrowserErrors(), [])
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning style={readiness === 'pending' ? pendingLocaleStyle : undefined}>
        <MantineProvider cssVariablesResolver={candidateJourneyCssVariablesResolver} theme={candidateJourneyTheme}>{children}</MantineProvider>
        <Scripts />
      </body>
    </html>
  )
}

function LocalizationUnavailableDocument() {
  return (
    <RootDocument locale="en" readiness="ready">
      <LocalizationFailure />
    </RootDocument>
  )
}

const pendingLocaleStyle = { visibility: 'hidden' } as const
