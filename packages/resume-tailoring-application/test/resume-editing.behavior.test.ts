import { createTailoredResume } from '@resume-tailoring/application/tailored-resume'
import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyDependencies, CandidateJourneyView, CandidateSession, ResumeDocumentPorts, ResumeProposalDecision, ResumeLayoutOutcome, ResumeExportEligibility } from '@resume-tailoring/application/candidate-journey'
import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import { resumeLayoutExpectations, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'

type TestPorts = { -readonly [Port in keyof ResumeDocumentPorts]?: ResumeDocumentPorts[Port] }
type LayoutExample = Readonly<{ layout: ResumeLayoutOutcome; eligibility: ResumeExportEligibility }>

describe('Candidate Journey resume editing', () => {
  it('keeps only the unsupported field unresolved when a section validation accepts the other edited field', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPartiallySupportedExperienceValidation()

    await system.replaceTwoExperienceFields()

    system.expectOnlyUnsupportedExperienceFieldUnresolved()
  })

  it('restores a corrected employer field while its experience is hidden without losing the correction', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.givenCorrectedEmployerAndExperienceHidden()

    system.restoreEmployer()

    system.expectCorrectedEmployerRecovered()
  })
  it('restores newly attested professional evidence by its fact identity after regeneration', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.givenNewEvidenceAttestedBeforeRegeneration()

    system.restoreAttestedEvidence()

    system.expectAttestedEvidenceRecovered()
  })
  it.each(['revision', 'replacement'] as const)('keeps an edit unresolved when validation endorses another %s', async (mismatch) => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenMismatchedValidation({ mismatch })

    await system.editUnsupportedSummary()

    system.expectUnsupportedSummaryBlocksExport()
  })

  it('validates only the edited section while preserving unrelated resume content', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenSupportedValidation()

    await system.editSupportedSummary()

    system.expectSupportedSummaryWithUnchangedExperience()
  })
  it('creates attested Candidate evidence only after explicit confirmation of an unsupported edit', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.editUnsupportedSummary()

    system.attestSummary()

    system.expectNewAttestedEvidence()
  })
  it('recovers hidden content and its unresolved status after reopening', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.editUnsupportedSummary()
    system.givenSummaryHidden()

    await system.reopenCandidateSession()

    system.expectRecoveredHiddenUnsupportedSummary()
  })
  it('replaces the current draft only when its separate proposal is accepted', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.proposeCondensation()

    system.acceptProposal()

    system.expectAcceptedProposal()
  })
  it('keeps the current draft when its separate proposal is rejected', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.proposeCondensation()

    system.rejectProposal()

    system.expectOriginalDraftWithoutProposal()
  })
  it.each(['unavailable', 'unsupported-content'] as const)('preserves the draft after %s condensation failure', async (reason) => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenCondensationFailure({ reason })

    await system.proposeCondensation()

    system.expectCondensationFailure({ reason })
  })
  it('rejects a proposal decision after contact changes invalidate its revision', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.proposeCondensation()
    system.givenChangedContacts()

    system.acceptProposal()

    system.expectStaleProposalRejected()
  })
  it('ignores a pending condensation response when newer content has been saved', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPendingCondensation()
    await system.editUnsupportedSummary()

    await system.completePendingCondensation()

    system.expectNewerDraftWithoutProposal()
  })
  it.each(resumeLayoutExpectations)('uses the shared $layout.status page assessment for export eligibility', async ({ layout, eligibility }) => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenLayout({ layout, eligibility })

    await system.assessLayout()

    system.expectLayout({ layout, eligibility })
  })
  it('ignores a pending layout measurement after a contact correction', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPendingLayout()
    system.givenChangedContacts()

    await system.completePendingLayout()

    system.expectUnmeasuredCurrentDraft()
  })
  it('ignores pending layout when combined intake inputs change', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPendingLayout()
    system.givenChangedIntakeInputs()

    await system.completePendingLayout()

    system.expectUnmeasuredCurrentDraft()
  })
  it('blocks export of an outdated draft even when its measured layout fits', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenChangedIntakeInputs()
    system.givenOnePageLayout()

    await system.assessLayout()

    system.expectUnmeasuredCurrentDraft()
  })
  it('keeps pending section validation unresolved after intake changes', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPendingSupportedEdit()
    system.givenChangedIntakeInputs()

    await system.completePendingValidation()

    system.expectPendingEditRemainsUnresolved()
  })
  it('blocks export without contacts even when the measured document fits', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenMissingContacts()
    system.givenOnePageLayout()

    await system.assessLayout()

    system.expectMissingContactsBlockExport()
  })
  it('retains restored content and source evidence when the new layout overflows', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenRecoveredSourceAchievement()
    system.givenLayout(resumeLayoutExpectations[2])

    await system.assessLayout()

    system.expectRestorationSurvivesOverflow()
  })
  it('does not clear a newer unsupported edit when older validation finishes late', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPendingSupportedEdit()
    system.givenValidationUnavailable()
    await system.editUnsupportedSummary()

    await system.completePendingValidation()

    system.expectUnsupportedSummaryBlocksExport()
  })
  it('restores a hidden experience with all its evidence and leaves the Source Profile intact', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenHiddenExperience()

    system.restoreExperience()

    system.expectRestoredExperience()
  })

  it('previews a separate condensation proposal without replacing the current draft', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()
    await system.prepareTailoredResume()
    await system.givenProcessingConsent()

    await system.proposeCondensation()

    system.expectSeparateProposal()
  })
  it('restores a hidden unsupported field without losing its unresolved status', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()
    await system.prepareTailoredResume()
    await system.editUnsupportedSummary()
    system.givenSummaryHidden()

    system.restoreSummary()

    system.expectUnsupportedSummaryBlocksExport()
  })
  it('keeps an unsupported edit unresolved in the current draft and blocks export', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()
    await system.prepareTailoredResume()

    await system.editUnsupportedSummary()

    system.expectUnsupportedSummaryBlocksExport()
  })
  it('recovers locally edited contacts after reopening the Candidate Session', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()
    await system.prepareTailoredResume()

    await system.correctContactAndReopen()

    system.expectCorrectedContactRecovered()
  })
})

