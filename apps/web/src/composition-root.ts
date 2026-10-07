/**
 * The only module that wires browser adapters into the Candidate Journey. UI modules reach adapters through it alone.
 */
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyDependencies } from '@resume-tailoring/application/ports'
import { createPrivacySafeBrowserTelemetry } from './adapters/browser/browser-adapters'
import { createBrowserCandidateSessionPersistence } from './adapters/browser/browser-candidate-session-persistence'
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

export type BrowserCandidateJourneySystem = Readonly<{
  candidateJourney: CandidateJourney
  languageModelGateway: OpenAiLanguageModelGateway
}>

export function createBrowserCandidateJourneySystem(): BrowserCandidateJourneySystem {
  let candidateJourney: CandidateJourney | null = null
  const request = createAccessRecoveringRequest({ recovery: demoAccessRecovery, request: fetch })
  const languageModelGateway = createOpenAiLanguageModelGateway({
    readProcessingConsent: () => readProcessingConsent({ candidateJourney }),
    request,
  })
  candidateJourney = createCandidateJourney({
    dependencies: createBrowserDependencies({ languageModelGateway, request }),
  })
  return { candidateJourney, languageModelGateway }
}

function createBrowserDependencies({ languageModelGateway, request }: Readonly<{
  languageModelGateway: OpenAiLanguageModelGateway
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
    persistence: createBrowserCandidateSessionPersistence({ storage: localStorage, page: window }),
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
