import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  LocalizationProvider,
  defaultDocumentTitle,
  localizationUnavailableMessage,
  useLocalization,
} from '../localization/localization'
import type { Localization } from '../localization/localization'
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
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=DM+Serif+Display&display=swap',
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  return (
    <LocalizationProvider>
      <LocalizedRoot />
    </LocalizationProvider>
  )
}

function LocalizedRoot() {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationUnavailableDocument />
  return (
    <RootDocument localization={localizationResult.value}>
      <Outlet />
    </RootDocument>
  )
}

function NotFound() {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  const { translate } = localizationResult.value
  return (
    <main className="not-found">
      <p className="not-found-brand">{translate('brand.name')}</p>
      <h1>{translate('notFound.title')}</h1>
      <p>{translate('notFound.description')}</p>
      <Link to="/">{translate('notFound.return')}</Link>
    </main>
  )
}

function RootDocument({ children, localization }: Readonly<{
  children: ReactNode
  localization: Localization
}>) {
  const { locale, readiness } = localization
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body style={readiness === 'pending' ? pendingLocaleStyle : undefined}>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function LocalizationUnavailableDocument() {
  const localization = {
    locale: 'en',
    preferencePersistenceError: null,
    readiness: 'ready',
    selectLocale: () => undefined,
    translate: () => localizationUnavailableMessage,
  } as const satisfies Localization
  return <RootDocument localization={localization}><LocalizationFailure /></RootDocument>
}

function LocalizationFailure() {
  return <p role="alert">{localizationUnavailableMessage}</p>
}

const pendingLocaleStyle = { visibility: 'hidden' } as const
