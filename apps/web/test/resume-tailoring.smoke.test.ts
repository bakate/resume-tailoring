import { expect, test } from '@playwright/test'
import type { Locator, Page, Route } from '@playwright/test'
import type { CandidateSessionPersistence } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import { jobRequirementExtractionMaximumCharacters } from '../src/resume-tailoring/job-requirement-schemas'
import { matchAnalysisRequestSchema } from '../src/resume-tailoring/match-analysis-schemas'
import { sourceProfileExtractionMaximumCharacters } from '../src/resume-tailoring/source-profile-schemas'
import { resumeClaimWritingRequestSchema } from '../src/resume-tailoring/resume-claim-schemas'

declare global {
  interface Window {
    candidateSessionTestPersistence?: CandidateSessionPersistence
    presentedDocumentLocales: string[]
    readInstalledPersistence: () => CandidateSessionPersistence
  }
}

const compactProgressMaximumWidth = 640
const progressViewports = [
  { width: 1280, height: 900 },
  { width: 640, height: 900 },
  { width: 390, height: 844 },
] as const

test('a Candidate can start a private Resume Tailoring session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  system.givenResumeTailoringIsAvailable()

  await system.startResumeTailoringSession()

  await system.expectResumeTailoringSessionToBeStoredInIndexedDb()
})

test('a Candidate can restore an unexpired session after reload', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.reloadResumeTailoringSession()

  await system.expectResumeTailoringSessionToBeReady()
})

test('deleting a Candidate session invalidates every open tab', async ({ page }) => {
  const secondPage = await page.context().newPage()
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActiveInBothTabs({ secondPage })

  await system.deleteResumeTailoringSessionInSecondTab({ secondPage })

  await system.expectResumeTailoringSessionDeletedInBothTabs({ secondPage })
  await system.expectFreshStartControlFocusedInSecondTab({ secondPage })
})

test('deleting a Candidate session interrupts work pending in another tab', async ({ page }) => {
  const secondPage = await page.context().newPage()
  const system = createSystemUnderTest({ page })

  await system.givenPendingSourceProfileExtractionInFirstTab({ secondPage })

  await system.deleteResumeTailoringSessionInSecondTab({ secondPage })

  await system.expectResumeTailoringSessionDeletedInBothTabs({ secondPage })
})

test('expiration invalidates Candidate content in every open tab', async ({ page }) => {
  const secondPage = await page.context().newPage()
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionWillExpireInBothTabs({ secondPage })

  await system.expireResumeTailoringSessionInBothTabs({ secondPage })

  await system.expectResumeTailoringSessionDeletedInBothTabs({ secondPage })
})

test('startup removes already expired Candidate content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionAlreadyExpired()

  await system.reloadExpiredCandidateSession()

  await system.expectResumeTailoringSessionToBeNotStarted()
})

test('a late response cannot recreate a deleted Candidate session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionWasDeleted()

  await system.applyLateCandidateSessionResponse()

  system.expectLateResponseToBeDiscarded()
})

test('a late response cannot recreate an expired Candidate session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionWasExpired()

  await system.applyLateCandidateSessionResponse()

  system.expectLateResponseToBeDiscarded()
})

test('a response cannot extend the absolute Candidate session expiration', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsStored()

  await system.extendCandidateSessionExpirationFromResponse()

  system.expectSessionExpirationExtensionToBeRejected()
})

test('a Candidate can recover from an unknown page', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  system.givenUnknownRoute('/missing-route')

  await system.openUnknownPage()

  await system.expectPageNotFoundWithWorkflowLink()
})

test('explains local expiry for Candidate content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  system.givenResumeTailoringIsAvailable()

  await system.viewResumeTailoring()

  await system.expectCandidateContentRetentionExplained()
})

test('renders the Resume Tailoring interface in English', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserPrefersLanguages({ languages: ['en-US', 'fr-FR'] })

  await system.viewResumeTailoring()

  await system.expectResumeTailoringToBeInEnglish()
})

test('renders the Resume Tailoring interface in French', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserPrefersLanguages({ languages: ['fr-FR', 'en-US'] })

  await system.viewResumeTailoring()

  await system.expectResumeTailoringToBeInFrench()
  await system.expectFrenchWasFirstPresentedLocale()
})

test('falls back to English for unsupported browser languages', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserPrefersLanguages({ languages: ['de-DE'] })

  await system.viewResumeTailoring()

  await system.expectResumeTailoringToBeInEnglish()
})

test('ignores browser-extension attributes injected on the document body', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserExtensionMutatesDocumentBody()

  await system.viewResumeTailoring()

  await system.expectNoHydrationMismatchFromBrowserExtension()
})

test('a Candidate can switch locale without losing an active session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.switchResumeTailoringToFrench()

  await system.expectFrenchLocaleAndCandidateSessionToBeRetained()
})

test('a Candidate discovers a safeguarded private-session deletion away from workflow actions', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.openPrivateSessionDeletionConfirmation()

  await system.expectLocalizedPrivateSessionDeletionConfirmation()
})

test('canceling private-session deletion preserves the active Candidate context', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenPendingSourceProfileExtractionAndDeletionConfirmation()

  await system.cancelPrivateSessionDeletion()

  await system.expectActiveCandidateContextToBePreserved()
})

test('confirming deletion interrupts a pending Candidate operation', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenPendingSourceProfileExtractionAndDeletionConfirmation()

  await system.confirmPrivateSessionDeletion()

  await system.expectCandidateSessionDeletedDuringPendingOperation()
})

test('a deleted operation cannot disturb a restarted Candidate session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionRestartedBeforeDeletedOperationCompletes()

  await system.completeDeletedCandidateOperation()

  await system.expectRestartedCandidateSessionToRemainActive()
})

test('French private-session deletion confirmation traps keyboard focus', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenFrenchCandidateSessionIsActive()

  await system.openFrenchPrivateSessionDeletionConfirmation()

  await system.expectFrenchDeletionConfirmationToTrapFocus()
})

test('English Source Document intake explains distinct PDF and pasted-text options', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.selectPdfSourceDocumentMethod()

  await system.expectClearEnglishSourceDocumentOptions()
})

test('French Source Document intake localizes every visible PDF control', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.switchResumeTailoringToFrench()

  await system.expectLocalizedFrenchPdfIntake()
})

test('French unreadable PDF feedback localizes its filename announcement and error', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.switchResumeTailoringToFrench()

  await system.uploadFrenchUnreadablePdf()

  await system.expectLocalizedFrenchUnreadablePdfFeedback()
})

test('French browser compatibility feedback preserves pasted-text recovery', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenPdfReaderWorkerIsUnavailable()
  await system.givenCandidateSessionIsActive()
  await system.switchResumeTailoringToFrench()

  await system.uploadReadablePdfWithIncompatibleReader()

  await system.expectLocalizedBrowserCompatibilityRecovery()
})

test('pasted professional text enters the shared outgoing Source Document review', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.reviewPastedProfessionalText()

  await system.expectPastedTextInSharedSourceDocumentReview()
})

test('an unreadable PDF preserves the Candidate session with adjacent feedback', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.uploadUnreadablePdf()

  await system.expectUnreadablePdfFeedbackBesideIntake()
})

test('a Candidate recovers from an unreadable PDF with a readable replacement', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenUnreadablePdfWasRejected()

  await system.retryWithReadablePdf()

  await system.expectUnreadablePdfRecoveryToKeepSessionActive()
})

test('empty pasted professional text shows recoverable validation at the intake control', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.reviewEmptyPastedProfessionalText()

  await system.expectEmptyPastedTextValidation()
})

test('switching Source Document methods does not start review or extraction', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenSourceProfileExtractionIsObserved()

  await system.switchSourceDocumentMethods()

  await system.expectSourceDocumentMethodSwitchToRemainLocal()
})

test('a Candidate builds a Verified Source Profile from minimized PDF content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()

  await system.buildVerifiedSourceProfile()

  await system.expectVerifiedSourceProfileBuiltFromMinimizedContent()
})

test('a Candidate imports a valid PDF without native Promise.withResolvers', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenPromiseWithResolversIsUnavailable()
  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()

  await system.buildVerifiedSourceProfile()

  await system.expectVerifiedSourceProfileBuiltFromMinimizedContent()
})

test('a Candidate reviews outgoing Source Document content and consent in one surface', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.reviewSourceDocumentBeforeConsent()

  await system.expectCoherentSourceDocumentReviewSurface()
})

test('Source Profile extraction exposes pending, success, and recoverable failure states', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenSourceProfileExtractionCanBeDelayed()
  await system.startSourceProfileExtraction()
  await system.expectPendingSourceProfileExtractionThenSuccess()

  await system.restartWithRecoverableSourceProfileExtractionFailure()
  await system.retryFailedSourceProfileExtraction()
  await system.expectRetriedSourceProfileExtractionToSucceed()
})

test('a Candidate collectively attests non-conflicting imported Candidate Facts', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenDetailedSourceProfileExtractionIsAvailable()
  await system.extractDetailedSourceProfileFacts()

  system.inspectCollectivelyAttestedFacts()

  await system.expectNonConflictingFactsToBeImmediatelyUsable()
})

test('conflict resolution and immutable correction remain in the facts review', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenDetailedSourceProfileExtractionIsAvailable()
  await system.extractDetailedSourceProfileFacts()

  await system.resolveVisibleEducationConflict()
  await system.correctVisibleSkillFact()

  await system.expectConflictResolutionAndImmutableCorrection()
})

test('a Candidate restores the Verified Source Profile after reload', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenVerifiedSourceProfile()

  await system.reloadVerifiedSourceProfile()

  await system.expectVerifiedSourceProfileToBeRestored()
})

test('a Candidate reviews classified atomic Job Requirements from minimized content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.buildVerifiedSourceProfile()

  await system.extractRequirementsFromMinimizedJobPosting()

  await system.expectAtomicJobRequirementsWithSourceProvenance()
})

test('a Candidate analyzes a pasted Job Posting in one action', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.buildVerifiedSourceProfile()

  await system.analyzePastedJobPostingInOneAction()

  await system.expectOneActionJobPostingAnalysis()
})

test('a Candidate analyzes an uploaded PDF Job Posting through the same action', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.buildVerifiedSourceProfile()

  await system.analyzeUploadedPdfJobPostingInOneAction()

  await system.expectOneActionJobPostingAnalysis()
})

test('a Candidate corrects the Target Role only with exact Job Posting text', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionWithTargetRoleIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.buildVerifiedSourceProfile()
  await system.analyzePastedJobPostingInOneAction()

  await system.correctTargetRoleFromExactJobPostingText()

  await system.expectCorrectedSourceBackedTargetRole()
})

test('a delayed Job Requirement extraction reassures the Candidate and focuses its result', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenJobPostingCanBeExtractedWithDelay()

  await system.extractDelayedJobRequirements()

  await system.expectPendingJobRequirementExtractionThenFocusedResult()
})

test('a Candidate can retry a recoverable Job Requirement extraction failure', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenRecoverableJobRequirementExtractionFailure()

  await system.retryFailedJobRequirementExtraction()

  await system.expectRetryToPreserveJobPostingAndShowRequirements()
})

test('a Candidate sees an evidence-backed Match Score and Gap Analysis', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()

  await system.analyzeMatch()

  await system.expectEvidenceBackedMatchScoreAndGapAnalysis()
})

test('a Candidate can inspect Match Evidence after reviewing the coverage summary', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()
  await system.analyzeMatch()

  await system.expectMatchSummaryBeforeProgressiveEvidence()
})

test('a Candidate can skip optional Profile Enrichment without losing core value', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()
  await system.analyzeMatch()

  await system.skipHighestImpactProfileEnrichmentPrompt()

  await system.expectAnalysisAndGenerationToRemainAvailable()
})

test('a Candidate can reopen a completed step without losing progress', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenVerifiedSourceProfile()

  await system.reopenCompletedSourceProfile()

  await system.expectCompletedSourceProfileToRemainIntact()
})

test('progress navigation exposes the full journey on compact screens', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenMobileViewport()

  await system.startResumeTailoringSession()

  await system.expectMobileProgressToExposeCurrentAndFutureSteps()
})

test('French progress exposes the full journey on compact screens', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserPrefersLanguages({ languages: ['fr-FR'] })
  await system.givenMobileViewport()

  await system.startResumeTailoringSessionInFrench()

  await system.expectFrenchProgressToExposeCurrentAndFutureSteps()
})

test('partially completed progress stays readable in English', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenVerifiedSourceProfile()

  await system.reopenCompletedSourceProfileWithKeyboard()

  await system.expectPartiallyCompletedProgressToStayReadable()
})

test('partially completed progress stays readable in French', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenVerifiedSourceProfile()

  await system.switchResumeTailoringToFrench()

  await system.expectFrenchPartiallyCompletedProgressToStayReadable()
})

test('completed progress stays readable in English', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()

  await system.reopenCompletedSourceProfileWithKeyboard()

  await system.expectCompletedProgressToStayReadable()
})

test('completed progress stays readable in French', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()

  await system.switchResumeTailoringToFrench()

  await system.expectFrenchCompletedProgressToStayReadable()
})

test('a delayed operation prevents duplicates and focuses its successful result', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenMatchAnalysisCanBeDelayed()

  await system.analyzeDelayedMatchWithDoubleClick()

  await system.expectPendingMatchAnalysisThenFocusedResult()
})

test('a pending operation reassures the Candidate after ten seconds', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenMatchAnalysisCanBeDelayed()

  await system.waitOnPendingMatchAnalysis()

  await system.expectLongRunningReassuranceWithoutInventedProgress()
})

test('a Candidate can retry a recoverable failure without losing content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenRecoverableMatchAnalysisFailure()

  await system.retryFailedMatchAnalysis()

  await system.expectRetryToPreserveProgressAndProduceMatchAnalysis()
})

