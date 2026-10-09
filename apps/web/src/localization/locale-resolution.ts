export type Locale = 'en' | 'fr'

export const defaultLocale: Locale = 'en'
export const localeStorageKey = 'honest-resume-locale'

/**
 * Search engines and link previews rarely state a language; they read the page in French, like its search metadata,
 * for the audience the product addresses first.
 */
const unstatedLanguageLocale: Locale = 'fr'

/** Set on `<html>` before the first paint when the browser will switch the page to another language than the server's. */
const localePendingAttribute = 'data-locale-pending'

export function parseLocale({ value }: Readonly<{ value: string | null | undefined }>): Locale | null {
  return value === 'en' || value === 'fr' ? value : null
}

/** The first supported language in order of preference, or English when none is supported. */
export function readSupportedLocale({ languages }: Readonly<{ languages: readonly string[] }>): Locale {
  for (const language of languages) {
    const [languageCode] = language.toLowerCase().split('-')
    const locale = parseLocale({ value: languageCode })
    if (locale !== null) return locale
  }
  return defaultLocale
}

/** In the browser, a language the Candidate chose wins over the languages the browser prefers. */
export function readBrowserLocale({ languages, storedLocale }: Readonly<{
  languages: readonly string[]
  storedLocale: string | null
}>): Locale {
  return parseLocale({ value: storedLocale }) ?? readSupportedLocale({ languages })
}

/** On the server, the request's `Accept-Language` header stands for the languages the browser prefers. */
export function readRequestLocale({ acceptLanguage }: Readonly<{ acceptLanguage: string | undefined }>): Locale {
  const languages = parseAcceptLanguage({ acceptLanguage })
  return languages.length === 0 ? unstatedLanguageLocale : readSupportedLocale({ languages })
}

/**
 * Runs in `<head>` before the body is parsed. When the language the browser will settle on differs from the one the
 * server rendered, the page stays hidden until it does, instead of flashing the other language. Without JavaScript it
 * never runs, so the server-rendered page is always readable.
 *
 * It repeats `readBrowserLocale`, which cannot be imported into an inline script; a test keeps the two in step.
 */
export const localeMismatchScript = `(() => {
  const root = document.documentElement
  let storedLocale = null
  try { storedLocale = localStorage.getItem(${JSON.stringify(localeStorageKey)}) } catch {}
  let locale = storedLocale === 'en' || storedLocale === 'fr' ? storedLocale : null
  for (const language of locale === null ? navigator.languages : []) {
    const languageCode = language.toLowerCase().split('-')[0]
    if (languageCode === 'en' || languageCode === 'fr') { locale = languageCode; break }
  }
  if ((locale ?? ${JSON.stringify(defaultLocale)}) !== root.lang) root.setAttribute(${JSON.stringify(localePendingAttribute)}, '')
})()`

/** Once the page speaks the browser's language, it is shown again. */
export function revealLocalizedPage() {
  document.documentElement.removeAttribute(localePendingAttribute)
}

function parseAcceptLanguage({ acceptLanguage }: Readonly<{ acceptLanguage: string | undefined }>) {
  return (acceptLanguage ?? '').split(',')
    .map((entry, position) => {
      const [tag = '', ...parameters] = entry.split(';').map((part) => part.trim())
      const quality = parameters.find((parameter) => parameter.startsWith('q='))
      return { position, quality: quality === undefined ? 1 : Number(quality.slice(2)), tag }
    })
    .filter(({ quality, tag }) => tag !== '' && tag !== '*' && quality > 0)
    .sort((first, second) => second.quality - first.quality || first.position - second.position)
    .map(({ tag }) => tag)
}
