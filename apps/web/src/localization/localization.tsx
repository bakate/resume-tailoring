import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const englishCatalog = {
  'brand.homeLabel': 'Honest Resume home',
  'brand.name': 'Honest Resume',
  'brand.tagline': 'A more honest way to get hired.',
  'locale.english': 'English',
  'locale.french': 'Français',
  'locale.persistenceFailure': 'Your language preference could not be saved.',
  'locale.unavailable': 'The interface language is unavailable.',
  'locale.switcherLabel': 'Language',
  'hero.title': 'Tailor your resume without inventing a thing.',
  'hero.lede': 'Build a focused resume from facts you have reviewed and approved.',
  'session.start': 'Start tailoring',
  'session.delete': 'Delete private session',
  'session.loadFailure': 'Your private session could not be loaded.',
  'session.openFailure': 'The workflow could not be opened. Try again.',
  'session.deleteFailure': 'Your private session could not be deleted. Try again.',
  'privacy.retention': 'Candidate content you add stays in this browser and expires locally after 24 hours. Downloaded files remain on your device and are outside this automatic expiration.',
  'workflow.title': 'Your workflow',
  'workflow.opened': 'Workflow opened',
  'workflow.openedDescription': 'Your Source Profile is the next step.',
  'workflow.ready': 'Ready to begin',
  'workflow.readyDescription': 'Click “Start tailoring” to begin your workflow.',
  'workflow.sourceProfile': 'Source Profile',
  'workflow.sourceProfileDescription': 'Use your existing resume or career details as the source of truth.',
  'workflow.jobPosting': 'Job Posting',
  'workflow.jobPostingDescription': 'Add the Job Posting you are targeting so we can identify what to highlight.',
  'workflow.tailoredResume': 'Tailored Resume',
  'workflow.tailoredResumeDescription': 'Review a focused resume based only on your approved facts.',
  'value.controlTitle': 'You stay in control',
  'value.controlText': 'Only use information you have reviewed and approved.',
  'value.focusTitle': 'A more focused story',
  'value.focusText': 'Show the most relevant version of your experience.',
  'value.opportunitiesTitle': 'Built for real opportunities',
  'value.opportunitiesText': 'Tailor with confidence, apply with integrity.',
  'notFound.title': 'Page not found',
  'notFound.description': 'The page you requested does not belong to this Resume Tailoring workflow.',
  'notFound.return': 'Return to the workflow',
} as const

type TranslationKey = keyof typeof englishCatalog
type TranslationCatalog = Readonly<Record<TranslationKey, string>>

const frenchCatalog = {
  'brand.homeLabel': "Accueil d'Honest Resume",
  'brand.name': 'Honest Resume',
  'brand.tagline': 'Une manière plus honnête de décrocher un emploi.',
  'locale.english': 'Anglais',
  'locale.french': 'Français',
  'locale.persistenceFailure': "On n'a pas pu enregistrer ta préférence de langue.",
  'locale.unavailable': "La langue de l'interface n'est pas disponible.",
  'locale.switcherLabel': 'Langue',
  'hero.title': 'Adapte ton CV sans rien inventer.',
  'hero.lede': 'Crée un CV ciblé à partir des informations que tu as vérifiées et approuvées.',
  'session.start': "Commencer à adapter mon CV",
  'session.delete': 'Supprimer ma session privée',
  'session.loadFailure': "On n'a pas pu charger ta session privée.",
  'session.openFailure': "On n'a pas pu ouvrir ton parcours. Réessaie.",
  'session.deleteFailure': "On n'a pas pu supprimer ta session privée. Réessaie.",
  'privacy.retention': "Le contenu que tu ajoutes reste dans ce navigateur et expire localement après 24 heures. Les fichiers téléchargés restent sur ton appareil et ne sont pas concernés par cette expiration automatique.",
  'workflow.title': 'Ton parcours',
  'workflow.opened': 'Parcours ouvert',
  'workflow.openedDescription': 'Ton Profil Source est la prochaine étape.',
  'workflow.ready': 'Prêt à te lancer',
  'workflow.readyDescription': 'Clique sur « Commencer à adapter mon CV » pour lancer ton parcours.',
  'workflow.sourceProfile': 'Profil Source',
  'workflow.sourceProfileDescription': 'Utilise ton CV actuel ou les détails de ta carrière comme source de vérité.',
  'workflow.jobPosting': "Offre d'emploi",
  'workflow.jobPostingDescription': "Ajoute l'Offre d'emploi que tu vises pour identifier les éléments à mettre en avant.",
  'workflow.tailoredResume': 'CV Adapté',
  'workflow.tailoredResumeDescription': 'Relis un CV ciblé fondé uniquement sur les faits que tu as approuvés.',
  'value.controlTitle': 'Tu gardes le contrôle',
  'value.controlText': 'Utilise uniquement les informations que tu as vérifiées et approuvées.',
  'value.focusTitle': 'Un parcours plus ciblé',
  'value.focusText': "Présente la version de ton expérience la plus pertinente.",
  'value.opportunitiesTitle': 'Conçu pour de vraies opportunités',
  'value.opportunitiesText': 'Adapte ton CV en toute confiance et postule avec intégrité.',
  'notFound.title': 'Page introuvable',
  'notFound.description': "La page demandée n'appartient pas à ce parcours d'adaptation de CV.",
  'notFound.return': 'Retourner au parcours',
} as const satisfies TranslationCatalog

