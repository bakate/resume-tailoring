import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyView, CandidateSession, ResumeProposalDecision, ResumeLayoutOutcome, ResumeExportEligibility } from '@resume-tailoring/application/candidate-journey'
import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import { resumeLayoutExpectations, writeResumeSectionFromFacts, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeResumeDocumentPorts, createFakeResumeSectionModels,
  createInMemoryCandidateSessionPersistence } from '@resume-tailoring/application/testing'
import type { CandidateJourneyDependencies, ResumeDocumentPorts } from '@resume-tailoring/application/ports'

type TestPorts = { -readonly [Port in keyof ResumeDocumentPorts]?: ResumeDocumentPorts[Port] }
type LayoutExample = Readonly<{ layout: ResumeLayoutOutcome; eligibility: ResumeExportEligibility }>
type CondensationFailure = 'unavailable' | 'unsupported-content' | 'processing-consent-required'

const condensedSummary = 'Accessible billing screens'
const northwindAchievementId = 'source-fact-experiences-0-achievements-0'
const northwindContextId = 'source-fact-experiences-0-context-0'

describe('Candidate Journey resume editing', () => {
  it('keeps only the unsupported field unresolved when a section validation accepts the other edited field', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPartiallySupportedExperienceValidation()

    await system.replaceTwoExperienceFields()

    system.expectOnlyUnsupportedExperienceFieldUnresolved()
  })

  it('saves the edited fields of one experience as one change and validates each of them', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenPartiallySupportedExperienceValidation()

    await system.editTwoExperienceFieldsTogether()

    system.expectOnlyUnsupportedExperienceFieldUnresolved()
    system.expectOneDraftRevisionSinceReview()
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
  it('never sends an edit whose numbers its Candidate Facts do not contain for semantic validation', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenSupportedValidation()

    await system.editUnsupportedSummary()

    system.expectUnsupportedSummaryKeptFromSemanticValidation()
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
  it('keeps the origin of content hidden by Overflow Reduction apart from content the Candidate hid after reopening', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenSummaryHidden()
    await system.givenOverflowReductionHidNorthwindDetail()

    await system.reopenCandidateSession()

    system.expectNorthwindDetailHiddenByOverflowReduction()
  })
  it('restores content hidden by Overflow Reduction in one action and protects it from being hidden again', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    await system.givenOverflowReductionHidNorthwindDetail()

    system.restoreNorthwindAchievement()

    system.expectRestoredNorthwindAchievementProtected()
  })
  it('replaces the current draft only when its separate proposal is accepted', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenFaithfulCondensation()
    await system.proposeCondensation()

    system.acceptProposal()

    system.expectAcceptedProposal()
  })
  it('keeps the current draft when its separate proposal is rejected', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenFaithfulCondensation()
    await system.proposeCondensation()

    system.rejectProposal()

    system.expectOriginalDraftWithoutProposal()
  })
  it.each(['unavailable', 'unsupported-content', 'processing-consent-required'] as const)('preserves the draft after %s condensation failure', async (reason) => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenCondensationFailure({ reason })

    await system.proposeCondensation()

    system.expectCondensationFailure({ reason })
  })
  it('rejects a condensation that drops meaning even when the shorter wording is supported', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenMeaningLosingCondensation()

    await system.proposeCondensation()

    system.expectCondensationFailure({ reason: 'unsupported-content' })
  })
  it('condenses only Value Proposition and experience prose, keeping roles, employers, dates and skills verbatim', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenFaithfulCondensation()

    await system.proposeCondensation()

    system.expectOnlyProseCondensed()
  })
  it('keeps a condensed experience copied from its Candidate Facts marked as copied', async () => {
    const system = createSystemUnderTest()
    system.givenFirstExperienceCopiedFromItsFacts()
    await system.givenReviewableResume()
    system.givenFaithfulCondensation()
    await system.proposeCondensation()

    system.acceptProposal()

    system.expectCondensedFirstExperienceStillCopied()
  })
  it('rejects a proposal decision after contact changes invalidate its revision', async () => {
    const system = createSystemUnderTest()
    await system.givenReviewableResume()
    system.givenFaithfulCondensation()
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
    system.givenFaithfulCondensation()

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
  readonly #condensationRequests: Parameters<ResumeDocumentPorts['condenseClaim']>[0][] = []
  // Section keys whose written fields validation never supports, so preparation copies them from their Candidate Facts.
  readonly #unsupportedSectionKeys = new Set<string>()
  readonly #dependencies = createDependencies({ ports: this.#ports, condensationRequests: this.#condensationRequests,
    unsupportedSectionKeys: this.#unsupportedSectionKeys })
  #decision: ResumeProposalDecision = { proposalId: '', baseRevision: '' }
  #revisions: string[] = []
  #validationRequests: Parameters<ResumeDocumentPorts['validateClaim']>[0][] = []
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
    this.#ports.validateClaim = (request) => {
      this.#validationRequests.push(request)
      return Promise.resolve({ ok: true, value: { supported: true } })
    }
  }

  givenFaithfulCondensation() { this.givenSupportedValidation() }

  givenFirstExperienceCopiedFromItsFacts() { this.#unsupportedSectionKeys.add('experiences.0') }

  expectCondensedFirstExperienceStillCopied() {
    const experience = this.#expectPreparedSession()?.tailoredResume?.experiences.find(({ id }) => id === 'experiences.0')
    expect(experience?.achievements.map(({ text }) => text)).toContain(condensedSummary)
    expect(experience?.origin).toBe('copied-from-source')
  }

  givenMeaningLosingCondensation() {
    // The shorter wording is backed by the facts, but it does not carry the original meaning back.
    this.#ports.validateClaim = ({ verifiedFacts }) => Promise.resolve({ ok: true,
      value: { supported: !verifiedFacts.some(({ value }) => value === condensedSummary) } })
  }

  expectUnsupportedSummaryKeptFromSemanticValidation() {
    this.expectUnsupportedSummaryBlocksExport()
    expect(this.#validationRequests).toEqual([])
  }

  expectOnlyProseCondensed() {
    const draft = this.#review()?.draft.document
    const proposal = this.#review()?.proposal?.document
    expect(proposal?.valueProposition.paragraphs[0]?.text).toBe(condensedSummary)
    expect(proposal?.sections).toEqual(draft?.sections)
    expect(proposal?.experiences.map(({ role, organization, startDate, endDate }) => ({ role, organization, startDate, endDate })))
      .toEqual(draft?.experiences.map(({ role, organization, startDate, endDate }) => ({ role, organization, startDate, endDate })))
    const condensedTexts = this.#condensationRequests.flatMap(({ claim }) => claim.segments.map(({ text }) => text))
    expect(condensedTexts).not.toContain('Frontend Engineer')
    expect(condensedTexts).not.toContain('Northwind')
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
    const summary = this.#expectPreparedSession()?.tailoredResume?.valueProposition.paragraphs[0]
    expect(this.#validationRequests[0]?.claim.segments).toEqual([{ text: 'Created accessible billing screens',
      factIds: summary?.factIds }])
    expect(this.#validationRequests[0]?.verifiedFacts.map(({ id }) => id)).toEqual(structuredResumeSource.candidateFacts
      .filter(({ id, status }) => status === 'attested' && summary?.factIds.includes(id)).map(({ id }) => id))
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

  /** Stores the Candidate Session as Overflow Reduction leaves it after hiding Northwind's context and achievement. */
  async givenOverflowReductionHidNorthwindDetail() {
    const restored = this.#dependencies.persistence.restore()
    const session = restored.ok ? restored.value.session : null
    const resume = session?.tailoredResume
    const editing = session?.resumeEditing
    const northwind = resume?.experiences.find(({ id }) => id === 'experiences.0')
    if (session == null || resume == null || editing === undefined || northwind?.context == null) {
      throw new Error('Expected a prepared Candidate Session with Northwind detail')
    }
    const location = { kind: 'experience', experienceId: northwind.id } as const
    const hiddenFields = [
      { field: northwind.context, location: { ...location, fieldName: 'context', fieldId: northwind.context.id }, origin: 'overflow-reduction' },
      ...northwind.achievements.map((field) => ({ field, location: { ...location, fieldName: 'achievements', fieldId: field.id },
        origin: 'overflow-reduction' } as const)),
    ] as const
    this.#dependencies.persistence.save({ session: { ...session,
      tailoredResume: { ...resume, experiences: resume.experiences.map((experience) => experience.id === northwind.id
        ? { ...experience, context: null, achievements: [] } : experience) },
      resumeEditing: { ...editing, revision: `${editing.revision}:reduced`, hiddenFields: [...editing.hiddenFields, ...hiddenFields] } } })
    await this.reopenCandidateSession()
  }

  restoreNorthwindAchievement() {
    this.#journey.restoreResumeField({ fieldId: northwindAchievementId })
    this.#outcome = this.#journey.readView()
  }

  expectNorthwindDetailHiddenByOverflowReduction() {
    const northwind = this.#readNorthwind()
    expect(northwind?.achievements).toEqual([])
    expect(northwind?.context).toBeNull()
    expect(this.#review()?.recovery.hiddenFields.map(({ field, origin }) => ({ id: field.id, origin }))).toEqual([
      { id: this.#summaryId, origin: 'candidate' },
      { id: northwindContextId, origin: 'overflow-reduction' },
      { id: northwindAchievementId, origin: 'overflow-reduction' },
    ])
    expect(this.#review()?.recovery.overflowReduction).toEqual({ achievements: 1, other: 1 })
  }

  expectRestoredNorthwindAchievementProtected() {
    const northwind = this.#readNorthwind()
    expect(northwind?.achievements.map(({ id }) => id)).toEqual([northwindAchievementId])
    expect(northwind?.context).toBeNull()
    expect(this.#review()?.recovery.hiddenFields.map(({ field }) => field.id)).toEqual([northwindContextId])
    expect(this.#review()?.recovery.overflowReduction).toEqual({ achievements: 0, other: 1 })
    expect(this.#expectPreparedSession()?.resumeEditing?.restoredFieldIds).toEqual([northwindAchievementId])
  }

  #readNorthwind() {
    return this.#expectPreparedSession()?.tailoredResume?.experiences.find(({ id }) => id === 'experiences.0')
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

  givenCondensationFailure({ reason }: Readonly<{ reason: CondensationFailure }>) {
    this.givenSupportedValidation()
    // An unsupported condensation drops the evidence its wording cites.
    this.#ports.condenseClaim = () => Promise.resolve(reason === 'unsupported-content'
      ? { ok: true, value: { segments: [{ text: 'Built screens', factIds: [] }] } }
      : { ok: false, error: reason })
  }

  expectCondensationFailure({ reason }: Readonly<{ reason: CondensationFailure }>) {
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
    this.givenFaithfulCondensation()
    let pending = true
    this.#ports.condenseClaim = (request) => {
      if (!pending) return Promise.resolve({ ok: true, value: request.claim })
      pending = false
      return new Promise((resolve) => {
        this.#completeProposal = () => { resolve({ ok: true, value: request.claim }) }
      })
    }
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
    this.#ports.validateClaim = () => new Promise((resolve) => {
      this.#completeValidation = () => { resolve({ ok: true, value: { supported: true } }) }
    })
    this.#pendingValidation = this.#journey.editResumeField({ fieldId: this.#readSummaryId(), text: 'Created accessible billing screens' })
  }

  givenValidationUnavailable() {
    this.#ports.validateClaim = () => Promise.resolve({ ok: false, error: 'unavailable' })
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
    expect(session?.tailoredResume?.experiences.map(({ id }) => id)).toEqual(['experiences.0', 'experiences.1'])
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

  givenPartiallySupportedExperienceValidation() {
    this.#ports.validateClaim = ({ claim }) => Promise.resolve({ ok: true,
      value: { supported: claim.segments.every(({ text }) => text !== 'Chief Technology Officer') } })
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

  async editTwoExperienceFieldsTogether() {
    this.#revisions = []
    const unsubscribe = this.#journey.subscribe(() => {
      const view = this.#journey.readView()
      const revision = view.status === 'candidate-session-open' ? view.resumeReview?.draft.revision : undefined
      if (revision !== undefined && !this.#revisions.includes(revision)) this.#revisions.push(revision)
    })
    await this.#journey.editResumeFields({ edits: [
      { fieldId: 'source-fact-experiences-0-role-0', text: 'Chief Technology Officer' },
      { fieldId: 'source-fact-experiences-0-organization-0', text: 'Northwind Ltd' },
    ] })
    unsubscribe()
    this.#outcome = this.#journey.readView()
  }

  expectOneDraftRevisionSinceReview() {
    expect(this.#revisions).toHaveLength(1)
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
    // A restored experience returns to its reverse-chronological place, not to the end.
    expect(this.#expectPreparedSession()?.tailoredResume?.experiences.map(({ id }) => id))
      .toEqual(['experiences.0', 'experiences.1'])
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

function createDependencies({ ports, condensationRequests, unsupportedSectionKeys }: Readonly<{
  ports: TestPorts; condensationRequests: Parameters<ResumeDocumentPorts['condenseClaim']>[0][]
  unsupportedSectionKeys: ReadonlySet<string>
}>): CandidateJourneyDependencies {
  const session = createMatchedSession()
  return createFakeCandidateJourneyDependencies({
    now: () => session.startedAt,
    resumeSectionModels: createFakeResumeSectionModels({
      writeSection: (input) => Promise.resolve({ ok: true, value: writeResumeSectionFromFacts(input) }),
      validateFields: ({ section, fields }) => Promise.resolve({ ok: true, value: { fields: fields.map(({ id }) => ({
        fieldId: id, supported: !unsupportedSectionKeys.has(section.key) })) } }),
    }),
    // Scenarios replace individual ports on this object after the journey starts.
    resumeDocumentPorts: Object.assign(ports, createFakeResumeDocumentPorts({
      condenseClaim: (request) => {
        condensationRequests.push(request)
        return Promise.resolve({ ok: true, value: { segments: request.claim.segments.map((segment) => ({ ...segment,
          text: segment.text.replace('Built accessible billing screens', condensedSummary) })) } })
      },
    })),
    persistence: createInMemoryCandidateSessionPersistence({ session }),
  })
}
