import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createBrowserCandidateJourneySystem } from '../composition-root'

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