function createSystemUnderTest() {
  return new StructuredResumeTestSystem()
}

class StructuredResumeTestSystem {
  readonly #ports: TestPorts = {}
  readonly #dependencies = createDependencies({ ports: this.#ports })
  #decision: ResumeProposalDecision = { proposalId: '', baseRevision: '' }
  #validationRequests: Parameters<ResumeDocumentPorts['validateSectionChange']>[0][] = []
  #completeProposal: (() => void) | null = null
  #pendingProposal: Promise<void> | null = null
  #completeLayout: (() => void) | null = null
  #pendingLayout: Promise<void> | null = null
  #completeValidation: (() => void) | null = null
  #pendingValidation: Promise<void> | null = null
  #attestedFactId: CandidateFact['id'] = 'source-fact-not-attested'
  #journey = createCandidateJourney({ dependencies: this.#dependencies })
  #outcome: CandidateJourneyView | null = null

  async givenMatchedCandidateSession() {
    this.#journey.start()
    await this.#expectOpenCandidateSession()
  }

  async prepareTailoredResume() {
    await this.givenProcessingConsent()
    this.#journey.startTailoredResumePreparation()
    await this.#expectTailoredResumePrepared()
    this.#outcome = this.#journey.readView()
  }

  async givenProcessingConsent() {
    this.#journey.grantProcessingConsent()
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.processingConsentStatus : null
    }).toBe('granted')
  }

  async proposeCondensation() {
    await this.#journey.proposeResumeCondensation()
    this.#outcome = this.#journey.readView()
    const proposal = this.#outcome.status === 'candidate-session-open' ? this.#outcome.resumeReview?.proposal : null
    if (proposal != null) this.#decision = { proposalId: proposal.id, baseRevision: proposal.baseRevision }
  }

  expectSeparateProposal() {
    const view = this.#outcome
    expect(view?.status, 'Expected a condensation outcome').toBe('candidate-session-open')
    if (view?.status !== 'candidate-session-open') return
    expect(view.resumeReview?.proposal?.document.valueProposition.paragraphs[0]?.text).toBe('Accessible billing screens')
    expect(view.resumeReview?.draft.document.valueProposition.paragraphs[0]?.text).toBe('Built accessible billing screens')
  }

  #summaryId = ''

  givenSummaryHidden() {
    const view = this.#journey.readView()
    this.#summaryId = view.status === 'candidate-session-open'
      ? view.session.tailoredResume?.valueProposition.paragraphs[0]?.id ?? '' : ''
    this.#journey.hideResumeField({ fieldId: this.#summaryId })
  }

  restoreSummary() {
    this.#journey.restoreResumeField({ fieldId: this.#summaryId })
    this.#outcome = this.#journey.readView()
  }

  async editUnsupportedSummary() {
    const view = this.#journey.readView()
    const field = view.status === 'candidate-session-open'
      ? view.session.tailoredResume?.valueProposition.paragraphs[0] : undefined
    expect(field, 'Expected prepared summary').toBeDefined()
    await this.#journey.editResumeField({ fieldId: field?.id ?? '', text: 'Led 100 engineers' })
    this.#outcome = this.#journey.readView()
  }

  expectUnsupportedSummaryBlocksExport() {
    const session = this.#expectPreparedSession()
    expect(session?.tailoredResume?.valueProposition.paragraphs.map(({ text }) => text)).toContain('Led 100 engineers')
    expect(session?.resumeEditing?.unsupportedFieldIds).toHaveLength(1)
    const view = this.#outcome
    const eligibility = view?.status === 'candidate-session-open' ? view.resumeReview?.assessment?.exportEligibility : null
    expect(eligibility?.status).toBe('blocked')
    expect(eligibility?.status === 'blocked' ? eligibility.reasons : []).toContain('unsupported-content')
  }

  async correctContactAndReopen() {
    this.#journey.updateResumeContacts({ identity: { kind: 'personal-information', value: 'Alex Morgan' },
      contactDetails: [{ kind: 'email', value: 'corrected@example.com' }] })
    this.#journey = createCandidateJourney({ dependencies: this.#dependencies })
    this.#journey.start()
    await this.#expectOpenCandidateSession()
    this.#outcome = this.#journey.readView()
  }

  expectCorrectedContactRecovered() {
    expect(this.#expectPreparedSession()?.tailoredResume?.contactDetails)
      .toEqual([{ kind: 'email', value: 'corrected@example.com' }])
  }

  async #expectOpenCandidateSession() {
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async #expectTailoredResumePrepared() {
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.session.tailoredResume : null
    }).not.toBeNull()
  }

  #expectPreparedSession() {
    expect(this.#outcome?.status, 'Expected preparation before reading the document')
      .toBe('candidate-session-open')
    return this.#outcome?.status === 'candidate-session-open' ? this.#outcome.session : null
  }


  async givenReviewableResume() {
    await this.givenMatchedCandidateSession()
    await this.prepareTailoredResume()
    this.#journey.updateResumeContacts({ identity: { kind: 'personal-information', value: 'Alex Morgan' },
      contactDetails: [{ kind: 'email', value: 'alex@example.com' }] })
    await this.givenProcessingConsent()
  }

  givenSupportedValidation() {
    this.#ports.validateSectionChange = (request) => {
      this.#validationRequests.push(request)
      return Promise.resolve({ status: 'validated', change: request.change })
    }
  }

  async editSupportedSummary() {
    await this.#journey.editResumeField({ fieldId: this.#readSummaryId(), text: 'Created accessible billing screens' })
    this.#outcome = this.#journey.readView()
  }

  expectSupportedSummaryWithUnchangedExperience() {
    expect(this.#expectPreparedSession()?.tailoredResume?.valueProposition.paragraphs[0]?.text)
      .toBe('Created accessible billing screens')
    expect(this.#expectPreparedSession()?.resumeEditing?.unsupportedFieldIds).toEqual([])
    expect(this.#validationRequests).toHaveLength(1)
    expect(this.#validationRequests[0]?.change.section).toBe('value-proposition')
    expect(this.#validationRequests[0]?.currentDocument).not.toHaveProperty('contactDetails')
    expect(this.#expectPreparedSession()?.tailoredResume?.experiences[0]?.achievements[0]?.text)
      .toBe('Built accessible billing screens')
  }

  #readSummaryId() {
    const view = this.#journey.readView()
    return view.status === 'candidate-session-open' ? view.session.tailoredResume?.valueProposition.paragraphs[0]?.id ?? '' : ''
  }

  attestSummary() {
    this.#journey.attestResumeField({ fieldId: this.#readSummaryId() })
    this.#outcome = this.#journey.readView()
  }

  expectNewAttestedEvidence() {
    const session = this.#expectPreparedSession()
    const field = session?.tailoredResume?.valueProposition.paragraphs[0]
    expect(session?.resumeEditing?.unsupportedFieldIds).toEqual([])
    expect(session?.sourceIntake?.candidateFacts).toHaveLength(structuredResumeSource.candidateFacts.length + 1)
    expect(session?.sourceIntake?.candidateFacts.find(({ id }) => id === field?.factIds[0]))
      .toMatchObject({ status: 'attested', value: 'Led 100 engineers' })
  }

  async reopenCandidateSession() {
    this.#journey = createCandidateJourney({ dependencies: this.#dependencies })
    this.#journey.start()
    await this.#expectOpenCandidateSession()
    this.#outcome = this.#journey.readView()
  }

  expectRecoveredHiddenUnsupportedSummary() {
    const session = this.#expectPreparedSession()
    expect(session?.resumeEditing?.hiddenFields).toMatchObject([{ field: { id: this.#summaryId, text: 'Led 100 engineers' } }])
    expect(session?.resumeEditing?.unsupportedFieldIds).toContain(this.#summaryId)
    expect(session?.tailoredResume?.valueProposition.paragraphs.some(({ id }) => id === this.#summaryId)).toBe(false)
  }

  acceptProposal() {
    this.#journey.acceptResumeCondensation(this.#decision)
    this.#outcome = this.#journey.readView()
  }

  rejectProposal() {
    this.#journey.rejectResumeCondensation(this.#decision)
    this.#outcome = this.#journey.readView()
  }

  expectAcceptedProposal() {
    expect(this.#expectPreparedSession()?.tailoredResume?.valueProposition.paragraphs[0]?.text).toBe('Accessible billing screens')
    expect(this.#review()?.proposal).toBeNull()
    expect(this.#review()?.draft.revision).not.toBe(this.#decision.baseRevision)
    expect(this.#expectPreparedSession()?.sourceIntake).toEqual(structuredResumeSource)
  }

  expectOriginalDraftWithoutProposal() {
    expect(this.#expectPreparedSession()?.tailoredResume?.valueProposition.paragraphs[0]?.text).toBe('Built accessible billing screens')
    expect(this.#review()?.proposal).toBeNull()
  }

  givenCondensationFailure({ reason }: Readonly<{ reason: 'unavailable' | 'unsupported-content' }>) {
    this.#ports.proposeCondensation = () => Promise.resolve({ status: 'failed', reason,
      recovery: reason === 'unavailable' ? 'retry' : 'correct-content' })
  }

  expectCondensationFailure({ reason }: Readonly<{ reason: 'unavailable' | 'unsupported-content' }>) {
    this.expectOriginalDraftWithoutProposal()
    expect(this.#review()?.failure?.reason).toBe(reason)
  }

  givenChangedIntakeInputs() { this.#journey.invalidateResumeInputs() }

  expectPendingEditRemainsUnresolved() {
    expect(this.#expectPreparedSession()?.resumeEditing?.unsupportedFieldIds).toHaveLength(1)
    expect(this.#review()?.assessment?.exportEligibility.status).toBe('blocked')
  }

  givenChangedContacts() {
    this.#journey.updateResumeContacts({ identity: { kind: 'personal-information', value: 'Alex Morgan' },
      contactDetails: [{ kind: 'email', value: 'new@example.com' }] })
  }

  expectStaleProposalRejected() {
    this.expectOriginalDraftWithoutProposal()
    expect(this.#review()?.failure?.reason).toBe('stale-result')
    expect(this.#expectPreparedSession()?.tailoredResume?.contactDetails).toEqual([{ kind: 'email', value: 'new@example.com' }])
  }

  givenPendingCondensation() {
    this.#ports.proposeCondensation = (request) => new Promise((resolve) => {
      this.#completeProposal = () => { resolve({ status: 'proposed', proposal: { id: 'pending-proposal',
        baseRevision: request.baseRevision, document: request.document,
        layout: { status: 'unavailable', revision: request.baseRevision } } }) }
    })
    this.#pendingProposal = this.#journey.proposeResumeCondensation()
  }

  async completePendingCondensation() {
    this.#completeProposal?.()
    await this.#pendingProposal
    this.#outcome = this.#journey.readView()
  }

  expectNewerDraftWithoutProposal() {
    this.expectUnsupportedSummaryBlocksExport()
    expect(this.#review()?.proposal).toBeNull()
  }

  #review() { return this.#outcome?.status === 'candidate-session-open' ? this.#outcome.resumeReview : null }

  givenLayout({ layout, eligibility }: LayoutExample) {
    this.#ports.assessLayout = ({ draft }) => Promise.resolve({ layout: { ...layout, revision: draft.revision },
      exportEligibility: { ...eligibility, revision: draft.revision } })
  }

  givenOnePageLayout() { this.givenLayout(resumeLayoutExpectations[0]) }

  async assessLayout() {
    await this.#journey.assessResumeLayout()
    this.#outcome = this.#journey.readView()
  }

  expectLayout({ layout, eligibility }: LayoutExample) {
    const revision = this.#review()?.draft.revision
    expect(this.#review()?.assessment).toEqual({ layout: { ...layout, revision },
      exportEligibility: { ...eligibility, revision } })
  }

  givenPendingLayout() {
    this.#ports.assessLayout = ({ draft }) => new Promise((resolve) => {
      this.#completeLayout = () => { resolve({ layout: { status: 'fits', pageCount: 1, revision: draft.revision },
        exportEligibility: { status: 'eligible', pageCount: 1, revision: draft.revision } }) }
    })
    this.#pendingLayout = this.#journey.assessResumeLayout()
  }

  async completePendingLayout() {
    this.#completeLayout?.()
    await this.#pendingLayout
    this.#outcome = this.#journey.readView()
  }

  expectUnmeasuredCurrentDraft() {
    expect(this.#review()?.assessment?.layout.status).toBe('unavailable')
    expect(this.#review()?.assessment?.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['layout-unavailable'] })
  }

  givenMissingContacts() { this.#journey.updateResumeContacts({ identity: null, contactDetails: [] }) }

  expectMissingContactsBlockExport() {
    expect(this.#review()?.assessment?.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['missing-identity', 'missing-contact'] })
  }

  givenRecoveredSourceAchievement() {
    this.#journey.hideResumeField({ fieldId: 'source-fact-experiences-0-achievements-0' })
    this.#journey.restoreSourceFact({ factId: 'source-fact-experiences-0-achievements-0' })
  }

  expectRestorationSurvivesOverflow() {
    expect(this.#review()?.assessment?.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['overflow'] })
    expect(this.#expectPreparedSession()?.tailoredResume?.experiences[0]?.achievements)
      .toMatchObject([{ text: 'Built accessible billing screens', factIds: ['source-fact-experiences-0-achievements-0'] }])
    expect(this.#expectPreparedSession()?.sourceIntake).toEqual(structuredResumeSource)
    expect(this.#expectPreparedSession()?.resumeEditing?.hiddenFields).toEqual([])
  }

  givenPendingSupportedEdit() {
    this.#ports.validateSectionChange = ({ change }) => new Promise((resolve) => {
      this.#completeValidation = () => { resolve({ status: 'validated', change }) }
    })
    this.#pendingValidation = this.#journey.editResumeField({ fieldId: this.#readSummaryId(), text: 'Created accessible billing screens' })
  }

  givenValidationUnavailable() {
    this.#ports.validateSectionChange = () => Promise.resolve({ status: 'failed', reason: 'unavailable', recovery: 'retry' })
  }

  async completePendingValidation() {
    this.#completeValidation?.()
    await this.#pendingValidation
    this.#outcome = this.#journey.readView()
  }

  async givenCorrectedEmployerAndExperienceHidden() {
    await this.#journey.editResumeField({ fieldId: 'source-fact-experiences-0-organization-0', text: 'Corrected Northwind' })
    this.#journey.hideResumeField({ fieldId: 'source-fact-experiences-0-organization-0' })
    this.#journey.hideResumeEntry({ experienceId: 'experiences.0' })
  }

  restoreEmployer() {
    this.#journey.restoreResumeField({ fieldId: 'source-fact-experiences-0-organization-0' })
    this.#outcome = this.#journey.readView()
  }

  expectCorrectedEmployerRecovered() {
    const session = this.#expectPreparedSession()
    const experience = session?.tailoredResume?.experiences.find(({ id }) => id === 'experiences.0')
    expect(experience?.organization?.text).toBe('Corrected Northwind')
    expect(session?.resumeEditing?.hiddenFields).toEqual([])
    expect(session?.resumeEditing?.unsupportedFieldIds).toContain('source-fact-experiences-0-organization-0')
    expect(session?.sourceIntake).toEqual(structuredResumeSource)
  }

  async givenNewEvidenceAttestedBeforeRegeneration() {
    const fieldId = 'source-fact-experiences-0-achievements-0'
    await this.#journey.editResumeField({ fieldId, text: 'Led 100 engineers' })
    this.#journey.attestResumeField({ fieldId })
    const view = this.#journey.readView()
    const facts = view.status === 'candidate-session-open' ? view.session.sourceIntake?.candidateFacts : []
    this.#attestedFactId = facts?.find(({ value }) => value === 'Led 100 engineers')?.id ?? 'source-fact-not-attested'
    this.#journey.startTailoredResumePreparation()
    await expect.poll(() => {
      const current = this.#journey.readView()
      return current.status === 'candidate-session-open' ? current.operation : null
    }).toBe(null)
  }

  restoreAttestedEvidence() {
    this.#journey.restoreSourceFact({ factId: this.#attestedFactId })
    this.#outcome = this.#journey.readView()
  }

  expectAttestedEvidenceRecovered() {
    const session = this.#expectPreparedSession()
    const achievements = session?.tailoredResume?.experiences.flatMap(({ achievements }) => achievements)
    expect(achievements?.find(({ factIds }) => factIds.includes(this.#attestedFactId)))
      .toMatchObject({ text: 'Led 100 engineers', factIds: [this.#attestedFactId] })
    expect(session?.sourceIntake?.candidateFacts.find(({ id }) => id === this.#attestedFactId))
      .toMatchObject({ status: 'attested', value: 'Led 100 engineers' })
  }

  givenMismatchedValidation({ mismatch }: Readonly<{ mismatch: 'revision' | 'replacement' }>) {
    this.#ports.validateSectionChange = ({ change }) => Promise.resolve({ status: 'validated', change: mismatch === 'revision'
      ? { ...change, baseRevision: 'older-draft' }
      : { baseRevision: change.baseRevision, section: 'value-proposition',
        replacement: { kind: 'prose', paragraphs: [] } } })
  }

  givenPartiallySupportedExperienceValidation() {
    this.#ports.validateSectionChange = ({ change }) => Promise.resolve({ status: 'unsupported',
      baseRevision: change.baseRevision, fieldIds: ['source-fact-experiences-0-role-0'] })
  }

  async replaceTwoExperienceFields() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open' || view.resumeReview == null) return
    const replacement = view.resumeReview.draft.document.experiences.map((experience) => experience.id === 'experiences.0'
      ? { ...experience, role: experience.role === null ? null : { ...experience.role, text: 'Chief Technology Officer' },
        organization: experience.organization === null ? null : { ...experience.organization, text: 'Northwind Ltd' } }
      : experience)
    await this.#journey.applyValidatedSectionChange({ section: 'experiences', replacement,
      baseRevision: view.resumeReview.draft.revision })
    this.#outcome = this.#journey.readView()
  }

  expectOnlyUnsupportedExperienceFieldUnresolved() {
    expect(this.#expectPreparedSession()?.resumeEditing?.unsupportedFieldIds)
      .toEqual(['source-fact-experiences-0-role-0'])
    expect(this.#expectPreparedSession()?.tailoredResume?.experiences[0])
      .toMatchObject({ role: { text: 'Chief Technology Officer' }, organization: { text: 'Northwind Ltd' } })
  }

  givenHiddenExperience() { this.#journey.hideResumeEntry({ experienceId: 'experiences.0' }) }

  restoreExperience() {
    this.#journey.restoreResumeEntry({ experienceId: 'experiences.0' })
    this.#outcome = this.#journey.readView()
  }

  expectRestoredExperience() {
    expect(this.#expectPreparedSession()?.tailoredResume?.experiences.find(({ id }) => id === 'experiences.0'))
      .toMatchObject({ role: { text: 'Frontend Engineer' }, organization: { text: 'Northwind' },
        achievements: [{ text: 'Built accessible billing screens' }] })
    expect(this.#expectPreparedSession()?.sourceIntake).toEqual(structuredResumeSource)
    expect(this.#expectPreparedSession()?.resumeEditing?.hiddenExperiences).toEqual([])
  }

}

function createMatchedSession(): CandidateSession {
  const startedAt = Date.now()
  return {
    expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000056',
    jobMatch: structuredResumeJobMatch, phase: 'job-match', processingConsent: null,
    sourceIntake: structuredResumeSource, tailoredResume: null,
  }
}

function createDependencies({ ports }: Readonly<{ ports: Partial<ResumeDocumentPorts> }>): CandidateJourneyDependencies {
  let session = createMatchedSession()
  return {
    resumeDocumentPorts: Object.assign(ports, {
      prepare: ({ candidateFacts, jobMatch, locale, revision }) => Promise.resolve({ status: 'prepared', revision,
        document: createTailoredResume({ jobMatch, locale, sourceIntake: { ...structuredResumeSource, candidateFacts } }) }),
      proposeCondensation: ({ document, baseRevision }) => Promise.resolve({ status: 'proposed', proposal: {
        id: 'proposal-one', baseRevision, layout: { status: 'unavailable', revision: baseRevision },
        document: { ...document, valueProposition: { ...document.valueProposition, paragraphs:
          document.valueProposition.paragraphs.map((field, index) => index === 0
            ? { ...field, text: 'Accessible billing screens' } : field) } },
      } }),
    } satisfies Partial<ResumeDocumentPorts>),
    createSessionId: () => 'unused', now: () => session.startedAt,
    languageModelGateway: { processingPolicy: { provider: 'Test', purposes: [], retentionPolicy: 'None',
      storageBehavior: 'Browser-local', transmittedDataCategories: [], version: 'test' } },
    persistence: { delete: () => ({ ok: true, value: null }),
      restore: () => ({ ok: true, value: { notice: null, session } }),
      save: ({ session: nextSession }) => { session = nextSession; return { ok: true, value: nextSession } } },
    jobPostingDocumentReader: { read: () => Promise.resolve({ ok: true, value: { text: '' } }) },
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: false, error: 'job-posting-extraction-unavailable' }) },
    matchEvidenceMatcher: { match: () => Promise.resolve({ ok: false, error: 'match-evidence-unavailable' }) },
    sourceDocumentReader: { read: () => Promise.resolve({ ok: true, value: { pageCount: null, text: '' } }) },
    sourceProfileExtractor: { extract: () => Promise.resolve({ ok: false, error: 'source-profile-extraction-unavailable' }) },
  }
}
