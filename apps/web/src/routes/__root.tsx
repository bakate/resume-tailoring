import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  LocalizationFailure,
  LocalizationProvider,
  defaultDocumentTitle,
  useLocalization,
} from '../localization/localization'
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
  const { locale, readiness } = localizationResult.value
  return (
    <RootDocument locale={locale} readiness={readiness}>
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

function RootDocument({ children, locale, readiness }: Readonly<{
  children: ReactNode
  locale: 'en' | 'fr'
  readiness: 'pending' | 'ready'
}>) {
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
  return (
    <RootDocument locale="en" readiness="ready">
      <LocalizationFailure />
    </RootDocument>
  )
}

const pendingLocaleStyle = { visibility: 'hidden' } as const
