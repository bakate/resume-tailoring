import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server'

import { defaultLocale, parseLocale, readRequestLocale } from './locale-resolution'
import type { Locale } from './locale-resolution'

/**
 * The language the page is rendered in before the browser reads the Candidate's choice. The server decides it from the
 * request; the browser keeps what the server rendered, so hydration matches.
 */
export const readRenderedLocale = createIsomorphicFn()
  .server((): Locale => {
    // The page's language now depends on this header, so a shared cache must not serve one language for another.
    setResponseHeader('vary', 'Accept-Language')
    return readRequestLocale({ acceptLanguage: getRequestHeader('accept-language') })
  })
  .client((): Locale => parseLocale({ value: document.documentElement.lang }) ?? defaultLocale)
