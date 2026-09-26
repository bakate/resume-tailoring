import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

const englishCatalog = {
  'brand.homeLabel': 'Honest Resume home',
  'brand.name': 'Honest Resume',
  'brand.tagline': 'A more honest way to get hired.',
  'locale.english': 'English',
  'locale.french': 'Français',
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
  'locale.switcherLabel': 'Langue',
  'hero.title': 'Adaptez votre CV sans rien inventer.',
  'hero.lede': 'Créez un CV ciblé à partir de faits que vous avez vérifiés et approuvés.',
  'session.start': "Commencer l'adaptation",
  'session.delete': 'Supprimer la session privée',
  'session.loadFailure': "Impossible de charger votre session privée.",
  'session.openFailure': "Impossible d'ouvrir le parcours. Réessayez.",
  'session.deleteFailure': 'Impossible de supprimer votre session privée. Réessayez.',
  'privacy.retention': 'Le contenu que vous ajoutez reste dans ce navigateur et expire localement après 24 heures. Les fichiers téléchargés restent sur votre appareil et ne sont pas concernés par cette expiration automatique.',
  'workflow.title': 'Votre parcours',
  'workflow.opened': 'Parcours ouvert',
  'workflow.openedDescription': 'Votre Profil Source est la prochaine étape.',
  'workflow.ready': 'Prêt à commencer',
  'workflow.readyDescription': "Cliquez sur « Commencer l'adaptation » pour lancer votre parcours.",
  'workflow.sourceProfile': 'Profil Source',
  'workflow.sourceProfileDescription': 'Utilisez votre CV actuel ou les détails de votre carrière comme source de vérité.',
  'workflow.jobPosting': "Offre d'emploi",
  'workflow.jobPostingDescription': "Ajoutez l'Offre d'emploi que vous ciblez pour identifier les éléments à mettre en avant.",
  'workflow.tailoredResume': 'CV Adapté',
  'workflow.tailoredResumeDescription': 'Relisez un CV ciblé fondé uniquement sur les faits que vous avez approuvés.',
  'value.controlTitle': 'Vous gardez le contrôle',
  'value.controlText': 'Utilisez uniquement les informations que vous avez vérifiées et approuvées.',
  'value.focusTitle': 'Un parcours plus ciblé',
  'value.focusText': "Présentez la version de votre expérience la plus pertinente.",
  'value.opportunitiesTitle': 'Conçu pour de vraies opportunités',
  'value.opportunitiesText': 'Adaptez votre CV avec confiance et postulez avec intégrité.',
  'notFound.title': 'Page introuvable',
  'notFound.description': "La page demandée n'appartient pas à ce parcours d'adaptation de CV.",
  'notFound.return': 'Retourner au parcours',
} as const satisfies TranslationCatalog

export type Locale = 'en' | 'fr'

type Localization = Readonly<{
  locale: Locale
  selectLocale: (locale: Locale) => void
  translate: (key: TranslationKey) => string
}>

const catalogs: Readonly<Record<Locale, Partial<TranslationCatalog>>> = {
  en: englishCatalog,
  fr: frenchCatalog,
}
const defaultLocale: Locale = 'en'
const localeStorageKey = 'honest-resume-locale'
const defaultLocalization = {
  locale: defaultLocale,
  selectLocale: () => undefined,
  translate: (key: TranslationKey) => englishCatalog[key],
} as const satisfies Localization
const LocalizationContext = createContext<Localization>(defaultLocalization)

export function LocalizationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  useEffect(() => {
    setLocale(readInitialLocale())
  }, [])
  return (
    <LocalizationContext.Provider value={{
      locale,
      selectLocale: (selectedLocale) => {
        storeLocale({ selectedLocale, setLocale })
      },
      translate: (key) => readTranslation({ locale, key }),
    }}>
      {children}
    </LocalizationContext.Provider>
  )
}

export function useLocalization() {
  return useContext(LocalizationContext)
}

export const defaultDocumentTitle = englishCatalog['brand.name']

function readInitialLocale(): Locale {
  const storedLocale = readStoredLocale()
  if (storedLocale !== null) return storedLocale
  return readSupportedLocale(navigator.languages)
}

function readStoredLocale(): Locale | null {
  try {
    const storedLocale = localStorage.getItem(localeStorageKey)
    return isLocale(storedLocale) ? storedLocale : null
  } catch {
    return null
  }
}

function readSupportedLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const [languageCode] = language.toLowerCase().split('-')
    if (isLocale(languageCode)) return languageCode
  }
  return defaultLocale
}

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'fr'
}

function storeLocale({
  selectedLocale,
  setLocale,
}: Readonly<{
  selectedLocale: Locale
  setLocale: (locale: Locale) => void
}>) {
  try {
    localStorage.setItem(localeStorageKey, selectedLocale)
  } catch {
    // The interface can still switch locale when browser storage is unavailable.
  }
  setLocale(selectedLocale)
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