export type Locale = 'en' | 'fr'

export type Localization = Readonly<{
  locale: Locale
  preferencePersistenceError: 'unavailable' | null
  readiness: 'pending' | 'ready'
  selectLocale: (locale: Locale) => void
  translate: (key: TranslationKey) => string
}>

export type LocalizationResult =
  | Readonly<{ ok: true; value: Localization }>
  | Readonly<{ ok: false; error: 'provider-missing' }>

type LocaleState = Pick<Localization, 'locale' | 'preferencePersistenceError' | 'readiness'>
type BrowserStorageResult<TValue> =
  | Readonly<{ ok: true; value: TValue }>
  | Readonly<{ ok: false; error: 'unavailable' }>

const catalogs: Readonly<Record<Locale, Partial<TranslationCatalog>>> = {
  en: englishCatalog,
  fr: frenchCatalog,
}
const defaultLocale: Locale = 'en'
const localeStorageKey = 'honest-resume-locale'
const pendingLocaleState = {
  locale: defaultLocale,
  preferencePersistenceError: null,
  readiness: 'pending',
} as const satisfies LocaleState
const LocalizationContext = createContext<Localization | null>(null)

export function LocalizationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [localeState, setLocaleState] = useState<LocaleState>(pendingLocaleState)
  useEffect(() => {
    setLocaleState(readInitialLocale())
  }, [])
  return (
    <LocalizationContext.Provider value={{
      ...localeState,
      selectLocale: (selectedLocale) => {
        selectLocale({ selectedLocale, setLocaleState })
      },
      translate: (key) => readTranslation({ locale: localeState.locale, key }),
    }}>
      {children}
    </LocalizationContext.Provider>
  )
}

export function useLocalization() {
  const localization = useContext(LocalizationContext)
  if (localization === null) return missingProviderResult
  return { ok: true, value: localization } as const
}

export const defaultDocumentTitle = englishCatalog['brand.name']
export const localizationUnavailableMessage = englishCatalog['locale.unavailable']

export function LocalizationFailure() {
  return <p role="alert">{localizationUnavailableMessage}</p>
}

function readInitialLocale(): LocaleState {
  const storedLocale = readStoredLocale()
  if (storedLocale.ok && storedLocale.value !== null) {
    return createReadyLocaleState({ locale: storedLocale.value, persistenceError: null })
  }
  return createReadyLocaleState({
    locale: readSupportedLocale({ languages: navigator.languages }),
    persistenceError: storedLocale.ok ? null : storedLocale.error,
  })
}

function readStoredLocale(): BrowserStorageResult<Locale | null> {
  try {
    const storedLocale = localStorage.getItem(localeStorageKey)
    return { ok: true, value: parseLocale({ value: storedLocale }) }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

function readSupportedLocale({ languages }: Readonly<{ languages: readonly string[] }>): Locale {
  for (const language of languages) {
    const [languageCode] = language.toLowerCase().split('-')
    const locale = parseLocale({ value: languageCode })
    if (locale !== null) return locale
  }
  return defaultLocale
}

function parseLocale({ value }: Readonly<{ value: string | null | undefined }>): Locale | null {
  return value === 'en' || value === 'fr' ? value : null
}

function selectLocale({
  selectedLocale,
  setLocaleState,
}: Readonly<{
  selectedLocale: Locale
  setLocaleState: (state: LocaleState) => void
}>) {
  const persistenceResult = storeLocale({ selectedLocale })
  setLocaleState(createReadyLocaleState({
    locale: selectedLocale,
    persistenceError: persistenceResult.ok ? null : persistenceResult.error,
  }))
}

function storeLocale({
  selectedLocale,
}: Readonly<{ selectedLocale: Locale }>): BrowserStorageResult<undefined> {
  try {
    localStorage.setItem(localeStorageKey, selectedLocale)
    return { ok: true, value: undefined }
  } catch {
    return { ok: false, error: 'unavailable' }
  }
}

function createReadyLocaleState({
  locale,
  persistenceError,
}: Readonly<{
  locale: Locale
  persistenceError: LocaleState['preferencePersistenceError']
}>): LocaleState {
  return { locale, preferencePersistenceError: persistenceError, readiness: 'ready' }
}

function readTranslation({ locale, key }: Readonly<{ locale: Locale; key: TranslationKey }>) {
  const translation = catalogs[locale][key]
  if (translation !== undefined) return translation
  if (import.meta.env.DEV) {
    console.error(`Missing ${locale} translation: ${key}`)
    return `[Missing ${locale} translation: ${key}]`
  }
  return englishCatalog[key]
}

const missingProviderResult = {
  ok: false,
  error: 'provider-missing',
} as const satisfies LocalizationResult