test('a Candidate generates validated provenance-backed Resume Claims', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.givenResumeClaimServicesAreAvailable()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()
  await system.analyzeMatch()
  await system.givenTailoredResumeStepIsOpen()

  await system.generateResumeClaims()

  await system.expectValidatedResumeClaimsWithoutFreeEditing()
})

test('eligible delayed generation prevents duplicates and focuses curated Resume Claims', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.givenResumeClaimGenerationCanBeDelayed()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()
  await system.analyzeMatch()

  await system.generateDelayedResumeClaimsWithDoubleClick()

  await system.expectPendingResumeClaimGenerationThenFocusedCollection()
})

test('an ineligible Match Analysis exposes no Resume Claim generation action', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenIneligibleMatchAnalysis()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()

  await system.analyzeIneligibleMatch()

  await system.expectGenerationActionToRemainUnavailableInMatchAnalysis()
})

test('an ineligible Tailored Resume explains why generation is unavailable', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenIneligibleMatchAnalysisIsCompleted()

  await system.openIneligibleTailoredResume()

  await system.expectIneligibleTailoredResumeToExplainUnavailableGeneration()
})

test('a Candidate retries failed Resume Claim generation without losing context', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.givenResumeClaimGenerationFailsOnce()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()
  await system.analyzeMatch()
  await system.givenResumeClaimGenerationHasFailed()

  await system.retryResumeClaimGeneration()

  await system.expectRetriedResumeClaimGenerationToPreserveContext()
})

test('claims excluded after validation failure are explained without model details', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.givenResumeClaimRemainsUnsupported()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()
  await system.analyzeMatch()

  await system.generateExcludedResumeClaim()

  await system.expectUnsupportedResumeClaimExclusionToBeClear()
})

test('a Candidate restores provenance-backed Resume Claims after reload', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()

  await system.reloadTailoredResume()

  await system.expectTailoredResumeToBeRestored()
})

test('a Candidate reorders a compact ordered Resume Claim collection', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()

  await system.moveFirstResumeClaimDown()

  await system.expectResumeClaimOrderToChange()
})

test('a Candidate removes one Resume Claim from the compact collection', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()

  await system.removeFirstResumeClaim()

  await system.expectResumeClaimRemoval()
})

test('reformulation controls stay compact and keep provenance rules explicit', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()

  await system.openFirstResumeClaimReformulation()

  await system.expectCompactReformulationControls()
})

test('delayed reformulation prevents duplicates without blocking safe navigation', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()
  await system.givenResumeClaimReformulationCanBeDelayed()

  await system.requestDelayedResumeClaimReformulation()

  await system.expectPendingReformulationThenFocusedCollection()
})

test('Outcome Feedback remains usable while a Resume Claim is reformulated', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()
  await system.givenResumeClaimReformulationIsPending()

  await system.rateTailoredResumeFidelityDuringReformulation()

  await system.expectConcurrentFidelityRatingToBeRecorded()
})

test('a Candidate retries failed reformulation without losing their request', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()
  await system.givenResumeClaimReformulationHasFailed()

  await system.retryResumeClaimReformulation()

  await system.expectRetriedReformulationToPreserveContext()
})

test('curation and preview preparation stay continuous on mobile', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()
  await system.givenMobileViewport()

  await system.navigateToTailoredResumeExport()

  await system.expectContinuousTailoredResumeFlowOnMobile()
})

test('a Candidate previews and downloads the same validated one-page resume', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()
  await system.givenValidatedResumePdfExportIsAvailable()
  await system.givenPrivacySafeAnalyticsIsAvailable()

  await system.rateTailoredResumeOutcomes()
  await system.reloadTailoredResumeOutcomeFeedback()
  await system.expectTailoredResumeOutcomeFeedbackToRemainRecorded()

  await system.downloadTailoredResumePdf()

  await system.expectPreviewAndPdfToUseTheSameRetainedClaims()
  system.expectPrivacySafeMvpOutcomesToBeRecorded()
})

test('localizes sensitive labels and preserves legitimate French words', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.buildVerifiedSourceProfile()
  await system.switchResumeTailoringToFrench()

  await system.reviewFrenchJobPostingWithPhoneNumber()

  await system.expectFrenchSensitiveLabelAndIntactJobPosting()
})

test('rejects oversized professional content before model processing', async ({ page }) => {
  await page.goto('/')

  const responseStatus = await page.evaluate(async (maximumCharacters) => {
    const response = await fetch('/api/source-profile-extraction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professionalContent: 'x'.repeat(maximumCharacters + 1) }),
    })
    return response.status
  }, sourceProfileExtractionMaximumCharacters)

  expect(responseStatus).toBe(413)
})

test('rejects an oversized Job Posting before model processing', async ({ page }) => {
  await page.goto('/')

  const responseStatus = await page.evaluate(async (maximumCharacters) => {
    const response = await fetch('/api/job-requirement-extraction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobPostingContent: 'x'.repeat(maximumCharacters + 1) }),
    })
    return response.status
  }, jobRequirementExtractionMaximumCharacters)

  expect(responseStatus).toBe(413)
})

function createSystemUnderTest({ page }: Readonly<{ page: Page }>) {
  return new ResumeTailoringBrowserTestSystem(page)
}

type CompletedAction =
  | 'candidate-session-expired'
  | 'candidate-session-reloaded'
  | 'candidate-session-response-applied'
  | 'candidate-session-synchronized'
  | 'deleted-candidate-operation-completed'
  | 'private-session-deletion-confirmation-opened'
  | 'private-session-deletion-canceled'
  | 'private-session-deletion-confirmed'
  | 'expiration-extension-attempted'
  | 'job-requirement-extraction-failed'
  | 'job-requirement-extraction-inspected'
  | 'job-requirements-extracted'
  | 'job-requirements-retried'
  | 'job-posting-reviewed'
  | 'match-analyzed'
  | 'match-analysis-inspected'
  | 'match-analysis-retried'
  | 'match-analysis-waited'
  | 'profile-enrichment-skipped'
  | 'source-profile-reopened'
  | 'pdf-source-document-method-selected'
  | 'pasted-source-document-reviewed'
  | 'unreadable-source-document-rejected'
  | 'unreadable-source-document-recovered'
  | 'incompatible-source-document-reader-rejected'
  | 'empty-pasted-source-document-reviewed'
  | 'source-document-method-switched'
  | 'resume-tailoring-opened'
  | 'resume-tailoring-viewed'
  | 'resume-claims-generated'
  | 'resume-claim-reordered'
  | 'resume-claim-removed'
  | 'resume-claim-reformulation-opened'
  | 'resume-claims-excluded'
  | 'resume-claims-reloaded'
  | 'resume-claims-retried'
  | 'resume-claim-reformulation-requested'
  | 'resume-claim-reformulation-retried'
  | 'resume-fidelity-rated-during-reformulation'
  | 'resume-preview-navigated'
  | 'resume-pdf-downloaded'
  | 'source-profile-built'
  | 'source-document-reviewed'
  | 'source-profile-facts-inspected'
  | 'source-profile-extraction-retried'
  | 'source-profile-extraction-started'
  | 'source-profile-facts-corrected'
  | 'source-profile-facts-extracted'
  | 'source-profile-reloaded'
  | 'unknown-page-opened'

class ResumeTailoringBrowserTestSystem {
  readonly #page: Page
  readonly #analyticsEvents: unknown[] = []
  readonly #consoleMessages: string[] = []
  #completedAction: CompletedAction | undefined
  #lateResponseOutcome: unknown
  #extractionRequestContent: string | undefined
  #jobPostingRequestContent: string | undefined
  #pendingJobRequirementExtractionResponse: (() => void) | undefined
  #matchAnalysisRequestCount = 0
  #pendingMatchAnalysisResponse: (() => void) | undefined
  #releasePendingResumeClaimWriting: (() => void) | undefined
  #pendingSourceProfileExtractionCompletion: Promise<void> | undefined
  #pendingSourceProfileExtractionResponse: (() => void) | undefined
  #resumeClaimWritingRequestCount = 0
  readonly #resumeClaimReformulationRequests: string[] = []
  #resumePdfRequest: unknown
  #sourceProfileExtractionAttemptCount = 0
  #unknownRoute: string | undefined

  constructor(page: Page) {
    this.#page = page
  }

  givenResumeTailoringIsAvailable() {}

  givenUnknownRoute(route: string) {
    this.#unknownRoute = route
  }

  async givenCandidateSessionIsActive() {
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Start tailoring' }).click()
    await this.#page.getByText('Workflow opened').waitFor()
  }

