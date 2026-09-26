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
  'sourceProfile.title': 'Build your Source Profile',
  'sourceProfile.importDescription': 'Import a text-based resume or LinkedIn PDF. The document is read in your browser.',
  'sourceProfile.fileLabel': 'Choose a PDF Source Document',
  'sourceProfile.detectedTitle': 'Removed before processing',
  'sourceProfile.detectedNone': 'No common contact or sensitive personal information was detected.',
  'sourceProfile.outgoingLabel': 'Exact content that will be sent for extraction',
  'sourceProfile.saveContent': 'Save minimized content',
  'sourceProfile.noticeTitle': 'Processing notice',
  'sourceProfile.noticeText': 'Only the content shown above is sent to OpenAI in a stateless request with storage disabled. Standard abuse-monitoring retention may still apply.',
  'sourceProfile.noticeVersion': 'Notice version:',
  'sourceProfile.confirmNotice': 'Confirm this processing notice',
  'sourceProfile.noticeConfirmed': 'Processing notice confirmed for this session.',
  'sourceProfile.extract': 'Extract professional facts',
  'sourceProfile.factsTitle': 'Review extracted facts',
  'sourceProfile.batchTitle': 'Facts selected for batch confirmation',
  'sourceProfile.batchDescription': 'Review every fact in this visible list before confirming the batch.',
  'sourceProfile.batchConfirm': 'Confirm this visible batch',
  'sourceProfile.confirmFact': 'Confirm fact',
  'sourceProfile.rejectFact': 'Reject fact',
  'sourceProfile.correctFact': 'Create correction',
  'sourceProfile.correctionLabel': 'Correct this verified fact',
  'sourceProfile.resolveConflict': 'Keep this fact and resolve the conflict',
  'sourceProfile.unsupportedFailure': 'Choose a PDF file. Other Source Document formats are not supported yet.',
  'sourceProfile.unreadableFailure': 'This PDF could not be read. Use a valid text-based resume or LinkedIn PDF.',
  'sourceProfile.extractionFailure': 'Professional facts could not be extracted. Check the service configuration and try again.',
  'sourceProfile.failure': 'The Source Profile action failed. Check the PDF or configuration and try again.',
  'sourceProfile.kind.experience': 'Experience',
  'sourceProfile.kind.skill': 'Skill',
  'sourceProfile.kind.education': 'Education',
  'sourceProfile.kind.language': 'Language',
  'sourceProfile.kind.project': 'Project',
  'sourceProfile.status.extracted': 'Needs review',
  'sourceProfile.status.verified': 'Verified',
  'sourceProfile.status.rejected': 'Rejected',
  'sourceProfile.status.superseded': 'Superseded',
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
  'sourceProfile.title': 'Construis ton Profil Source',
  'sourceProfile.importDescription': 'Importe un CV texte ou un PDF LinkedIn. Le document est lu dans ton navigateur.',
  'sourceProfile.fileLabel': 'Choisir un Document Source PDF',
  'sourceProfile.detectedTitle': 'Retiré avant le traitement',
  'sourceProfile.detectedNone': "Aucune coordonnée ni information personnelle sensible courante n'a été détectée.",
  'sourceProfile.outgoingLabel': "Contenu exact envoyé pour l'extraction",
  'sourceProfile.saveContent': 'Enregistrer le contenu minimisé',
  'sourceProfile.noticeTitle': 'Notice de traitement',
  'sourceProfile.noticeText': "Seul le contenu affiché ci-dessus est envoyé à OpenAI dans une requête sans état avec le stockage désactivé. La conservation standard liée à la surveillance des abus peut tout de même s'appliquer.",
  'sourceProfile.noticeVersion': 'Version de la notice :',
  'sourceProfile.confirmNotice': 'Confirmer cette notice de traitement',
  'sourceProfile.noticeConfirmed': 'Notice de traitement confirmée pour cette session.',
  'sourceProfile.extract': 'Extraire les faits professionnels',
  'sourceProfile.factsTitle': 'Vérifie les faits extraits',
  'sourceProfile.batchTitle': 'Faits sélectionnés pour la confirmation groupée',
  'sourceProfile.batchDescription': 'Vérifie chaque fait de cette liste visible avant de confirmer le lot.',
  'sourceProfile.batchConfirm': 'Confirmer ce lot visible',
  'sourceProfile.confirmFact': 'Confirmer le fait',
  'sourceProfile.rejectFact': 'Rejeter le fait',
  'sourceProfile.correctFact': 'Créer la correction',
  'sourceProfile.correctionLabel': 'Corriger ce fait vérifié',
  'sourceProfile.resolveConflict': 'Garder ce fait et résoudre le conflit',
  'sourceProfile.unsupportedFailure': "Choisis un fichier PDF. Les autres formats de Document Source ne sont pas encore pris en charge.",
  'sourceProfile.unreadableFailure': "Ce PDF n'a pas pu être lu. Utilise un CV texte ou un PDF LinkedIn valide.",
  'sourceProfile.extractionFailure': "Les faits professionnels n'ont pas pu être extraits. Vérifie la configuration du service et réessaie.",
  'sourceProfile.failure': "L'action sur le Profil Source a échoué. Vérifie le PDF ou la configuration et réessaie.",
  'sourceProfile.kind.experience': 'Expérience',
  'sourceProfile.kind.skill': 'Compétence',
  'sourceProfile.kind.education': 'Formation',
  'sourceProfile.kind.language': 'Langue',
  'sourceProfile.kind.project': 'Projet',
  'sourceProfile.status.extracted': 'À vérifier',
  'sourceProfile.status.verified': 'Vérifié',
  'sourceProfile.status.rejected': 'Rejeté',
  'sourceProfile.status.superseded': 'Remplacé',
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
