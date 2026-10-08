/**
 * The only module that wires browser adapters into the Candidate Journey. UI modules reach adapters through it alone.
 */
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyDependencies } from '@resume-tailoring/application/ports'
import { createPrivacySafeBrowserTelemetry } from './adapters/browser/browser-adapters'
import { createBrowserCandidateSessionPersistence } from './adapters/browser/browser-candidate-session-persistence'
import type { BrowserCandidateSessionPersistence, CandidateSessionRetention } from './adapters/browser/browser-candidate-session-persistence'
import { createBrowserResumeDocumentRenderer } from './adapters/browser/browser-resume-document-renderer'
import { createBrowserJobPostingDocumentReader } from './adapters/browser/job-posting-document-reader'
import {
  createGatewayJobPostingExtractor,
  createGatewayMatchEvidenceMatcher,
  createGatewayResumeSectionModels,
  createGatewaySourceProfileExtractor,
} from './adapters/browser/language-model-gateway-ports'
import { createOpenAiLanguageModelGateway } from './adapters/browser/openai-language-model-gateway'
import type { OpenAiLanguageModelGateway } from './adapters/browser/openai-language-model-gateway'
import { createResumeDocumentModelAdapters } from './adapters/browser/resume-document-model-adapters'
import { createBrowserSourceIntakeDocumentReader } from './adapters/browser/source-intake-document-reader'
import { listenForUncaughtErrors, reportUncaughtError } from './adapters/browser/uncaught-error-reporting'
import { createAccessRecoveringRequest, demoAccessRecovery } from './demo-access/demo-access-recovery'
import { candidateApiKeyRecovery, candidateApiKeys, createCandidateApiKeyRequest, dailyQuota } from './candidate-api-key/candidate-api-key-recovery'

export type { CandidateSessionRetention }

export type BrowserCandidateJourneySystem = Readonly<{
  candidateJourney: CandidateJourney
  /** Chooses, before the Candidate Session is first saved, whether it outlives the tab. */
  chooseCandidateSessionRetention: (retention: CandidateSessionRetention) => void
  languageModelGateway: OpenAiLanguageModelGateway
}>

export function createBrowserCandidateJourneySystem(): BrowserCandidateJourneySystem {
  let candidateJourney: CandidateJourney | null = null
  // A request replayed after renewing demo access signs itself again with the Candidate API Key of this tab, if any.
  const request = createAccessRecoveringRequest({ recovery: demoAccessRecovery, request: createCandidateApiKeyRequest({
    dailyQuota, keys: candidateApiKeys, recovery: candidateApiKeyRecovery, request: fetch,
  }) })
  const languageModelGateway = createOpenAiLanguageModelGateway({
    readProcessingConsent: () => readProcessingConsent({ candidateJourney }),
    request,
  })
  const persistence = createBrowserCandidateSessionPersistence({
    storages: { browser: localStorage, tab: sessionStorage }, page: window,
  })
  candidateJourney = createCandidateJourney({
    dependencies: createBrowserDependencies({ languageModelGateway, persistence, request }),
  })
  return { candidateJourney, chooseCandidateSessionRetention: persistence.chooseRetention, languageModelGateway }
}

function createBrowserDependencies({ languageModelGateway, persistence, request }: Readonly<{
  languageModelGateway: OpenAiLanguageModelGateway
  persistence: BrowserCandidateSessionPersistence
  request: typeof fetch
}>): CandidateJourneyDependencies {
  const telemetry = createPrivacySafeBrowserTelemetry()
  return {
    resumeDocumentRenderer: createBrowserResumeDocumentRenderer({ request, telemetry }),
    telemetry,
    resumeDocumentPorts: createResumeDocumentModelAdapters({ gateway: languageModelGateway }),
    resumeSectionModels: createGatewayResumeSectionModels({ languageModelGateway }),
    createIdentifier: () => crypto.randomUUID(),
    jobPostingDocumentReader: createBrowserJobPostingDocumentReader(),
    jobPostingExtractor: createGatewayJobPostingExtractor({ languageModelGateway }),
    languageModelGateway,
    matchEvidenceMatcher: createGatewayMatchEvidenceMatcher({ languageModelGateway }),
    now: () => Date.now(),
    persistence,
    sourceDocumentReader: createBrowserSourceIntakeDocumentReader(),
    sourceProfileExtractor: createGatewaySourceProfileExtractor({ languageModelGateway }),
  }
}

/** The gateway binds Processing Consent to the Candidate Session the journey currently holds. */
function readProcessingConsent({ candidateJourney }: Readonly<{
  candidateJourney: CandidateJourney | null
}>) {
  const view = candidateJourney?.readView()
  return view?.status === 'candidate-session-open' ? view.session.processingConsent : null
}

/** Reports errors nothing else handled through privacy-safe telemetry; returns the function that stops listening. */
export function listenForUncaughtBrowserErrors() {
  return listenForUncaughtErrors({ page: window, telemetry: createPrivacySafeBrowserTelemetry() })
}

/** Reports a render error the global safety net replaced with its fallback page. */
export function reportUncaughtRenderError() {
  reportUncaughtError({ source: 'render', telemetry: createPrivacySafeBrowserTelemetry() })
}