  async givenPdfReaderWorkerIsUnavailable() {
    await this.#page.addInitScript(() => {
      Object.defineProperty(globalThis, 'Worker', {
        configurable: true,
        value: undefined,
      })
    })
  }

  async givenPromiseWithResolversIsUnavailable() {
    await this.#page.addInitScript(() => {
      Reflect.deleteProperty(Promise, 'withResolvers')
    })
  }

  async givenStructuredExtractionIsAvailable() {
    await this.#page.route('**/api/source-profile-extraction', async (route) => {
      this.#extractionRequestContent = readProfessionalContent(route.request().postData())
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: [{
            assessment: 'usable',
            kind: 'experience',
            propositionKey: 'proposition-experience-acme-role',
            value: 'Senior FullStack Developer using React at Acme',
          }, {
            assessment: 'critical-ambiguity',
            kind: 'experience',
            propositionKey: 'proposition-experience-acme-start-date',
            value: 'Started at Acme in 2021 or 2022',
          }],
        }),
      })
    })
  }

  async givenDetailedSourceProfileExtractionIsAvailable() {
    await this.#page.route('**/api/source-profile-extraction', (route) =>
      this.#fulfillDetailedSourceProfileExtraction({ route }))
  }

  async givenSourceProfileExtractionCanBeDelayed() {
    let completeSourceProfileExtraction = () => {}
    this.#pendingSourceProfileExtractionCompletion = new Promise((resolve) => {
      completeSourceProfileExtraction = resolve
    })
    await this.#page.route('**/api/source-profile-extraction', async (route) => {
      await new Promise<void>((resolve) => { this.#pendingSourceProfileExtractionResponse = resolve })
      await this.#fulfillDetailedSourceProfileExtraction({ route })
      completeSourceProfileExtraction()
    })
  }

  async givenSourceProfileExtractionIsObserved() {
    await this.#page.route('**/api/source-profile-extraction', async (route) => {
      this.#sourceProfileExtractionAttemptCount += 1
      await route.fulfill({ status: 500 })
    })
  }

  async givenJobRequirementExtractionIsAvailable() {
    await this.#page.route('**/api/job-requirement-extraction', async (route) => {
      this.#jobPostingRequestContent = readJobPostingContent(route.request().postData())
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(jobRequirementExtractionResponse),
      })
    })
  }

  async givenJobRequirementExtractionWithTargetRoleIsAvailable() {
    await this.#page.route('**/api/job-requirement-extraction', async (route) => {
      this.#jobPostingRequestContent = readJobPostingContent(route.request().postData())
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...jobRequirementExtractionResponse,
          value: {
            ...jobRequirementExtractionResponse.value,
            targetRole: { sourceExcerpt: jobPostingExcerpt, value: 'TypeScript' },
          },
        }),
      })
    })
  }

  async givenJobPostingCanBeExtractedWithDelay() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.buildVerifiedSourceProfile()
    await this.prepareMinimizedJobPostingForExtraction()
    await this.#page.route('**/api/job-requirement-extraction', async (route) => {
      this.#jobPostingRequestContent = readJobPostingContent(route.request().postData())
      await new Promise<void>((resolve) => {
        this.#pendingJobRequirementExtractionResponse = resolve
      })
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(jobRequirementExtractionResponse),
      })
    })
  }

  async extractDelayedJobRequirements() {
    const extractionRequest = this.#page.waitForRequest('**/api/job-requirement-extraction')
    await this.#page.getByRole('button', { name: 'Extract Job Requirements' }).click()
    await extractionRequest
    this.#completedAction = 'job-requirement-extraction-inspected'
  }

  async givenRecoverableJobRequirementExtractionFailure() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.buildVerifiedSourceProfile()
    await this.prepareMinimizedJobPostingForExtraction()
    let attemptCount = 0
    await this.#page.route('**/api/job-requirement-extraction', async (route) => {
      attemptCount += 1
      if (attemptCount === 1) {
        await route.fulfill({ status: 503 })
        return
      }
      this.#jobPostingRequestContent = readJobPostingContent(route.request().postData())
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(jobRequirementExtractionResponse),
      })
    })
    await this.#page.getByRole('button', { name: 'Extract Job Requirements' }).click()
    await this.#page.getByRole('button', { name: 'Retry Job Posting' }).waitFor()
    this.#completedAction = 'job-requirement-extraction-failed'
  }

  async givenMatchAnalysisIsAvailable() {
    await this.#page.route('**/api/match-analysis', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(createMatchAnalysisResponse({
          requestBody: route.request().postData(),
        })),
      })
    })
  }

  async givenIneligibleMatchAnalysis() {
    await this.#page.route('**/api/match-analysis', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: { evidence: [], relevantFactIds: [] },
        }),
      })
    })
  }

  async givenMatchAnalysisCanBeDelayed() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.givenJobRequirementExtractionIsAvailable()
    await this.buildVerifiedSourceProfile()
    await this.extractRequirementsFromMinimizedJobPosting()
    await this.#page.route('**/api/match-analysis', async (route) => {
      this.#matchAnalysisRequestCount += 1
      await new Promise<void>((resolve) => {
        this.#pendingMatchAnalysisResponse = resolve
      })
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(createMatchAnalysisResponse({ requestBody: route.request().postData() })),
      })
    })
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
  }

  async givenRecoverableMatchAnalysisFailure() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.givenJobRequirementExtractionIsAvailable()
    await this.buildVerifiedSourceProfile()
    await this.extractRequirementsFromMinimizedJobPosting()
    let attemptCount = 0
    await this.#page.route('**/api/match-analysis', async (route) => {
      attemptCount += 1
      if (attemptCount === 1) {
        await route.fulfill({ status: 503 })
        return
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(createMatchAnalysisResponse({ requestBody: route.request().postData() })),
      })
    })
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
    await this.#page.getByRole('button', { name: 'Analyze the match' }).click()
    await this.#page.getByRole('button', { name: 'Retry Match Analysis' }).waitFor()
  }

  async givenMobileViewport() {
    await this.#page.setViewportSize({ width: 390, height: 844 })
  }

  async givenResumeClaimServicesAreAvailable() {
    await this.#page.route('**/api/resume-claim-writing', async (route) => {
      const writingRequest = resumeClaimWritingRequestSchema.safeParse(
        JSON.parse(route.request().postData() ?? 'null') as unknown,
      )
      const [verifiedFact] = writingRequest.success ? writingRequest.data.verifiedFacts : []
      const claimTexts = [
        'Built React applications at Acme',
        'Worked as a FullStack Developer at Acme',
      ]
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: {
            claims: verifiedFact === undefined ? [] : claimTexts.map((text) => ({
              segments: [{ text, factIds: [verifiedFact.id] }],
            })),
          },
        }),
      })
    })
    await this.#givenSupportedResumeClaimValidation()
  }

  async givenResumeClaimGenerationCanBeDelayed() {
    await this.#page.route('**/api/resume-claim-writing', async (route) => {
      this.#resumeClaimWritingRequestCount += 1
      const writingRequest = resumeClaimWritingRequestSchema.safeParse(
        JSON.parse(route.request().postData() ?? 'null') as unknown,
      )
      const [verifiedFact] = writingRequest.success ? writingRequest.data.verifiedFacts : []
      await new Promise<void>((resolve) => {
        this.#releasePendingResumeClaimWriting = resolve
      })
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: {
            claims: verifiedFact === undefined ? [] : [{
              segments: [{
                text: 'Built React applications at Acme',
                factIds: [verifiedFact.id],
              }],
            }],
          },
        }),
      })
    })
    await this.#givenSupportedResumeClaimValidation()
  }

  async givenResumeClaimGenerationFailsOnce() {
    await this.#page.route('**/api/resume-claim-writing', async (route) => {
      this.#resumeClaimWritingRequestCount += 1
      if (this.#resumeClaimWritingRequestCount === 1) {
        await this.#fulfillUnavailableResumeClaimWriting({ route })
        return
      }
      await this.#fulfillResumeClaimWriting({ route, text: 'Built React applications at Acme' })
    })
    await this.#givenSupportedResumeClaimValidation()
  }

  async givenResumeClaimGenerationHasFailed() {
    await this.#page.getByRole('button', { name: 'Generate Resume Claims' }).click()
    await this.#page.getByRole('button', { name: 'Retry Tailored Resume' }).waitFor()
  }

  async givenIneligibleMatchAnalysisIsCompleted() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.givenJobRequirementExtractionIsAvailable()
    await this.givenIneligibleMatchAnalysis()
    await this.buildVerifiedSourceProfile()
    await this.extractRequirementsFromMinimizedJobPosting()
    await this.analyzeIneligibleMatch()
  }

  async givenResumeClaimRemainsUnsupported() {
    await this.#page.route('**/api/resume-claim-writing', (route) =>
      this.#fulfillResumeClaimWriting({ route, text: 'Led every company initiative' }))
    await this.#page.route('**/api/resume-claim-validation', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: {
            supported: false,
            feedback: [{ code: 'strengthened-scope', segmentIndex: 0 }],
          },
        }),
      })
    })
  }

  async givenResumeClaimReformulationCanBeDelayed() {
    await this.#page.unroute('**/api/resume-claim-writing')
    this.#resumeClaimWritingRequestCount = 0
    await this.#page.route('**/api/resume-claim-writing', async (route) => {
      this.#resumeClaimWritingRequestCount += 1
      await new Promise<void>((resolve) => {
        this.#releasePendingResumeClaimWriting = resolve
      })
      await this.#fulfillResumeClaimWriting({
        route,
        text: 'Built accessible React applications at Acme',
      })
    })
  }

  async givenResumeClaimReformulationHasFailed() {
    await this.#page.unroute('**/api/resume-claim-writing')
    this.#resumeClaimWritingRequestCount = 0
    await this.#page.route('**/api/resume-claim-writing', async (route) => {
      this.#resumeClaimWritingRequestCount += 1
      this.#recordResumeClaimReformulationRequest({ route })
      if (this.#resumeClaimWritingRequestCount === 1) {
        await this.#fulfillUnavailableResumeClaimWriting({ route })
        return
      }
      await this.#fulfillResumeClaimWriting({
        route,
        text: 'Built accessible React applications at Acme',
      })
    })
    const firstClaim = this.#readFirstResumeClaim()
    await firstClaim.getByText('Request a wording change — Resume Claim 1', { exact: true }).click()
    await firstClaim.getByLabel('Request a wording change').fill('Make the impact clearer')
    await firstClaim.getByRole('button', { name: 'Request reformulation' }).click()
    await this.#page.getByRole('button', { name: 'Retry operation' }).waitFor()
  }

  async givenResumeClaimReformulationIsPending() {
    await this.givenResumeClaimReformulationCanBeDelayed()
    const firstClaim = this.#readFirstResumeClaim()
    await firstClaim.getByText('Request a wording change — Resume Claim 1', { exact: true }).click()
    await firstClaim.getByLabel('Request a wording change').fill('Make the impact clearer')
    const writingRequest = this.#page.waitForRequest('**/api/resume-claim-writing')
    await firstClaim.getByRole('button', { name: 'Request reformulation' }).click()
    await writingRequest
    await this.#page.getByText('Reformulating your Resume Claim…').waitFor()
  }

  #recordResumeClaimReformulationRequest({ route }: Readonly<{ route: Route }>) {
    const writingRequest = resumeClaimWritingRequestSchema.safeParse(
      JSON.parse(route.request().postData() ?? 'null') as unknown,
    )
    if (writingRequest.success && writingRequest.data.operation === 'reformulate') {
      this.#resumeClaimReformulationRequests.push(writingRequest.data.request ?? '')
    }
  }

  async #givenSupportedResumeClaimValidation() {
    await this.#page.route('**/api/resume-claim-validation', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, value: { supported: true, feedback: [] } }),
      })
    })
  }

  async #fulfillUnavailableResumeClaimWriting({ route }: Readonly<{ route: Route }>) {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: false,
        error: { type: 'resume-claim-writing-unavailable' },
      }),
    })
  }

  async #fulfillResumeClaimWriting({ route, text }: Readonly<{ route: Route; text: string }>) {
    const writingRequest = resumeClaimWritingRequestSchema.safeParse(
      JSON.parse(route.request().postData() ?? 'null') as unknown,
    )
    const [verifiedFact] = writingRequest.success ? writingRequest.data.verifiedFacts : []
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        value: {
          claims: verifiedFact === undefined ? [] : [{
            segments: [{ text, factIds: [verifiedFact.id] }],
          }],
        },
      }),
    })
  }

  async givenVerifiedSourceProfile() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.buildVerifiedSourceProfile()
    await this.#page.locator('.workflow-progress')
      .getByRole('button', { name: /Job Posting/ }).click()
  }

  async givenTailoredResumeIsStored() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.givenJobRequirementExtractionIsAvailable()
    await this.givenMatchAnalysisIsAvailable()
    await this.givenResumeClaimServicesAreAvailable()
    await this.buildVerifiedSourceProfile()
    await this.extractRequirementsFromMinimizedJobPosting()
    await this.analyzeMatch()
    await this.givenTailoredResumeStepIsOpen()
    await this.generateResumeClaims()
  }

  async givenTailoredResumeStepIsOpen() {
    await this.#page.getByRole('button', { name: /Tailored Resume/ }).click()
  }

  async givenValidatedResumePdfExportIsAvailable() {
    await this.#page.route('**/api/tailored-resume-pdf', async (route) => {
      this.#resumePdfRequest = JSON.parse(route.request().postData() ?? 'null') as unknown
      await route.fulfill({
        contentType: 'application/pdf',
        headers: { 'Content-Disposition': 'attachment; filename="tailored-resume.pdf"' },
        body: Buffer.from('%PDF-validated-test'),
      })
    })
  }

  async givenPrivacySafeAnalyticsIsAvailable() {
    await this.#page.route('**/api/analytics', async (route) => {
      this.#analyticsEvents.push(JSON.parse(route.request().postData() ?? 'null') as unknown)
      await route.fulfill({ status: 202 })
    })
  }

  async givenBrowserPrefersLanguages({ languages }: Readonly<{ languages: readonly string[] }>) {
    await this.#page.addInitScript((browserLanguages) => {
      window.presentedDocumentLocales = []
      Object.defineProperty(navigator, 'languages', { get: () => browserLanguages })
      Object.defineProperty(navigator, 'language', { get: () => browserLanguages[0] ?? 'en-US' })
      const recordPresentedLocale = () => {
        const body = document.querySelector('body')
        if (body === null || getComputedStyle(body).visibility === 'hidden') return
        const presentedLocale = document.documentElement.lang
        if (window.presentedDocumentLocales.includes(presentedLocale)) return
        window.presentedDocumentLocales.push(presentedLocale)
      }
      new MutationObserver(recordPresentedLocale).observe(document, {
        attributes: true,
        childList: true,
        subtree: true,
      })
    }, languages)
  }

  async givenBrowserExtensionMutatesDocumentBody() {
    this.#page.on('console', (message) => {
      this.#consoleMessages.push(message.text())
    })
    await this.#page.route((url) => url.pathname === '/', async (route) => {
      const response = await route.fetch()
      const body = (await response.text()).replace('<body', '<body cz-shortcut-listen="true"')
      await route.fulfill({ response, body })
    })
  }

  async givenCandidateSessionIsStored() {
    await this.#page.goto('/')
    await seedCandidateSession({
      page: this.#page,
      expiresAt: lateResponseSession.expiresAt,
    })
  }

  async givenCandidateSessionIsActiveInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    await Promise.all([this.#page.goto('/'), secondPage.goto('/')])
    await this.#page.getByRole('button', { name: 'Start tailoring' }).click()
    await secondPage.getByText('Workflow opened').waitFor()
  }

  async givenCandidateSessionWillExpireInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    await Promise.all([this.#page.goto('/'), secondPage.goto('/')])
    await seedCandidateSession({ page: this.#page, expiresAt: Date.now() + 1_500 })
    await Promise.all([this.#page.reload(), secondPage.reload()])
    await Promise.all([
      this.#page.getByText('Workflow opened').waitFor(),
      secondPage.getByText('Workflow opened').waitFor(),
    ])
  }

  async givenPendingSourceProfileExtractionInFirstTab({ secondPage }: Readonly<{
    secondPage: Page
  }>) {
    await this.givenCandidateSessionIsActiveInBothTabs({ secondPage })
    await this.givenSourceProfileExtractionCanBeDelayed()
    await this.startSourceProfileExtraction()
    await this.#page.getByText('Extracting professional facts…').waitFor()
  }

  async givenCandidateSessionAlreadyExpired() {
    await this.#page.goto('/')
    await seedCandidateSession({ page: this.#page, expiresAt: Date.now() - 1 })
  }

  async givenPendingSourceProfileExtractionAndDeletionConfirmation() {
    await this.givenCandidateSessionIsActive()
    await this.givenSourceProfileExtractionCanBeDelayed()
    await this.startSourceProfileExtraction()
    await this.#page.getByText('Extracting professional facts…').waitFor()
    await this.#openPrivateSessionDeletionConfirmation({ page: this.#page })
  }

  async givenFrenchCandidateSessionIsActive() {
    await this.givenCandidateSessionIsActive()
    await this.switchResumeTailoringToFrench()
  }

  async givenCandidateSessionWasDeleted() {
    await this.#page.goto('/')
    await seedCandidateSession({ page: this.#page, expiresAt: lateResponseSession.expiresAt })
    await eraseCandidateSession(this.#page)
  }

  async givenCandidateSessionWasExpired() {
    await this.#page.goto('/')
    await seedCandidateSession({ page: this.#page, expiresAt: Date.now() - 1 })
    await this.#page.reload()
    await this.#page.getByText('Ready to begin').waitFor()
  }

  async startResumeTailoringSession() {
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Start tailoring' }).click()
    this.#completedAction = 'resume-tailoring-opened'
  }

  async startResumeTailoringSessionInFrench() {
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Commencer à adapter mon CV' }).click()
    this.#completedAction = 'resume-tailoring-opened'
  }

  async reloadResumeTailoringSession() {
    await this.#page.reload()
    this.#completedAction = 'candidate-session-reloaded'
  }

  async deleteResumeTailoringSessionInSecondTab({ secondPage }: Readonly<{ secondPage: Page }>) {
    await this.#openPrivateSessionDeletionConfirmation({ page: secondPage })
    await this.#confirmPrivateSessionDeletion({ page: secondPage })
    this.#completedAction = 'candidate-session-synchronized'
  }

  async cancelPrivateSessionDeletion() {
    await this.#page.getByRole('button', { name: 'Cancel' }).click()
    this.#completedAction = 'private-session-deletion-canceled'
  }

  async confirmPrivateSessionDeletion() {
    await this.#confirmPrivateSessionDeletion({ page: this.#page })
    this.#completedAction = 'private-session-deletion-confirmed'
  }

  async givenCandidateSessionRestartedBeforeDeletedOperationCompletes() {
    await this.givenPendingSourceProfileExtractionAndDeletionConfirmation()
    await this.#confirmPrivateSessionDeletion({ page: this.#page })
    await this.#page.getByRole('button', { name: 'Start tailoring' }).click()
    await this.#page.getByText('Workflow opened').waitFor()
  }

  async completeDeletedCandidateOperation() {
    this.#releasePendingSourceProfileExtraction()
    await this.#pendingSourceProfileExtractionCompletion
    this.#completedAction = 'deleted-candidate-operation-completed'
  }

  async expireResumeTailoringSessionInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    await Promise.all([
      waitForStartTailoringToBeEnabled(this.#page),
      waitForStartTailoringToBeEnabled(secondPage),
    ])
    this.#completedAction = 'candidate-session-expired'
  }

  async reloadExpiredCandidateSession() {
    await this.#page.reload()
    this.#completedAction = 'candidate-session-reloaded'
  }

  async applyLateCandidateSessionResponse() {
    this.#lateResponseOutcome = await updateCandidateSession(this.#page, lateResponseSession)
    this.#completedAction = 'candidate-session-response-applied'
  }

  async extendCandidateSessionExpirationFromResponse() {
    this.#lateResponseOutcome = await extendCandidateSessionExpiration(this.#page)
    this.#completedAction = 'expiration-extension-attempted'
  }

  async openUnknownPage() {
    await this.#page.goto(this.#readUnknownRoute())
    this.#completedAction = 'unknown-page-opened'
  }

  async viewResumeTailoring() {
    await this.#page.goto('/')
    this.#completedAction = 'resume-tailoring-viewed'
  }

  async switchResumeTailoringToFrench() {
    await this.#page.getByRole('button', { name: 'Français' }).click()
    await this.#page.locator('html[lang="fr"]').waitFor()
    await this.#page.reload()
    this.#completedAction = 'resume-tailoring-viewed'
  }

  async selectPdfSourceDocumentMethod() {
    await this.#page.getByRole('radio', { name: 'Text-based PDF' }).click()
    this.#completedAction = 'pdf-source-document-method-selected'
  }

  async openPrivateSessionDeletionConfirmation() {
    await this.#openPrivateSessionDeletionConfirmation({ page: this.#page })
    this.#completedAction = 'private-session-deletion-confirmation-opened'
  }

  async openFrenchPrivateSessionDeletionConfirmation() {
    await this.#page.getByRole('button', { name: 'Supprimer ma session privée' }).click()
    this.#completedAction = 'private-session-deletion-confirmation-opened'
  }

  async reviewPastedProfessionalText() {
    await this.#page.getByRole('radio', { name: 'Paste professional text' }).check()
    await this.#page.getByRole('textbox', { name: 'Professional text', exact: true })
      .fill(pastedProfessionalText)
    await this.#page.getByRole('button', { name: 'Review pasted text' }).click()
    this.#completedAction = 'pasted-source-document-reviewed'
  }

  async givenUnreadablePdfWasRejected() {
    await this.givenCandidateSessionIsActive()
    await this.#uploadUnreadablePdf()
    await this.#page.locator('.source-document-input').getByRole('alert').waitFor()
  }

  async uploadUnreadablePdf() {
    await this.#uploadUnreadablePdf()
    this.#completedAction = 'unreadable-source-document-rejected'
  }

  async uploadFrenchUnreadablePdf() {
    await this.#uploadUnreadablePdf()
    this.#completedAction = 'unreadable-source-document-rejected'
  }

  async uploadReadablePdfWithIncompatibleReader() {
    await this.#page.locator('#source-document-pdf').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: createTextPdf('Senior FullStack Developer using React at Acme'),
    })
    this.#completedAction = 'incompatible-source-document-reader-rejected'
  }

  async retryWithReadablePdf() {
    await this.#page.locator('#source-document-pdf').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: createTextPdf('Senior FullStack Developer using React at Acme'),
    })
    this.#completedAction = 'unreadable-source-document-recovered'
  }

  async #uploadUnreadablePdf() {
    await this.#page.locator('#source-document-pdf').setInputFiles({
      name: 'scanned-resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('not a readable PDF'),
    })
  }

  async reviewEmptyPastedProfessionalText() {
    await this.#page.getByRole('radio', { name: 'Paste professional text' }).check()
    await this.#page.getByRole('button', { name: 'Review pasted text' }).click()
    this.#completedAction = 'empty-pasted-source-document-reviewed'
  }

  async switchSourceDocumentMethods() {
    await this.#page.getByRole('radio', { name: 'Paste professional text' }).check()
    await this.#page.getByRole('textbox', { name: 'Professional text', exact: true })
      .fill(pastedProfessionalText)
    await this.#page.getByRole('radio', { name: 'Text-based PDF' }).check()
    await this.#page.getByRole('radio', { name: 'Paste professional text' }).check()
    this.#completedAction = 'source-document-method-switched'
  }

  async buildVerifiedSourceProfile() {
    await this.#page.locator('#source-document-pdf').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: createTextPdf(
        'bakate@example.com +33 6 12 34 56 78 Senior FullStack Developer using React at Acme',
      ),
    })
    await this.#page.getByLabel('Exact content that will be sent for extraction').waitFor()
    await this.#page.getByRole('button', { name: 'Continue and analyze my resume' }).click()
    await this.#page.getByRole('button', { name: /Source Profile 1 verified fact/ }).waitFor()
    await expect(this.#page.getByText('Started at Acme in 2021 or 2022')).toHaveCount(0)
    this.#completedAction = 'source-profile-built'
  }

  async reviewSourceDocumentBeforeConsent() {
    await this.#uploadSourceDocument()
    this.#completedAction = 'source-document-reviewed'
  }

  async startSourceProfileExtraction() {
    await this.#uploadSourceDocument()
    await this.#page.getByRole('button', { name: 'Continue and analyze my resume' }).click()
    this.#completedAction = 'source-profile-extraction-started'
  }

  async restartWithRecoverableSourceProfileExtractionFailure() {
    this.#releasePendingSourceProfileExtraction()
    await this.#page.getByRole('heading', { name: 'Check your imported profile' }).waitFor()
    await this.#restartCandidateSession()
    await this.#givenRecoverableSourceProfileExtractionFailure()
    await this.startSourceProfileExtraction()
    await this.#page.getByRole('button', { name: 'Retry Source Profile' }).waitFor()
  }

  async #restartCandidateSession() {
    await this.#openPrivateSessionDeletionConfirmation({ page: this.#page })
    await this.#confirmPrivateSessionDeletion({ page: this.#page })
    const startButton = this.#page.getByRole('button', { name: 'Start tailoring' })
    await startButton.waitFor()
    await startButton.click()
  }

  async #openPrivateSessionDeletionConfirmation({ page }: Readonly<{ page: Page }>) {
    await page.getByRole('button', {
      name: /Delete private session|Supprimer ma session privée/,
    }).click()
  }

  async #confirmPrivateSessionDeletion({ page }: Readonly<{ page: Page }>) {
    await page.getByRole('button', {
      name: /Delete session now|Supprimer la session maintenant/,
    }).click()
  }

  async #givenRecoverableSourceProfileExtractionFailure() {
    await this.#page.route('**/api/source-profile-extraction', async (route) => {
      this.#sourceProfileExtractionAttemptCount += 1
      if (this.#sourceProfileExtractionAttemptCount === 1) {
        await route.fulfill({ status: 503 })
        return
      }
      await this.#fulfillDetailedSourceProfileExtraction({ route })
    })
  }

  async retryFailedSourceProfileExtraction() {
    await this.#page.getByRole('button', { name: 'Retry Source Profile' }).click()
    this.#completedAction = 'source-profile-extraction-retried'
  }

  async extractDetailedSourceProfileFacts() {
    await this.#uploadSourceDocument()
    await this.#page.getByRole('button', { name: 'Continue and analyze my resume' }).click()
    await this.#page.getByRole('heading', { name: 'Check your imported profile' }).waitFor()
    this.#completedAction = 'source-profile-facts-extracted'
  }

  inspectCollectivelyAttestedFacts() {
    this.#completedAction = 'source-profile-facts-inspected'
  }

  async resolveVisibleEducationConflict() {
    const conflictReview = this.#page.getByRole('region', { name: 'Conflicts requiring resolution' })
    await expect(conflictReview.getByRole('checkbox')).toHaveCount(0)
    const selectedFact = readFactCard({
      group: conflictReview, page: this.#page, value: 'Computer Science degree in 2018',
    })
    await selectedFact.getByRole('button', {
      name: 'Keep this fact and resolve the conflict',
    }).click()
    await expect(this.#page.getByRole('region', { name: 'Conflicts requiring resolution' }))
      .toHaveCount(0)
  }

  async correctVisibleSkillFact() {
    const skillGroup = this.#page.getByRole('region', { name: 'Skill' })
    await skillGroup.locator('summary').getByText('Correct this information').click()
    await skillGroup.getByLabel('Correct this information').fill('Advanced TypeScript')
    await skillGroup.getByRole('button', { name: 'Create correction' }).click()
    this.#completedAction = 'source-profile-facts-corrected'
  }

  async reloadVerifiedSourceProfile() {
    await this.#page.reload()
    this.#completedAction = 'source-profile-reloaded'
  }

  async reloadTailoredResume() {
    await this.#page.reload()
    this.#completedAction = 'resume-claims-reloaded'
  }

  async moveFirstResumeClaimDown() {
    await this.#readResumeClaims().getByRole('button', {
      name: 'Move down — Resume Claim 1',
    }).click()
    this.#completedAction = 'resume-claim-reordered'
  }

  async removeFirstResumeClaim() {
    await this.#readResumeClaims().getByRole('button', {
      name: 'Remove claim — Resume Claim 1',
    }).click()
    this.#completedAction = 'resume-claim-removed'
  }

  async openFirstResumeClaimReformulation() {
    await this.#readFirstResumeClaim()
      .getByText('Request a wording change — Resume Claim 1', { exact: true })
      .click()
    this.#completedAction = 'resume-claim-reformulation-opened'
  }

  async requestDelayedResumeClaimReformulation() {
    const firstClaim = this.#readFirstResumeClaim()
    await firstClaim.getByText('Request a wording change — Resume Claim 1', { exact: true }).click()
    await firstClaim.getByLabel('Request a wording change').fill('Make the impact clearer')
    const writingRequest = this.#page.waitForRequest('**/api/resume-claim-writing')
    await firstClaim.getByRole('button', { name: 'Request reformulation' })
      .dblclick({ force: true })
    await writingRequest
    this.#completedAction = 'resume-claim-reformulation-requested'
  }

  async retryResumeClaimReformulation() {
    await this.#page.getByRole('button', { name: 'Retry operation' }).click()
    await this.#page.getByText('Built accessible React applications at Acme', { exact: true })
      .waitFor()
    this.#completedAction = 'resume-claim-reformulation-retried'
  }

  async rateTailoredResumeFidelityDuringReformulation() {
    await this.#page.getByRole('button', { name: 'Faithful' }).click()
    this.#completedAction = 'resume-fidelity-rated-during-reformulation'
  }

  async navigateToTailoredResumeExport() {
    const flowNavigation = this.#page.getByRole('navigation', {
      name: 'Tailored Resume curation',
    })
    await flowNavigation.getByRole('link', { name: 'PDF export' }).click()
    this.#completedAction = 'resume-preview-navigated'
  }

  async downloadTailoredResumePdf() {
    const downloadPromise = this.#page.waitForEvent('download')
    await this.#page.getByRole('button', { name: 'Download validated A4 PDF' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('tailored-resume.pdf')
    this.#completedAction = 'resume-pdf-downloaded'
  }

  async rateTailoredResumeOutcomes() {
    await this.#page.getByRole('button', { name: 'Faithful' }).click()
    await expect(this.#page.getByRole('button', { name: 'Faithful' })).toBeDisabled()
    await this.#page.getByRole('button', { name: 'Relevant' }).click()
    await expect(this.#page.getByRole('button', { name: 'Relevant' })).toBeDisabled()
  }

  async reloadTailoredResumeOutcomeFeedback() {
    await this.#page.reload()
  }

  async extractRequirementsFromMinimizedJobPosting() {
    await this.prepareMinimizedJobPostingForExtraction()
    await this.#page.getByRole('button', { name: 'Extract Job Requirements' }).click()
    await this.#page.getByRole('heading', { name: 'Review extracted Job Requirements' }).waitFor()
    this.#completedAction = 'job-requirements-extracted'
  }

  async analyzePastedJobPostingInOneAction() {
    await this.#page.locator('.workflow-progress').getByRole('button', { name: /Job Posting/ }).click()
    await this.#page.getByLabel('Paste the Job Posting').fill(jobPostingExcerpt)
    await this.#page.getByRole('button', { name: 'Analyze this Job Posting' }).click()
    await expect(this.#page.getByRole('button', { name: /Match Analysis/ })).toContainText('33%')
    this.#completedAction = 'match-analyzed'
  }

  async analyzeUploadedPdfJobPostingInOneAction() {
    await this.#page.locator('.workflow-progress').getByRole('button', { name: /Job Posting/ }).click()
    await this.#page.locator('#job-posting-file').setInputFiles({
      name: 'job-posting.pdf',
      mimeType: 'application/pdf',
      buffer: createTextPdf(jobPostingExcerpt),
    })
    await expect(this.#page.getByRole('button', { name: /Match Analysis/ })).toContainText('33%')
    this.#completedAction = 'match-analyzed'
  }

  async correctTargetRoleFromExactJobPostingText() {
    await this.#page.getByRole('button', { name: /Job Posting/ }).click()
    const targetRoleInput = this.#page.getByLabel(
      'Correct the Target Role with exact text from the Job Posting',
    )
    const saveTargetRole = this.#page.getByRole('button', {
      name: 'Save Target Role and refresh analysis',
    })
    await targetRoleInput.fill('Chief Technology Officer')
    await expect(saveTargetRole).toBeDisabled()
    await targetRoleInput.fill('Senior React Developer')
    await expect(saveTargetRole).toBeEnabled()
    await saveTargetRole.click()
    await expect(this.#page.getByRole('button', { name: /Match Analysis/ })).toContainText('33%')
    this.#completedAction = 'match-analyzed'
  }

  async prepareMinimizedJobPostingForExtraction() {
    await this.#page.locator('.workflow-progress').getByRole('button', { name: /Job Posting/ }).click()
    await this.#page.getByLabel('Paste the Job Posting').fill(
      `${jobPostingExcerpt}\nContact jobs@example.com\nSalary: competitive`,
    )
    await this.#page.getByRole('button', { name: 'Review this Job Posting' }).click()
    const editor = this.#page.getByLabel('Exact Job Posting content sent for extraction')
    await editor.fill(jobPostingExcerpt)
    await this.#page.getByRole('button', { name: 'Save minimized Job Posting' }).click()
  }

  async retryFailedJobRequirementExtraction() {
    await this.#page.getByRole('button', { name: 'Retry Job Posting' }).click()
    this.#completedAction = 'job-requirements-retried'
  }

  async reviewFrenchJobPostingWithPhoneNumber() {
    await this.#page.getByLabel("Colle l'Offre d'emploi").fill(
      `${legitimateFrenchJobPosting}\nTéléphone : +33 6 12 34 56 78`,
    )
    await this.#page.getByRole('button', { name: "Vérifier cette Offre d'emploi" }).click()
    await this.#page.getByLabel(
      "Contenu exact de l'Offre d'emploi envoyé pour l'extraction",
    ).waitFor()
    this.#completedAction = 'job-posting-reviewed'
  }

  async analyzeMatch() {
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
    await this.#page.getByRole('button', { name: 'Analyze the match' }).click()
    await this.#page.getByText('33%', { exact: true }).waitFor()
    this.#completedAction = 'match-analyzed'
  }

  async skipHighestImpactProfileEnrichmentPrompt() {
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
    await this.#page.getByRole('button', { name: 'Skip this question' }).click()
    this.#completedAction = 'profile-enrichment-skipped'
  }

  async analyzeIneligibleMatch() {
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
    await this.#page.getByRole('button', { name: 'Analyze the match' }).click()
    await this.#page.getByText('Generation eligibility: not eligible').waitFor()
    this.#completedAction = 'match-analyzed'
  }

  async generateResumeClaims() {
    await this.#page.getByRole('button', { name: 'Generate Resume Claims' }).click()
    await this.#page.getByText('Built React applications at Acme', { exact: true }).waitFor()
    this.#completedAction = 'resume-claims-generated'
  }

  async generateDelayedResumeClaimsWithDoubleClick() {
    const generationAction = this.#page.getByRole('button', { name: 'Generate Resume Claims' })
    const writingRequest = this.#page.waitForRequest('**/api/resume-claim-writing')
    await generationAction.dblclick({ force: true })
    await writingRequest
    this.#completedAction = 'resume-claims-generated'
  }

  async retryResumeClaimGeneration() {
    await this.#page.getByRole('button', { name: 'Retry Tailored Resume' }).click()
    await this.#page.getByText('Built React applications at Acme', { exact: true }).waitFor()
    this.#completedAction = 'resume-claims-retried'
  }

  async generateExcludedResumeClaim() {
    await this.#page.getByRole('button', { name: 'Generate Resume Claims' }).click()
    await this.#page.getByText(/Content that remained unsupported/).waitFor()
    this.#completedAction = 'resume-claims-excluded'
  }

  async openIneligibleTailoredResume() {
    await this.#page.getByRole('button', { name: /Tailored Resume/ }).click()
    this.#completedAction = 'resume-tailoring-viewed'
  }

  async reopenCompletedSourceProfile() {
    await this.#page.getByRole('button', { name: /Source Profile/ }).click()
    this.#completedAction = 'source-profile-reopened'
  }

  async reopenCompletedSourceProfileWithKeyboard() {
    const sourceProfileStep = this.#page.getByRole('button', { name: /Source Profile/ })
    await sourceProfileStep.focus()
    await sourceProfileStep.press('Enter')
    this.#completedAction = 'source-profile-reopened'
  }

  async analyzeDelayedMatchWithDoubleClick() {
    const analyzeButton = this.#page.getByRole('button', { name: 'Analyze the match' })
    const matchAnalysisRequest = this.#page.waitForRequest('**/api/match-analysis')
    await analyzeButton.dblclick({ force: true })
    await matchAnalysisRequest
    this.#completedAction = 'match-analysis-inspected'
  }

  async waitOnPendingMatchAnalysis() {
    await this.#page.getByRole('button', { name: 'Analyze the match' }).click()
    await this.#page.waitForTimeout(10_100)
    this.#completedAction = 'match-analysis-waited'
  }

  async retryFailedMatchAnalysis() {
    await this.#page.getByRole('button', { name: 'Retry Match Analysis' }).click()
    this.#completedAction = 'match-analysis-retried'
  }

  async expectResumeTailoringSessionToBeStoredInIndexedDb() {
    this.#expectCompletedAction('resume-tailoring-opened')
    await expect(this.#page.getByText('Workflow opened')).toBeVisible()
    const storage = await readBrowserStorage(this.#page)
    expect(storage.localStorageLength).toBe(0)
    expect(storage.sessionId).toMatch(/^candidate-session-/)
    expect(storage.remainingLifetime).toBeGreaterThan(24 * 60 * 60 * 1_000 - 10_000)
  }

  async expectResumeTailoringSessionToBeReady() {
    this.#expectCompletedAction('candidate-session-reloaded')
    await expect(this.#page.getByText('Workflow opened')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Delete private session' })).toBeVisible()
  }

  async expectResumeTailoringSessionDeletedInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    this.#expectCandidateSessionInvalidationAction()
    await expect(this.#page.getByText('Ready to begin')).toBeVisible()
    await expect(secondPage.getByText('Ready to begin')).toBeVisible()
  }

  async expectFreshStartControlFocusedInSecondTab({ secondPage }: Readonly<{
    secondPage: Page
  }>) {
    this.#expectCompletedAction('candidate-session-synchronized')
    await expect(secondPage.getByRole('button', { name: 'Start tailoring' })).toBeFocused()
  }

  async expectActiveCandidateContextToBePreserved() {
    this.#expectCompletedAction('private-session-deletion-canceled')
    await expect(this.#page.getByLabel('Exact content that will be sent for extraction'))
      .toHaveValue(/Senior FullStack Developer/)
    await expect(this.#page.getByText('Extracting professional facts…')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: /Source Profile/ }))
      .toHaveAttribute('aria-current', 'step')
    await expect(this.#page.getByRole('button', { name: 'Delete private session' })).toBeFocused()
  }

  async expectCandidateSessionDeletedDuringPendingOperation() {
    this.#expectCompletedAction('private-session-deletion-confirmed')
    await expect(this.#page.getByText('Ready to begin')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Start tailoring' })).toBeFocused()
  }

  async expectRestartedCandidateSessionToRemainActive() {
    this.#expectCompletedAction('deleted-candidate-operation-completed')
    await expect(this.#page.getByText('Workflow opened')).toBeVisible()
    await expect(this.#page.getByText('Something went wrong')).toHaveCount(0)
  }

  async expectFrenchDeletionConfirmationToTrapFocus() {
    this.#expectCompletedAction('private-session-deletion-confirmation-opened')
    const confirmation = this.#page.getByRole('alertdialog', {
      name: 'Supprimer ma session privée ?',
    })
    await expect(confirmation).toContainText('Document Source')
    await expect(confirmation).toContainText('Profil Source')
    await expect(confirmation).toContainText("Offre d'emploi")
    await expect(confirmation).toContainText('Analyse de Correspondance')
    await expect(confirmation).toContainText('CV Adapté')
    await expect(confirmation).toContainText('Photo fournie par le Candidat')
    await this.#page.keyboard.press('Shift+Tab')
    await expect(confirmation.getByRole('button', {
      name: 'Supprimer la session maintenant',
    })).toBeFocused()
    await this.#page.keyboard.press('Tab')
    await expect(confirmation.getByRole('button', { name: 'Annuler' })).toBeFocused()
  }

  async expectResumeTailoringSessionToBeNotStarted() {
    this.#expectCompletedAction('candidate-session-reloaded')
    await expect(this.#page.getByText('Ready to begin')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Start tailoring' })).toBeEnabled()
  }

  expectLateResponseToBeDiscarded() {
    this.#expectCompletedAction('candidate-session-response-applied')
    expect(this.#lateResponseOutcome).toEqual(inactiveSessionOutcome)
  }

  expectSessionExpirationExtensionToBeRejected() {
    this.#expectCompletedAction('expiration-extension-attempted')
    expect(this.#lateResponseOutcome).toEqual({
      update: inactiveSessionResult,
      currentExpiresAt: lateResponseSession.expiresAt,
    })
  }

  async expectPageNotFoundWithWorkflowLink() {
    this.#expectCompletedAction('unknown-page-opened')
    await expect(this.#page).toHaveTitle('Honest Resume')
    await expect(this.#page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(this.#page.getByRole('link', { name: 'Return to the workflow' })).toHaveAttribute(
      'href',
      '/',
    )
  }

  async expectCandidateContentRetentionExplained() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.getByText(/expires locally after 24 hours/)).toBeVisible()
    await expect(this.#page.getByText(/Downloaded files remain on your device/)).toBeVisible()
  }

  async expectResumeTailoringToBeInEnglish() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(
      this.#page.getByRole('heading', { name: 'Tailor your resume without inventing a thing.' }),
    ).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  async expectNoHydrationMismatchFromBrowserExtension() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.locator('body')).toHaveAttribute('cz-shortcut-listen', 'true')
    expect(this.#consoleMessages.join('\n')).not.toContain('hydrated but some attributes')
  }

  async expectResumeTailoringToBeInFrench() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(
      this.#page.getByRole('heading', { name: 'Adapte ton CV sans rien inventer.' }),
    ).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Français' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  async expectFrenchWasFirstPresentedLocale() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    expect(await this.#page.evaluate(() => window.presentedDocumentLocales)).toEqual(['fr'])
  }

  async expectFrenchLocaleAndCandidateSessionToBeRetained() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await this.expectResumeTailoringToBeInFrench()
    await expect(this.#page.getByText('Parcours ouvert')).toBeVisible()
    await expect(
      this.#page.getByRole('button', { name: 'Supprimer ma session privée' }),
    ).toBeVisible()
    expect(await this.#page.evaluate(() => localStorage.getItem('honest-resume-locale'))).toBe('fr')
  }

  async expectLocalizedPrivateSessionDeletionConfirmation() {
    this.#expectCompletedAction('private-session-deletion-confirmation-opened')
    const confirmation = this.#page.getByRole('alertdialog', { name: 'Delete private session?' })
    await expect(confirmation).toBeVisible()
    await expect(confirmation).toContainText('Source Document')
    await expect(confirmation).toContainText('Source Profile')
    await expect(confirmation).toContainText('Job Posting')
    await expect(confirmation).toContainText('Match Analysis')
    await expect(confirmation).toContainText('Tailored Resume')
    await expect(confirmation).toContainText('photo')
    await expect(confirmation.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await expect(this.#page.getByRole('navigation', { name: 'Resume tailoring progress' }))
      .not.toContainText('Delete private session')
  }

  async expectVerifiedSourceProfileBuiltFromMinimizedContent() {
    this.#expectCompletedAction('source-profile-built')
    expect(this.#extractionRequestContent).toContain('Senior FullStack Developer using React at Acme')
    expect(this.#extractionRequestContent).not.toContain('bakate@example.com')
    expect(this.#extractionRequestContent).not.toContain('+33 6 12 34 56 78')
    await expect(this.#page.getByRole('button', { name: /Source Profile/ }))
      .toContainText('1 verified fact')
  }

  async expectClearEnglishSourceDocumentOptions() {
    this.#expectCompletedAction('pdf-source-document-method-selected')
    await expect(this.#page.getByRole('radio', { name: 'Text-based PDF' })).toBeChecked()
    await expect(this.#page.getByText('Scanned image-only PDFs cannot be read.')).toBeVisible()
    await expect(this.#page.getByRole('radio', { name: 'Paste professional text' })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Choose PDF' })).toBeVisible()
  }

  async expectLocalizedFrenchPdfIntake() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.getByRole('group', { name: 'Méthode du Document Source' })).toBeVisible()
    await expect(this.#page.getByRole('radio', { name: 'PDF texte' })).toBeChecked()
    await expect(this.#page.getByRole('button', { name: 'Choisir un PDF' })).toBeVisible()
    await expect(this.#page.getByText('Aucun PDF sélectionné')).toBeVisible()
    await expect(this.#page.getByText(/PDF scannés composés uniquement d'images/)).toBeVisible()
  }

  async expectLocalizedFrenchUnreadablePdfFeedback() {
    this.#expectCompletedAction('unreadable-source-document-rejected')
    const input = this.#page.locator('.source-document-input')
    await expect(input.getByRole('alert')).toHaveText(
      "Ce fichier n'est pas un PDF valide. Choisis un autre fichier PDF.",
    )
    await expect(input.getByText('PDF sélectionné : scanned-resume.pdf'))
      .toHaveAttribute('aria-live', 'polite')
    await expect(this.#page.getByRole('alert')).toHaveCount(1)
  }

  async expectLocalizedBrowserCompatibilityRecovery() {
    this.#expectCompletedAction('incompatible-source-document-reader-rejected')
    const input = this.#page.locator('.source-document-input')
    await expect(input.getByRole('alert')).toHaveText(
      "Ce navigateur ne peut pas lire les PDF de manière fiable. Mets à jour Safari, Chrome ou Firefox, ou colle plutôt ton texte professionnel.",
    )
    await expect(this.#page.getByRole('radio', { name: 'Coller du texte professionnel' }))
      .toBeVisible()
  }

  async expectPastedTextInSharedSourceDocumentReview() {
    this.#expectCompletedAction('pasted-source-document-reviewed')
    const review = this.#page.getByRole('region', { name: 'Review outgoing Source Document' })
    await expect(review.getByLabel('Exact content that will be sent for extraction'))
      .toHaveValue(pastedProfessionalText)
    await expect(review.getByRole('button', { name: 'Continue and analyze my resume' })).toBeEnabled()
  }

  async expectUnreadablePdfRecoveryToKeepSessionActive() {
    this.#expectCompletedAction('unreadable-source-document-recovered')
    await expect(this.#page.getByRole('button', { name: 'Delete private session' })).toBeVisible()
    await expect(this.#page.getByRole('region', { name: 'Review outgoing Source Document' })).toBeVisible()
  }

  async expectUnreadablePdfFeedbackBesideIntake() {
    this.#expectCompletedAction('unreadable-source-document-rejected')
    const input = this.#page.locator('.source-document-input')
    await expect(input.getByRole('alert')).toHaveText(
      'This file is not a valid PDF. Choose another PDF file.',
    )
    await expect(input.getByText('Selected PDF: scanned-resume.pdf'))
      .toHaveAttribute('aria-live', 'polite')
    await expect(this.#page.getByRole('alert')).toHaveCount(1)
    await expect(this.#page.getByRole('button', { name: 'Delete private session' })).toBeVisible()
  }

  async expectEmptyPastedTextValidation() {
    this.#expectCompletedAction('empty-pasted-source-document-reviewed')
    await expect(this.#page.locator('.source-document-input').getByRole('alert'))
      .toHaveText('Paste professional text before continuing.')
    await expect(this.#page.getByRole('region', { name: 'Review outgoing Source Document' }))
      .not.toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Delete private session' })).toBeVisible()
  }

  async expectSourceDocumentMethodSwitchToRemainLocal() {
    this.#expectCompletedAction('source-document-method-switched')
    await expect(this.#page.getByRole('textbox', { name: 'Professional text', exact: true }))
      .toHaveValue(pastedProfessionalText)
    await expect(this.#page.getByRole('region', { name: 'Review outgoing Source Document' }))
      .not.toBeVisible()
    expect(this.#sourceProfileExtractionAttemptCount).toBe(0)
  }

  async expectCoherentSourceDocumentReviewSurface() {
    this.#expectCompletedAction('source-document-reviewed')
    const review = this.#page.getByRole('region', { name: 'Review outgoing Source Document' })
    await expect(review.getByLabel('Exact content that will be sent for extraction')).toBeVisible()
    await expect(review.getByRole('heading', { name: 'Removed before processing' })).toBeVisible()
    const continueButton = review.getByRole('button', { name: 'Continue and analyze my resume' })
    await this.#expectDesktopSourceDocumentReviewLayout({ continueButton, review })
    await expect(continueButton).toBeEnabled()
    await this.#expectMobileSourceDocumentReviewLayout({ review })
  }

  async #expectDesktopSourceDocumentReviewLayout({ continueButton, review }: Readonly<{
    continueButton: Locator
    review: Locator
  }>) {
    const [sensitivePanel, outgoingPanel] = await review.locator('.source-document-panel').all()
    const [sensitiveBox, outgoingBox, continueButtonBox] = await Promise.all([
      sensitivePanel?.boundingBox(), outgoingPanel?.boundingBox(), continueButton.boundingBox(),
    ])
    const horizontalGap = (outgoingBox?.x ?? 0) - ((sensitiveBox?.x ?? 0) + (sensitiveBox?.width ?? 0))
    expect(horizontalGap).toBeGreaterThanOrEqual(20)
    expect(continueButtonBox).not.toBeNull()
  }

  async #expectMobileSourceDocumentReviewLayout({ review }: Readonly<{ review: Locator }>) {
    await this.#page.setViewportSize({ width: 390, height: 844 })
    const [sensitivePanel, outgoingPanel] = await review.locator('.source-document-panel').all()
    const [sensitiveBox, outgoingBox] = await Promise.all([
      sensitivePanel?.boundingBox(), outgoingPanel?.boundingBox(),
    ])
    expect(outgoingBox?.y ?? 0).toBeGreaterThan(
      (sensitiveBox?.y ?? 0) + (sensitiveBox?.height ?? 0),
    )
    expect(await this.#page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  }

  async expectPendingSourceProfileExtractionThenSuccess() {
    this.#expectCompletedAction('source-profile-extraction-started')
    await expect(this.#page.getByText('Extracting professional facts…')).toBeVisible()
    await expect(this.#page.locator('.source-profile-workspace')).toHaveAttribute('aria-busy', 'true')
    await expect(this.#page.getByRole('button', { name: 'Continue and analyze my resume' }))
      .toBeDisabled()
    await expect.poll(() => this.#pendingSourceProfileExtractionResponse !== undefined).toBe(true)
  }

  async expectRetriedSourceProfileExtractionToSucceed() {
    this.#expectCompletedAction('source-profile-extraction-retried')
    await expect(this.#page.getByRole('heading', { name: 'Check your imported profile' })).toBeVisible()
    await expect(this.#page.getByRole('region', { name: 'Experience' })).toBeVisible()
    expect(this.#sourceProfileExtractionAttemptCount).toBe(2)
  }

  async expectNonConflictingFactsToBeImmediatelyUsable() {
    this.#expectCompletedAction('source-profile-facts-inspected')
    const experienceGroup = this.#page.getByRole('region', { name: 'Experience' })
    const skillGroup = this.#page.getByRole('region', { name: 'Skill' })
    await expect(experienceGroup.getByRole('checkbox')).toHaveCount(0)
    await expect(experienceGroup.getByRole('button', { name: 'Confirm fact' })).toHaveCount(0)
    await expect(skillGroup.getByRole('checkbox')).toHaveCount(0)
    await expect(skillGroup.getByRole('button', { name: 'Confirm fact' })).toHaveCount(0)
    await expect(readFactCard({
      group: experienceGroup, page: this.#page, value: 'Senior FullStack Developer at Acme',
    })).toContainText('From your resume')
    await expect(readFactCard({ group: skillGroup, page: this.#page, value: 'TypeScript' }))
      .toContainText('From your resume')
    await expect(this.#page.getByRole('region', { name: 'Conflicts requiring resolution' }))
      .toBeVisible()
  }

  async expectConflictResolutionAndImmutableCorrection() {
    this.#expectCompletedAction('source-profile-facts-corrected')
    await this.#expectResolvedEducationConflict()
    await this.#expectImmutableSkillCorrection()
  }

  async #expectResolvedEducationConflict() {
    const educationGroup = this.#page.getByRole('region', { name: 'Education' })
    await expect(readFactCard({
      group: educationGroup, page: this.#page, value: 'Computer Science degree in 2018',
    }))
      .toContainText('From your resume')
    await expect(readFactCard({
      group: educationGroup, page: this.#page, value: 'Computer Science degree in 2019',
    })).toHaveCount(0)
  }

  async #expectImmutableSkillCorrection() {
    const skillGroup = this.#page.getByRole('region', { name: 'Skill' })
    await expect(readFactCard({ group: skillGroup, page: this.#page, value: 'TypeScript' }))
      .toHaveCount(0)
    await expect(readFactCard({
      group: skillGroup, page: this.#page, value: 'Advanced TypeScript',
    }))
      .toContainText('From your resume')
  }

  async expectVerifiedSourceProfileToBeRestored() {
    this.#expectCompletedAction('source-profile-reloaded')
    await this.#page.getByRole('button', { name: /Source Profile/ }).click()
    await expect(this.#page.getByRole('heading', { name: 'Check your imported profile' })).toBeVisible()
    await expect(this.#page.getByText('Senior FullStack Developer using React at Acme')).toBeVisible()
    await expect(this.#page.getByText('From your resume', { exact: true })).toBeVisible()
  }

  async expectAtomicJobRequirementsWithSourceProvenance() {
    this.#expectCompletedAction('job-requirements-extracted')
    expect(this.#jobPostingRequestContent).toBe(jobPostingExcerpt)
    expect(this.#jobPostingRequestContent).not.toContain('jobs@example.com')
    await this.#page.getByRole('button', { name: /Job Posting/ }).click()
    const requirementGroup = this.#page.locator('.job-requirement-group')
    await expect(requirementGroup).toContainText('1 required · 1 preferred')
    await expect(requirementGroup).toHaveCount(1)
    const disclosure = requirementGroup.locator('details')
    await expect(disclosure).not.toHaveAttribute('open', '')
    await disclosure.locator('summary').click()
    await expect(disclosure).toHaveAttribute('open', '')
    await expect(requirementGroup.getByText('TypeScript', { exact: true })).toBeVisible()
    await expect(requirementGroup.getByText('Required', { exact: true })).toBeVisible()
    await expect(requirementGroup.getByText('React', { exact: true })).toBeVisible()
    await expect(requirementGroup.getByText('Preferred', { exact: true })).toBeVisible()
    await expect(requirementGroup.getByText(jobPostingExcerpt, { exact: true })).toHaveCount(1)
  }

  async expectEvidenceBackedMatchScoreAndGapAnalysis() {
    this.#expectCompletedAction('match-analyzed')
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
    await expect(this.#page.getByRole('heading', { name: 'Match Analysis summary' })).toBeVisible()
    await expect(this.#page.getByText('33%', { exact: true })).toBeVisible()
    await expect(this.#page.getByText(/below 50%/)).toBeVisible()
    await expect(this.#page.getByRole('heading', {
      name: 'Covered Job Requirements and Match Evidence',
    })).toBeVisible()
    const evidenceDetails = this.#page.locator('.match-evidence-group details')
    await evidenceDetails.locator('summary').click()
    await expect(this.#page.getByText('React', { exact: true }).last()).toBeVisible()
    await expect(this.#page.getByRole('heading', {
      name: 'Uncovered required Job Requirements',
    })).toBeVisible()
    await expect(this.#page.getByText('TypeScript', { exact: true }).last()).toBeVisible()
  }

  async expectOneActionJobPostingAnalysis() {
    this.#expectCompletedAction('match-analyzed')
    expect(this.#jobPostingRequestContent).toBe(jobPostingExcerpt)
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
    await expect(this.#page.getByRole('heading', { name: 'Match Analysis summary' })).toBeVisible()
    await expect(this.#page.getByText('33%', { exact: true })).toBeVisible()
    await this.#page.getByRole('button', { name: /Job Posting/ }).click()
    await expect(this.#page.getByText(
      'No unambiguous target role was found. The resume will use the localized fallback title.',
    )).toBeVisible()
  }

  async expectCorrectedSourceBackedTargetRole() {
    this.#expectCompletedAction('match-analyzed')
    await this.#page.getByRole('button', { name: /Job Posting/ }).click()
    await expect(this.#page.getByRole('region', { name: 'Target role' })
      .locator('strong').filter({ hasText: /^Senior React Developer$/u })).toBeVisible()
  }

  async expectPendingJobRequirementExtractionThenFocusedResult() {
    this.#expectCompletedAction('job-requirement-extraction-inspected')
    await expect(this.#page.getByText('Extracting Job Requirements…')).toBeVisible()
    await expect(this.#page.locator('.job-posting-workspace')).toHaveAttribute('aria-busy', 'true')
    await expect(this.#page.getByRole('button', { name: 'Extract Job Requirements' })).toBeDisabled()
    expect(this.#pendingJobRequirementExtractionResponse).toBeDefined()
    this.#releasePendingJobRequirementExtraction()
    await expect(this.#page.getByRole('heading', { name: 'Review extracted Job Requirements' }))
      .toBeVisible()
    await expect(this.#page.locator('#job-requirements-title')).toBeFocused()
  }

  async expectRetryToPreserveJobPostingAndShowRequirements() {
    this.#expectCompletedAction('job-requirements-retried')
    await expect(this.#page.getByRole('heading', { name: 'Review extracted Job Requirements' }))
      .toBeVisible()
    await expect(this.#page.locator('#job-requirements-title')).toBeFocused()
    expect(this.#jobPostingRequestContent).toBe(jobPostingExcerpt)
  }

  async expectMatchSummaryBeforeProgressiveEvidence() {
    this.#expectCompletedAction('match-analyzed')
    await this.#page.getByRole('button', { name: /Match Analysis/ }).click()
    const summary = this.#page.locator('.match-analysis-summary')
    await expect(summary).toContainText('33%')
    await expect(summary).toContainText('eligible')
    await expect(summary).toContainText('0 / 1')
    await expect(summary).toContainText('1 / 1')
    await expect(summary).toContainText('TypeScript')
    await expect(summary.getByText(/below 50%/)).toHaveAttribute('role', 'status')
    const evidenceDisclosure = this.#page.locator('.match-evidence-group details')
    await expect(evidenceDisclosure).not.toHaveAttribute('open', '')
    await evidenceDisclosure.locator('summary').click()
    await expect(evidenceDisclosure).toHaveAttribute('open', '')
    await expect(evidenceDisclosure.getByText('Senior FullStack Developer using React at Acme'))
      .toBeVisible()
  }

  async expectAnalysisAndGenerationToRemainAvailable() {
    this.#expectCompletedAction('profile-enrichment-skipped')
    await expect(this.#page.getByText('33%', { exact: true })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Generate Resume Claims' })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Skip this question' })).toHaveCount(0)
  }

  async expectCompletedSourceProfileToRemainIntact() {
    this.#expectCompletedAction('source-profile-reopened')
    await expect(this.#page.getByRole('heading', { name: 'Check your imported profile' })).toBeVisible()
    await expect(this.#page.getByText(
      'Senior FullStack Developer using React at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByRole('button', { name: /Source Profile/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await expect(this.#page.getByRole('button', { name: /Job Posting/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
  }

  async expectMobileProgressToExposeCurrentAndFutureSteps() {
    this.#expectCompletedAction('resume-tailoring-opened')
    const progress = this.#page.locator('.workflow-progress')
    await expect(progress.getByRole('button', { name: /Source Profile/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(progress.getByRole('button', { name: /Job Posting/ })).toBeDisabled()
    await expect(progress.getByRole('button', { name: /Match Analysis/ })).toBeDisabled()
    await expect(progress.getByRole('button', { name: /Tailored Resume/ })).toBeDisabled()
    await this.#expectProgressReadableAtRepresentativeWidths({ progress })
  }

  async expectFrenchProgressToExposeCurrentAndFutureSteps() {
    this.#expectCompletedAction('resume-tailoring-opened')
    const progress = this.#page.locator('.workflow-progress')
    await expect(progress.getByRole('button', { name: /Profil Source/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(progress.getByRole('button', { name: /Offre d'emploi/ })).toBeDisabled()
    await expect(progress.getByRole('button', { name: /Analyse de Correspondance/ })).toBeDisabled()
    await expect(progress.getByRole('button', { name: /CV Adapté/ })).toBeDisabled()
    await this.#expectProgressReadableAtRepresentativeWidths({ progress })
  }

  async expectPartiallyCompletedProgressToStayReadable() {
    this.#expectCompletedAction('source-profile-reopened')
    const progress = this.#page.locator('.workflow-progress')
    await expect(progress.getByRole('button', { name: /Source Profile/ })).toBeEnabled()
    await expect(progress.getByRole('button', { name: /Source Profile/ })).toContainText('1 verified fact')
    await expect(progress.getByRole('button', { name: /Source Profile/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(progress.getByRole('button', { name: /Job Posting/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(progress.getByRole('button', { name: /Match Analysis/ })).toBeDisabled()
    await this.#expectProgressReadableAtRepresentativeWidths({ progress })
  }

  async expectFrenchPartiallyCompletedProgressToStayReadable() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    const progress = this.#page.locator('.workflow-progress')
    await expect(progress.getByRole('button', { name: /Profil Source/ })).toContainText('1 fait vérifié')
    await expect(progress.getByRole('button', { name: /Offre d'emploi/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(progress.getByRole('button', { name: /Analyse de Correspondance/ })).toBeDisabled()
    await this.#expectProgressReadableAtRepresentativeWidths({ progress })
  }

  async expectCompletedProgressToStayReadable() {
    this.#expectCompletedAction('source-profile-reopened')
    const progress = this.#page.locator('.workflow-progress')
    await this.#expectEveryProgressStepEnabled({ progress })
    await expect(progress.getByRole('button', { name: /Tailored Resume/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(progress.getByRole('button', { name: /Source Profile/ })).toHaveAttribute('aria-expanded', 'true')
    await this.#expectEnglishCompletedOutcomeSummaries({ progress })
    await this.#expectProgressReadableAtRepresentativeWidths({ progress })
  }

  async expectFrenchCompletedProgressToStayReadable() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    const progress = this.#page.locator('.workflow-progress')
    await this.#expectEveryProgressStepEnabled({ progress })
    await expect(progress.getByRole('button', { name: /CV Adapté/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    await this.#expectFrenchCompletedOutcomeSummaries({ progress })
    await this.#expectProgressReadableAtRepresentativeWidths({ progress })
  }

  async #expectProgressReadableAtRepresentativeWidths({ progress }: Readonly<{
    progress: Locator
  }>) {
    for (const viewport of progressViewports) {
      await this.#page.setViewportSize(viewport)
      const steps = progress.getByRole('button')
      await expect(steps).toHaveCount(4)
      for (const step of await steps.all()) await expect(step).toBeVisible()
      expect(await progress.locator('.workflow-steps').evaluate((element) =>
        element.scrollWidth === element.clientWidth)).toBe(true)
      if (viewport.width > compactProgressMaximumWidth) continue
      await this.#expectCompactProgressContentFits({ progress })
    }
  }

  async #expectCompactProgressContentFits({ progress }: Readonly<{ progress: Locator }>) {
    expect(await progress.locator('.step-copy').evaluateAll((elements) => elements.every(
      (element) => element.scrollWidth === element.clientWidth
        && element.scrollHeight === element.clientHeight,
    ))).toBe(true)
    expect(await progress.locator('.workflow-step').evaluateAll((steps) => steps.every((step) => {
      const marker = step.querySelector('.step-number')?.getBoundingClientRect()
      const copy = step.querySelector('.step-copy')?.getBoundingClientRect()
      return marker !== undefined && copy !== undefined && marker.right <= copy.left
    }))).toBe(true)
  }

  async #expectEveryProgressStepEnabled({ progress }: Readonly<{ progress: Locator }>) {
    for (const step of await progress.getByRole('button').all()) await expect(step).toBeEnabled()
  }

  async #expectEnglishCompletedOutcomeSummaries({ progress }: Readonly<{ progress: Locator }>) {
    await expect(progress.getByRole('button', { name: /Source Profile/ })).toContainText('1 verified fact')
    await expect(progress.getByRole('button', { name: /Job Posting/ })).toContainText('2 Job Requirements')
    await expect(progress.getByRole('button', { name: /Match Analysis/ })).toContainText('33% Match Score')
    await expect(progress.getByRole('button', { name: /Tailored Resume/ })).toContainText('2 Resume Claims ready')
  }

  async #expectFrenchCompletedOutcomeSummaries({ progress }: Readonly<{ progress: Locator }>) {
    await expect(progress.getByRole('button', { name: /Profil Source/ })).toContainText('1 fait vérifié')
    await expect(progress.getByRole('button', { name: /Offre d'emploi/ }))
      .toContainText("2 Exigences de l'Offre")
    await expect(progress.getByRole('button', { name: /Analyse de Correspondance/ })).toContainText('33% Score de Correspondance')
    await expect(progress.getByRole('button', { name: /CV Adapté/ })).toContainText('2 affirmations du CV prêtes')
  }

  async expectPendingMatchAnalysisThenFocusedResult() {
    this.#expectCompletedAction('match-analysis-inspected')
    await expect(this.#page.getByText('Building your Match Analysis…')).toBeVisible()
    await expect(this.#page.locator('.match-analysis-workspace')).toHaveAttribute('aria-busy', 'true')
    await expect(this.#page.getByRole('button', { name: 'Analyze the match' })).toBeDisabled()
    expect(this.#matchAnalysisRequestCount).toBe(1)
    expect(this.#pendingMatchAnalysisResponse).toBeDefined()
    this.#releasePendingMatchAnalysis()
    await expect(this.#page.getByText('33%', { exact: true })).toBeVisible()
    await expect(this.#page.locator('#match-analysis-summary-title')).toBeFocused()
  }

  async expectLongRunningReassuranceWithoutInventedProgress() {
    this.#expectCompletedAction('match-analysis-waited')
    await expect(this.#page.getByText(
      'Still working. Your content is safe in this browser.',
    )).toBeVisible()
    await expect(this.#page.getByText(/\d+% complete/)).toHaveCount(0)
    expect(this.#pendingMatchAnalysisResponse).toBeDefined()
    this.#releasePendingMatchAnalysis()
  }

  async expectRetryToPreserveProgressAndProduceMatchAnalysis() {
    this.#expectCompletedAction('match-analysis-retried')
    await expect(this.#page.getByRole('button', { name: /Match Analysis/ })).toContainText('33%')
    await expect(this.#page.getByRole('button', { name: /Source Profile/ }))
      .toContainText('1 verified fact')
    await expect(this.#page.getByRole('button', { name: /Job Posting/ }))
      .toContainText('2 Job Requirements')
  }

  async expectValidatedResumeClaimsWithoutFreeEditing() {
    this.#expectCompletedAction('resume-claims-generated')
    await expect(this.#page.getByText(
      'Built React applications at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByText(
      'Worked as a FullStack Developer at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByText(/Claims cannot be edited directly/).first()).toBeVisible()
  }

  async expectPendingResumeClaimGenerationThenFocusedCollection() {
    this.#expectCompletedAction('resume-claims-generated')
    await expect(this.#page.getByText('Drafting your Tailored Resume…')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Generate Resume Claims' })).toBeDisabled()
    expect(this.#resumeClaimWritingRequestCount).toBe(1)
    this.#releasePendingResumeClaimWriting?.()
    await expect(this.#page.getByText('Preparing the exact one-page layout…')).toBeVisible()
    await expect(this.#page.getByText('Built React applications at Acme', { exact: true }))
      .toBeVisible()
    await expect(this.#page.locator('#resume-claims-list-title')).toBeFocused()
  }

  async expectGenerationActionToRemainUnavailableInMatchAnalysis() {
    this.#expectCompletedAction('match-analyzed')
    await expect(this.#page.getByRole('button', { name: 'Generate Resume Claims' })).toHaveCount(0)
  }

  async expectIneligibleTailoredResumeToExplainUnavailableGeneration() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.getByRole('button', { name: 'Generate Resume Claims' })).toHaveCount(0)
    await expect(this.#page.getByText(/not enough verified, relevant material/)).toBeVisible()
  }

  async expectRetriedResumeClaimGenerationToPreserveContext() {
    this.#expectCompletedAction('resume-claims-retried')
    expect(this.#resumeClaimWritingRequestCount).toBe(2)
    await expect(this.#page.getByRole('button', { name: /Source Profile/ }))
      .toContainText('1 verified fact')
    await expect(this.#page.getByRole('button', { name: /Match Analysis/ }))
      .toContainText('33%')
    await expect(this.#page.locator('#resume-claims-list-title')).toBeFocused()
  }

  async expectUnsupportedResumeClaimExclusionToBeClear() {
    this.#expectCompletedAction('resume-claims-excluded')
    await expect(this.#page.getByText(
      'Content that remained unsupported after one isolated rewrite was excluded from your Tailored Resume.',
      { exact: true },
    )).toHaveAttribute('role', 'status')
    await expect(this.#page.getByText(/No supported Resume Claim remains/)).toBeVisible()
    await expect(this.#page.getByText(/strengthened-scope/)).toHaveCount(0)
  }

  async expectTailoredResumeToBeRestored() {
    this.#expectCompletedAction('resume-claims-reloaded')
    await expect(this.#page.getByText(
      'Built React applications at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByText(
      'Worked as a FullStack Developer at Acme',
      { exact: true },
    )).toBeVisible()
  }

  async expectResumeClaimOrderToChange() {
    this.#expectCompletedAction('resume-claim-reordered')
    const claims = this.#readResumeClaims()
    expect(await claims.evaluate((element) => element.tagName)).toBe('OL')
    await expect(claims.getByRole('listitem')).toHaveCount(2)
    await expect(claims.getByRole('listitem').first())
      .toContainText('Worked as a FullStack Developer at Acme')
    await expect(claims.getByRole('button', {
      name: 'Move up — Resume Claim 1',
    })).toBeVisible()
  }

  async expectResumeClaimRemoval() {
    this.#expectCompletedAction('resume-claim-removed')
    const claims = this.#readResumeClaims()
    await expect(claims.getByRole('listitem')).toHaveCount(1)
    await expect(claims.getByText('Worked as a FullStack Developer at Acme', { exact: true }))
      .toBeVisible()
  }

  async expectCompactReformulationControls() {
    this.#expectCompletedAction('resume-claim-reformulation-opened')
    const claims = this.#readResumeClaims()
    await expect(this.#readFirstResumeClaim().getByLabel('Request a wording change')).toBeVisible()
    await expect(claims.getByRole('button', {
      name: 'Remove claim — Resume Claim 1',
    })).toBeVisible()
    await expect(this.#page.getByText(/Claims cannot be edited directly/)).toHaveCount(1)
  }

  async expectPendingReformulationThenFocusedCollection() {
    this.#expectCompletedAction('resume-claim-reformulation-requested')
    const claims = this.#readResumeClaims()
    const firstClaim = this.#readFirstResumeClaim()
    await expect(this.#page.getByText('Reformulating your Resume Claim…')).toBeVisible()
    await expect(firstClaim.locator('.reformulation-form button')).toBeDisabled()
    await expect(firstClaim.getByRole('button', {
      name: 'Move down — Resume Claim 1',
    })).toBeDisabled()
    await expect(firstClaim.getByRole('button', {
      name: 'Remove claim — Resume Claim 1',
    })).toBeDisabled()
    await expect(this.#page.getByRole('navigation', {
      name: 'Tailored Resume curation',
    }).getByRole('link', { name: 'Preview and export' })).toBeEnabled()
    expect(this.#resumeClaimWritingRequestCount).toBe(1)
    this.#releasePendingResumeClaimWriting?.()
    await expect(claims.getByText(
      'Built accessible React applications at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.locator('#resume-claims-list-title')).toBeFocused()
  }

  async expectRetriedReformulationToPreserveContext() {
    this.#expectCompletedAction('resume-claim-reformulation-retried')
    expect(this.#resumeClaimWritingRequestCount).toBe(2)
    expect(this.#resumeClaimReformulationRequests).toEqual([
      'Make the impact clearer',
      'Make the impact clearer',
    ])
    await expect(this.#page.locator('#resume-claims-list-title')).toBeFocused()
  }

  async expectConcurrentFidelityRatingToBeRecorded() {
    this.#expectCompletedAction('resume-fidelity-rated-during-reformulation')
    await expect(this.#page.getByRole('button', { name: 'Faithful' })).toBeEnabled()
    await expect(this.#page.getByText('Reformulating your Resume Claim…')).toBeVisible()
    expect(this.#resumeClaimWritingRequestCount).toBe(1)
    this.#releasePendingResumeClaimWriting?.()
    await expect(this.#page.getByText(
      'Built accessible React applications at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Faithful' })).toBeDisabled()
  }

  async expectContinuousTailoredResumeFlowOnMobile() {
    this.#expectCompletedAction('resume-preview-navigated')
    const flowNavigation = this.#page.getByRole('navigation', {
      name: 'Tailored Resume curation',
    })
    await expect(flowNavigation).toBeVisible()
    await expect(flowNavigation.getByRole('link')).toHaveText([
      'Retained Resume Claims',
      'Preview and export',
      'Photo',
      'Outcome Feedback',
      'PDF export',
    ])
    await expect(this.#page.getByRole('heading', { name: 'PDF export' })).toBeInViewport()
    expect(await this.#page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  }

  async expectPreviewAndPdfToUseTheSameRetainedClaims() {
    this.#expectCompletedAction('resume-pdf-downloaded')
    const preview = this.#page.frameLocator('iframe[title="Tailored Resume one-page preview"]')
    await expect(preview.getByText('Built React applications at Acme')).toBeVisible()
    await expect(preview.getByText('Worked as a FullStack Developer at Acme')).toBeVisible()
    await expect(this.#page.getByText(/After download, this PDF is under your control/))
      .toBeVisible()
    expect(readResumePdfClaimTexts(this.#resumePdfRequest)).toEqual([
      'Built React applications at Acme',
      'Worked as a FullStack Developer at Acme',
    ])
    expect(hasResumePdfPhoto(this.#resumePdfRequest)).toBe(false)
    expect(hasCallerDerivedDocument(this.#resumePdfRequest)).toBe(false)
  }

  expectPrivacySafeMvpOutcomesToBeRecorded() {
    expect(this.#analyticsEvents).toEqual([{
      name: 'resume-fidelity-rated',
      assessment: 'faithful',
      matchScoreBand: '25-49',
    }, {
      name: 'resume-relevance-rated',
      assessment: 'relevant',
      matchScoreBand: '25-49',
    }, {
      name: 'resume-downloaded',
      matchScoreBand: '25-49',
    }])
  }

  async expectTailoredResumeOutcomeFeedbackToRemainRecorded() {
    await expect(this.#page.getByRole('button', { name: 'Faithful' })).toBeDisabled()
    await expect(this.#page.getByRole('button', { name: 'Relevant' })).toBeDisabled()
    expect(this.#analyticsEvents).toHaveLength(2)
  }

  async expectFrenchSensitiveLabelAndIntactJobPosting() {
    this.#expectCompletedAction('job-posting-reviewed')
    await expect(this.#page.getByText('Numéro de téléphone', { exact: true })).toBeVisible()
    await expect(this.#page.getByText('phone', { exact: true })).toHaveCount(0)
    await expect(this.#page.getByLabel(
      "Contenu exact de l'Offre d'emploi envoyé pour l'extraction",
    )).toHaveValue(`${legitimateFrenchJobPosting}\nTéléphone : `)
  }

  #readUnknownRoute() {
    expect(this.#unknownRoute).toBeDefined()
    return this.#unknownRoute ?? '/missing-test-route'
  }

  #expectCompletedAction(expectedAction: CompletedAction) {
    expect(this.#completedAction).toBe(expectedAction)
  }

  #expectCandidateSessionInvalidationAction() {
    expect(
      this.#completedAction !== 'candidate-session-expired'
      && this.#completedAction !== 'candidate-session-synchronized',
    ).toBe(false)
  }

  #readResumeClaims() {
    return this.#page.getByRole('list', { name: 'Retained Resume Claims' })
  }

  #readFirstResumeClaim() {
    return this.#readResumeClaims().getByRole('listitem').first()
  }

  async #fulfillDetailedSourceProfileExtraction({ route }: Readonly<{ route: Route }>) {
    this.#extractionRequestContent = readProfessionalContent(route.request().postData())
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(detailedSourceProfileExtractionResponse),
    })
  }

  #releasePendingMatchAnalysis() {
    this.#pendingMatchAnalysisResponse?.()
  }

  #releasePendingSourceProfileExtraction() {
    this.#pendingSourceProfileExtractionResponse?.()
  }

  #releasePendingJobRequirementExtraction() {
    this.#pendingJobRequirementExtractionResponse?.()
  }

  async #uploadSourceDocument() {
    await this.#page.locator('#source-document-pdf').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: createTextPdf(
        'bakate@example.com Senior FullStack Developer using React at Acme',
      ),
    })
    await this.#page.getByLabel('Exact content that will be sent for extraction').waitFor()
  }
}

function createMatchAnalysisResponse({ requestBody }: Readonly<{ requestBody: string | null }>) {
  const matchRequest = readMatchRequest(requestBody)
  const preferredRequirement = matchRequest?.requirements.find(
    (requirement) => requirement.classification === 'preferred',
  )
  const [verifiedFact] = matchRequest?.verifiedFacts ?? []
  return {
    ok: true,
    value: {
      evidence: createPreferredMatchEvidence({ preferredRequirement, verifiedFact }),
      improvementOpportunities: [],
      relevantFactIds: verifiedFact === undefined ? [] : [verifiedFact.id],
    },
  }
}

function createPreferredMatchEvidence({ preferredRequirement, verifiedFact }: Readonly<{
  preferredRequirement: NonNullable<ReturnType<typeof readMatchRequest>>['requirements'][number]
    | undefined
  verifiedFact: NonNullable<ReturnType<typeof readMatchRequest>>['verifiedFacts'][number] | undefined
}>) {
  if (preferredRequirement === undefined || verifiedFact === undefined) return []
  return [{
    coverage: 'covered' as const,
    requirementId: preferredRequirement.id,
    factMatches: [{
      factId: verifiedFact.id,
      factTerm: 'React',
      relationship: 'exact',
      requirementTerm: 'React',
    }],
  }]
}

const lateResponseSession = {
  status: 'ready',
  sessionId: 'candidate-session-late-response',
  expiresAt: Date.now() + 60_000,
} as const

const inactiveSessionResult = {
  ok: false,
  error: { type: 'candidate-session-inactive' },
} as const

const inactiveSessionOutcome = {
  update: inactiveSessionResult,
  current: { ok: true, value: { status: 'not-started' } },
} as const

const legitimateFrenchJobPosting = "ASTORM bénéficie d'un référencement auprès de clients."
const pastedProfessionalText = 'Senior FullStack Developer using TypeScript and React at Acme'

async function seedCandidateSession({ page, expiresAt }: Readonly<{ page: Page; expiresAt: number }>) {
  await installCandidateSessionTestPersistence(page)
  await page.evaluate(async ({ expirationTimestamp, sessionId }) => {
    const persistence = window.readInstalledPersistence()
    await persistence.create({ status: 'ready', sessionId, expiresAt: expirationTimestamp })
  }, { expirationTimestamp: expiresAt, sessionId: lateResponseSession.sessionId })
}

async function eraseCandidateSession(page: Page) {
  await installCandidateSessionTestPersistence(page)
  await page.evaluate(async (sessionId) => {
    await window.readInstalledPersistence().erase({ sessionId })
  }, lateResponseSession.sessionId)
}

async function updateCandidateSession(page: Page, state: typeof lateResponseSession) {
  await installCandidateSessionTestPersistence(page)
  return page.evaluate(async (session) => {
    const persistence = window.readInstalledPersistence()
    const update = await persistence.update({ sessionId: session.sessionId, state: session })
    return { update, current: await persistence.read() }
  }, state)
}

async function extendCandidateSessionExpiration(page: Page) {
  await installCandidateSessionTestPersistence(page)
  return page.evaluate(async (session) => {
    const persistence = window.readInstalledPersistence()
    const update = await persistence.update({
      sessionId: session.sessionId,
      state: { ...session, expiresAt: session.expiresAt + 60_000 },
    })
    const current = await persistence.read()
    return {
      update,
      currentExpiresAt: current.ok && current.value.status === 'ready'
        ? current.value.expiresAt
        : null,
    }
  }, lateResponseSession)
}

async function readBrowserStorage(page: Page) {
  await installCandidateSessionTestPersistence(page)
  const storedState = await page.evaluate(async () => window.readInstalledPersistence().read())
  expect(storedState.ok).toBe(true)
  if (!storedState.ok) return unavailableBrowserStorage
  expect(storedState.value.status).toBe('ready')
  if (storedState.value.status !== 'ready') return unavailableBrowserStorage

  return {
    localStorageLength: await page.evaluate(() => localStorage.length),
    remainingLifetime: storedState.value.expiresAt - Date.now(),
    sessionId: storedState.value.sessionId,
  }
}

const unavailableBrowserStorage = {
  localStorageLength: -1,
  remainingLifetime: -1,
  sessionId: 'candidate-session-unavailable',
} as const

async function installCandidateSessionTestPersistence(page: Page) {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { createBrowserCandidateSessionPersistence } from '/src/resume-tailoring/browser-adapters.ts'
      window.candidateSessionTestPersistence = createBrowserCandidateSessionPersistence()
      window.readInstalledPersistence = () => window.candidateSessionTestPersistence
    `,
  })
  await page.waitForFunction(() => window.candidateSessionTestPersistence !== undefined)
}

async function waitForStartTailoringToBeEnabled(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('.primary-action')
    return button?.disabled === false
  })
}

function readProfessionalContent(requestBody: string | null) {
  if (requestBody === null) return undefined
  const value = JSON.parse(requestBody) as unknown
  return isRecord(value) && typeof value.professionalContent === 'string'
    ? value.professionalContent
    : undefined
}

function readFactCard({ group, page, value }: Readonly<{
  group: Locator
  page: Page
  value: string
}>) {
  return group.locator('.source-fact').filter({
    has: page.getByText(value, { exact: true }),
  })
}

function readJobPostingContent(requestBody: string | null) {
  if (requestBody === null) return undefined
  const value = JSON.parse(requestBody) as unknown
  return isRecord(value) && typeof value.jobPostingContent === 'string'
    ? value.jobPostingContent
    : undefined
}

function readMatchRequest(requestBody: string | null) {
  if (requestBody === null) return undefined
  const value = JSON.parse(requestBody) as unknown
  const result = matchAnalysisRequestSchema.safeParse(value)
  return result.success ? result.data : undefined
}

function readResumePdfClaimTexts(value: unknown) {
  if (!isRecord(value) || !isRecord(value.source) || !Array.isArray(value.source.claims)) {
    return []
  }
  return value.source.claims.flatMap((claim) => {
    if (!isRecord(claim) || !Array.isArray(claim.segments)) return []
    return claim.segments.flatMap((segment) =>
      isRecord(segment) && typeof segment.text === 'string' ? [segment.text] : [])
  })
}

function hasResumePdfPhoto(value: unknown) {
  return isRecord(value) && 'photoDataUrl' in value
}

function hasCallerDerivedDocument(value: unknown) {
  return isRecord(value) && 'document' in value
}

const jobPostingExcerpt = 'Role: Senior React Developer. You must know TypeScript and preferably React.'
const detailedSourceProfileExtractionResponse = {
  ok: true,
  value: [
    {
      assessment: 'usable',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-role',
      value: 'Senior FullStack Developer at Acme',
    },
    {
      assessment: 'usable',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-backend',
      value: 'Built backend APIs at Acme',
    },
    {
      assessment: 'usable',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-migration',
      value: 'Led a platform migration at Acme',
    },
    {
      assessment: 'usable',
      kind: 'skill',
      propositionKey: 'proposition-skill-typescript',
      value: 'TypeScript',
    },
    {
      assessment: 'usable',
      kind: 'education',
      propositionKey: 'proposition-education-computer-science-year',
      value: 'Computer Science degree in 2018',
    },
    {
      assessment: 'usable',
      kind: 'education',
      propositionKey: 'proposition-education-computer-science-year',
      value: 'Computer Science degree in 2019',
    },
  ],
} as const
const jobRequirementExtractionResponse = {
  ok: true,
  value: {
    targetRole: null,
    practicalConstraints: [],
    requirements: [
      {
        classification: 'required',
        sourceExcerpt: jobPostingExcerpt,
        value: 'TypeScript',
      },
      {
        classification: 'preferred',
        sourceExcerpt: jobPostingExcerpt,
        value: 'React',
      },
    ],
  },
} as const

function createTextPdf(text: string) {
  const escapedText = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
  const content = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`
  const document = appendPdfObjects({ objects: createPdfObjects({ content }) })
  const crossReferenceOffset = Buffer.byteLength(document.pdf, 'ascii')
  const entries = document.offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  const trailer = `xref\n0 6\n0000000000 65535 f \n${entries}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(crossReferenceOffset)}\n%%EOF`
  return Buffer.from(`${document.pdf}${trailer}`, 'ascii')
}

function createPdfObjects({ content }: Readonly<{ content: string }>) {
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
}

function appendPdfObjects({ objects }: Readonly<{ objects: readonly string[] }>) {
  return objects.reduce((document, object, objectIndex) => ({
    offsets: [...document.offsets, Buffer.byteLength(document.pdf, 'ascii')],
    pdf: `${document.pdf}${String(objectIndex + 1)} 0 obj\n${object}\nendobj\n`,
  }), { offsets: [] as readonly number[], pdf: '%PDF-1.4\n' })
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}
