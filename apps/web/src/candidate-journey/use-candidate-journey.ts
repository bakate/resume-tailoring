import { createPrivacySafeBrowserTelemetry } from '../resume-tailoring/browser-adapters'
import { createResumeDocumentModelAdapters } from './resume-document-model-adapters'
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'

import { createBrowserResumeDocumentRenderer } from './browser-resume-document-renderer'
import { createBrowserCandidateSessionPersistence } from './browser-candidate-session-persistence'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'
import { createBrowserSourceIntakeDocumentReader } from './source-intake-document-reader'
import { createBrowserJobPostingDocumentReader } from './job-posting-document-reader'
import type { CandidateJourney, ResumeSectionModelResult, ResumeSectionModels } from '@resume-tailoring/application/candidate-journey'
import type { LanguageModelResult } from '@resume-tailoring/application/language-model-gateway'
import type {
  JobPostingExtractor,
  MatchEvidenceMatcher,
} from '@resume-tailoring/application/job-match'
import type { StructuredSourceProfileExtractor } from '@resume-tailoring/application/source-intake'

export type CandidateJourneyController = ReturnType<typeof useCandidateJourneyController>

const CandidateJourneyContext = createContext<CandidateJourneyController | null>(null)

/** Shares one Candidate Journey actor between the intake and result routes, so navigation never restarts it (ADR-0016). */
export const CandidateJourneyControllerProvider = CandidateJourneyContext.Provider

export function useCandidateJourney(): CandidateJourneyController {
  const controller = useContext(CandidateJourneyContext)
  if (controller === null) throw new Error('useCandidateJourney requires a CandidateJourneyControllerProvider')
  return controller
}

export function useCandidateJourneyController() {
  const [candidateJourneySystem] = useState(createBrowserCandidateJourneySystem)
  const { candidateJourney } = candidateJourneySystem
  useEffect(() => {
    candidateJourney.start()
  }, [candidateJourney])
  const view = useSyncExternalStore(
    candidateJourney.subscribe,
    candidateJourney.readView,
    candidateJourney.readView,
  )
  return {
    renderResumeDocument: candidateJourney.renderResumeDocument,
    invalidateResumeInputs: candidateJourney.invalidateResumeInputs,
    hideResumeEntry: candidateJourney.hideResumeEntry,
    restoreResumeEntry: candidateJourney.restoreResumeEntry,
    applyValidatedSectionChange: candidateJourney.applyValidatedSectionChange,
    attestResumeField: candidateJourney.attestResumeField,
    editResumeField: candidateJourney.editResumeField,
    hideResumeField: candidateJourney.hideResumeField,
    restoreResumeField: candidateJourney.restoreResumeField,
    restoreSourceFact: candidateJourney.restoreSourceFact,
    moveResumeField: candidateJourney.moveResumeField,
    reorderResumeSections: candidateJourney.reorderResumeSections,
    updateResumeContacts: candidateJourney.updateResumeContacts,
    updateResumePhoto: candidateJourney.updateResumePhoto,
    changeJobPosting: candidateJourney.changeJobPosting,
    proposeResumeCondensation: candidateJourney.proposeResumeCondensation,
    acceptResumeCondensation: candidateJourney.acceptResumeCondensation,
    rejectResumeCondensation: candidateJourney.rejectResumeCondensation,
    confirmProfileEnrichment: candidateJourney.confirmProfileEnrichment,
    deleteCandidateSession: candidateJourney.deleteCandidateSession,
    rateResumeUsefulness: candidateJourney.rateResumeUsefulness,
    recordResumeDownload: candidateJourney.recordResumeDownload,
    grantProcessingConsent: candidateJourney.grantProcessingConsent,
    languageModelGateway: candidateJourneySystem.languageModelGateway,
    resolveCriticalAmbiguity: candidateJourney.resolveCriticalAmbiguity,
    startCandidateSession: candidateJourney.startCandidateSession,
    startTailoredResumePreparation: candidateJourney.startTailoredResumePreparation,
    submitJobPosting: candidateJourney.submitJobPosting,
    submitSourceDocument: candidateJourney.submitSourceDocument,
    view,
  } as const
}

function createBrowserCandidateJourneySystem() {
  let candidateJourney: CandidateJourney | null = null
  const languageModelGateway = createOpenAiLanguageModelGateway({
    readProcessingConsent: () => readProcessingConsent({ candidateJourney }),
  })
  candidateJourney = createCandidateJourney({
    dependencies: createBrowserDependencies({ languageModelGateway }),
  })
  return { candidateJourney, languageModelGateway } as const
}

