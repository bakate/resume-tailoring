import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

import { localeMismatchScript, localeStorageKey, readBrowserLocale, readRequestLocale } from './locale-resolution'

describe('Locale resolution on the server', () => {
  it.each([
    { acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8', locale: 'fr' },
    { acceptLanguage: 'en-GB,en;q=0.9', locale: 'en' },
    { acceptLanguage: 'de-DE,fr;q=0.7,en;q=0.9', locale: 'en' },
    { acceptLanguage: 'en;q=0.4, FR-ca', locale: 'fr' },
    { acceptLanguage: 'de-DE,es;q=0.8', locale: 'en' },
    { acceptLanguage: 'fr;q=0, en', locale: 'en' },
  ] as const)('reads $locale from Accept-Language "$acceptLanguage"', ({ acceptLanguage, locale }) => {
    expect(readRequestLocale({ acceptLanguage })).toBe(locale)
  })

  it.each([undefined, '', '*'])('renders French, like the search metadata, when the request states no language (%j)', (acceptLanguage) => {
    expect(readRequestLocale({ acceptLanguage })).toBe('fr')
  })
})

describe('Locale resolution in the browser', () => {
  it.each([
    { storedLocale: 'en', languages: ['fr-FR'], locale: 'en' },
    { storedLocale: null, languages: ['fr-FR', 'en'], locale: 'fr' },
    { storedLocale: 'de', languages: ['de', 'fr'], locale: 'fr' },
    { storedLocale: null, languages: ['de'], locale: 'en' },
  ] as const)('prefers the stored $storedLocale over $languages', ({ languages, locale, storedLocale }) => {
    expect(readBrowserLocale({ languages, storedLocale })).toBe(locale)
  })

  it.each([
    { renderedLocale: 'fr', storedLocale: null, languages: ['fr-FR'] },
    { renderedLocale: 'fr', storedLocale: 'en', languages: ['fr-FR'] },
    { renderedLocale: 'en', storedLocale: null, languages: ['fr-CA', 'en'] },
    { renderedLocale: 'en', storedLocale: 'de', languages: ['de'] },
    { renderedLocale: 'en', storedLocale: 'unreadable', languages: ['fr'] },
  ] as const)('hides a page rendered in $renderedLocale only until it can speak the browser\'s language', (scenario) => {
    const isHidden = runLocaleMismatchScript(scenario)

    expect(isHidden).toBe(readBrowserLocale({
      languages: scenario.languages,
      storedLocale: scenario.storedLocale === 'unreadable' ? null : scenario.storedLocale,
    }) !== scenario.renderedLocale)
  })
})

/** Runs the inline script against a stand-in document, as the browser would before parsing the body. */
function runLocaleMismatchScript({ languages, renderedLocale, storedLocale }: Readonly<{
  languages: readonly string[]
  renderedLocale: string
  storedLocale: string | null
}>) {
  const attributes = new Set<string>()
  const document = { documentElement: { lang: renderedLocale, setAttribute: (name: string) => { attributes.add(name) } } }
  const localStorage = {
    getItem: (key: string) => {
      if (storedLocale === 'unreadable') throw new Error('Storage is blocked')
      return key === localeStorageKey ? storedLocale : null
    },
  }
  runInNewContext(localeMismatchScript, { document, localStorage, navigator: { languages } })
  return attributes.size > 0
}
