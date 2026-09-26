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
      <RootDocument>
        <Outlet />
      </RootDocument>
    </LocalizationProvider>
  )
}

function NotFound() {
  const { translate } = useLocalization()
  return (
    <main className="not-found">
      <p className="not-found-brand">{translate('brand.name')}</p>
      <h1>{translate('notFound.title')}</h1>
      <p>{translate('notFound.description')}</p>
      <Link to="/">{translate('notFound.return')}</Link>
    </main>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  const { locale } = useLocalization()
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