type BrowserLanguageModelGateway = ReturnType<typeof createOpenAiLanguageModelGateway>

function createBrowserDependencies({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>) {
  const telemetry = createPrivacySafeBrowserTelemetry()
  return {
    resumeDocumentRenderer: createBrowserResumeDocumentRenderer({ telemetry }),
    telemetry,
    resumeDocumentPorts: createResumeDocumentModelAdapters({ gateway: languageModelGateway }),
    resumeSectionModels: createGatewayResumeSectionModels(languageModelGateway),
    createSessionId: () => crypto.randomUUID(),
    jobPostingDocumentReader: createBrowserJobPostingDocumentReader(),
    jobPostingExtractor: createGatewayJobPostingExtractor({ languageModelGateway }),
    languageModelGateway,
    matchEvidenceMatcher: createGatewayMatchEvidenceMatcher({ languageModelGateway }),
    now: () => Date.now(),
    persistence: createBrowserCandidateSessionPersistence({ storage: localStorage }),
    sourceDocumentReader: createBrowserSourceIntakeDocumentReader(),
    sourceProfileExtractor: createGatewaySourceProfileExtractor({ languageModelGateway }),
  }
}

function createGatewayJobPostingExtractor({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>): JobPostingExtractor {
  return { extract: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'explainable-job-posting-extraction',
    })
    return result.ok && result.value.operation === 'explainable-job-posting-extraction'
      ? { ok: true, value: result.value.value }
      : { ok: false, error: 'job-posting-extraction-unavailable' as const }
  } }
}

function createGatewayMatchEvidenceMatcher({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>): MatchEvidenceMatcher {
  return { match: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'explainable-match-evidence',
    })
    return result.ok && result.value.operation === 'explainable-match-evidence'
      ? { ok: true, value: result.value.value }
      : { ok: false, error: 'match-evidence-unavailable' as const }
  } }
}

function createGatewaySourceProfileExtractor({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>): StructuredSourceProfileExtractor {
  return { extract: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'structured-source-profile-extraction',
    })
    if (result.ok && result.value.operation === 'structured-source-profile-extraction') {
      return { ok: true, value: result.value.value }
    }
    return readSourceProfileFailure({ result })
  } }
}

function readSourceProfileFailure({ result }: Readonly<{
  result: Awaited<ReturnType<BrowserLanguageModelGateway['structured']['process']>>
}>) {
  return {
    ok: false as const,
    error: !result.ok && result.error.type === 'processing-consent-required'
      ? 'processing-consent-required' as const
      : 'source-profile-extraction-unavailable' as const,
  }
}

function readProcessingConsent({ candidateJourney }: Readonly<{
  candidateJourney: CandidateJourney | null
}>) {
  const view = candidateJourney?.readView()
  return view?.status === 'candidate-session-open' ? view.session.processingConsent : null
}

function createGatewayResumeSectionModels(gateway: BrowserLanguageModelGateway): ResumeSectionModels {
  return {
    writeSection: async (input) => toSectionModelResult({ operation: 'resume-section-writing',
      result: await gateway.writing.process({ operation: 'resume-section-writing', input }) }),
    validateFields: async (input) => toSectionModelResult({ operation: 'resume-section-validation',
      result: await gateway.structured.process({ operation: 'resume-section-validation', input }) }),
    checkCoherence: async (input) => toSectionModelResult({ operation: 'resume-document-coherence',
      result: await gateway.structured.process({ operation: 'resume-document-coherence', input }) }),
  }
}

type GatewayValue = Readonly<{ operation: string; value: unknown; usage?: ResumeSectionModelResult<unknown>['usage'] }>

function toSectionModelResult<TOperation extends string, TResult extends GatewayValue>({ operation, result }: Readonly<{
  operation: TOperation; result: LanguageModelResult<TResult>
}>): ResumeSectionModelResult<Extract<TResult, { operation: TOperation }>['value']> {
  if (!result.ok) return { ok: false, error: { type: result.error.type === 'processing-consent-required' ? 'consent-required'
    : result.error.cause ?? (result.error.transient === true ? 'transient' : 'permanent') } }
  if (!isOperation(result.value, operation)) return { ok: false, error: { type: 'permanent' } }
  return { ok: true, value: result.value.value, ...(result.value.usage === undefined ? {} : { usage: result.value.usage }) }
}

function isOperation<TOperation extends string, TResult extends GatewayValue>(value: TResult, operation: TOperation):
  value is Extract<TResult, { operation: TOperation }> {
  return value.operation === operation
}
