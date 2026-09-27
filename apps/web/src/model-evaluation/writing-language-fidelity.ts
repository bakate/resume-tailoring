export function matchesExpectedLocale({ locale, value }: Readonly<{
  locale: 'en' | 'fr'
  value: string
}>) {
  const normalizedValue = normalizeLanguageText({ value })
  if (locale === 'fr') {
    return /\b(cree|developpe|developpement|realise)\b.+\bplateforme de facturation\b.+\b(avec|en|en utilisant)\b.+\btypescript\b/u
      .test(normalizedValue)
      && !/\b(billing|built|created|developed|using|with)\b/u.test(normalizedValue)
  }
  return /\b(built|created|developed)\b.+\bbilling platform\b.+\b(using|with)\b.+\btypescript\b/u
    .test(normalizedValue)
    && !/\b(avec|creation|developpe|developpement|une|realise|sous|utilise)\b/u
      .test(normalizedValue)
}

function normalizeLanguageText({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()
}
