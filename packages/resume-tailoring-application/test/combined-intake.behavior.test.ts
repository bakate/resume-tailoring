import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney, createResumePreparation, readProfessionalResumeFields } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyDependencies, CandidateJourneyView, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { groupedResumeDocument, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'

describe('Candidate Journey combined intake', () => {
  it('prepares a written resume from both inputs with one generation action', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.generateApplicationResume()

    system.expectWrittenResumeAndCompleteSourceProfile()
  })
  it('retains corrected contacts and resets hidden fields after successful regeneration', async () => {
    const system = createSystemUnderTest()
    await system.givenEditedStableResume()

    await system.regenerateCurrentResume()

    system.expectFreshDraftWithCorrectedContacts()
  })

  it('retains manual edits after unsafe regeneration', async () => {
    const system = createSystemUnderTest()
    await system.givenEditedStableResume()

    await system.regenerateUnsafeResume()

    system.expectStableResumePreserved()
  })

  it('offers a normalized alternative when no evidence corresponds to the posting', async () => {
    const system = createSystemUnderTest({ correspondence: 'none' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectNoCorrespondenceAlternative()
  })
  it('asks for a targeted correction only when no usable professional evidence remains', async () => {
    const system = createSystemUnderTest({ ambiguity: 'blocking' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectTargetedCorrection()
  })

  it('restores an interrupted generation with its inputs ready for an explicit retry', async () => {
    const system = createSystemUnderTest({ preparation: 'interrupted' })
    await system.givenConsentedSession()

    await system.reopenInterruptedPreparation()

    system.expectRecoverableInputs()
  })

  it('rejects unsupported wording even when it cites existing fact identifiers', async () => {
    const system = createSystemUnderTest({ preparation: 'unsafe' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectUnsafeWordingNotPublished()
  })

  it('reuses a Source Profile for another posting even if extraction is now unavailable', async () => {
    const system = createSystemUnderTest()
    await system.givenStableResume()

    await system.prepareForAnotherPosting()

    system.expectWrittenResumeAndCompleteSourceProfile()
  })

  it('preserves the last stable resume and evidence after unsafe regeneration', async () => {
    const system = createSystemUnderTest()
    await system.givenStableResume()

    await system.regenerateUnsafeResume()

    system.expectStableResumePreserved()
  })

  it('can prepare an explicitly normalized resume using the same document contract', async () => {
    const system = createSystemUnderTest({ correspondence: 'none' })
    await system.givenConsentedSession()
    await system.requestResumePreparation()

    await system.prepareNormalizedResume()

    system.expectNormalizedResume()
  })

  it('publishes a French document when the Candidate overrides posting language', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.generateFrenchResume()

    system.expectFrenchDocument()
  })

  it('recovers from one transient writing failure', async () => {
    const system = createSystemUnderTest({ preparation: 'transient-once' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectWrittenResumeAndCompleteSourceProfile()
  })

  it('never retries a second transient failure within the same preparation', async () => {
    const system = createSystemUnderTest({ preparation: 'transient-twice' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectUnavailablePreparation()
  })

  it('refuses processing under a materially changed consent policy', async () => {
    const system = createSystemUnderTest({ consent: 'outdated' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectConsentRenewal()
  })

  it('isolates ambiguous evidence without requiring a review of unaffected facts', async () => {
    const system = createSystemUnderTest({ ambiguity: 'isolated' })
    await system.givenConsentedSession()

    await system.generateApplicationResume()

    system.expectIsolatedAmbiguity()
  })

  it('marks the old result outdated when source, posting or language inputs change', async () => {
    const system = createSystemUnderTest()
    await system.givenStableResume()

    system.changeResumeInputs()

    system.expectOutdatedStableResume()
  })

  it('does not resurrect a deleted session when writing finishes late', async () => {
    const system = createSystemUnderTest()
    await system.givenWritingInProgress()

    await system.deleteSessionBeforeWritingFinishes()

    system.expectDeletedSessionStaysAbsent()
  })

  it('fails closed when the writer is not configured', async () => {
    const system = createSystemUnderTest({ preparation: 'no-model' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectUnavailablePreparation()
  })

  it('requires a semantic validation decision for every published field', async () => {
    const system = createSystemUnderTest({ preparation: 'partial-validation' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectUnsafeWordingNotPublished()
  })

  it('invalidates a blocking correction when the intake inputs change', async () => {
    const system = createSystemUnderTest({ ambiguity: 'blocking' })
    await system.givenConsentedSession()
    await system.requestResumePreparation()

    system.changeResumeInputs()

    system.expectCorrectionNoLongerActionable()
  })

  it('never presents a detected sensitive attribute as the Candidate name', async () => {
    const system = createSystemUnderTest()
    await system.givenConsentedSession()

    await system.generateFromSourceWithSensitiveAttributes()

    system.expectIdentityLeftForCandidateEntry()
  })

  it('explains an unusable source instead of presenting an empty correction form', async () => {
    const system = createSystemUnderTest({ ambiguity: 'no-usable-evidence' })
    await system.givenConsentedSession()

    await system.requestResumePreparation()

    system.expectSourceMustBeReplaced()
  })

})

function createSystemUnderTest(options: TestOptions = {}) { return new CombinedIntakeSystem(options) }

type TestOptions = Readonly<{ correspondence?: 'none'; ambiguity?: 'blocking' | 'isolated' | 'no-usable-evidence'; extraction?: 'unavailable'; consent?: 'outdated';
  preparation?: 'interrupted' | 'unsafe' | 'transient-once' | 'transient-twice' | 'no-model' | 'partial-validation' }>

class CombinedIntakeSystem {
  #journey: CandidateJourney
  readonly #dependencies: CandidateJourneyDependencies
  #outcome: CandidateJourneyView | null = null
  #options: TestOptions
  #writingDelivery: Promise<void> = Promise.resolve()
  #releaseWriting: () => void = () => undefined
  #stableResume: CandidateSession['tailoredResume'] = null

  constructor(options: TestOptions) {
    this.#options = options
    this.#dependencies = createDependencies(() => this.#options, () => this.#writingDelivery)
    this.#journey = createCandidateJourney({ dependencies: this.#dependencies })
  }

  async givenWritingInProgress() {
    await this.givenConsentedSession()
    this.#writingDelivery = new Promise((resolve) => { this.#releaseWriting = resolve })
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText('Professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.preparationPhase : null
    }).toBe('writing')
  }

  async deleteSessionBeforeWritingFinishes() {
    this.#journey.deleteCandidateSession()
    this.#releaseWriting()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-absent')
    this.#outcome = this.#journey.readView()
  }

  expectDeletedSessionStaysAbsent() {
    expect(this.#outcome?.status).toBe('candidate-session-absent')
    expect(this.#dependencies.persistence.restore({ now: this.#dependencies.now() }))
      .toMatchObject({ ok: true, value: { session: null } })
  }

  async givenConsentedSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async generateApplicationResume() {
    this.#journey.startTailoredResumePreparation({
      sourceDocument: documentFromText('Source professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent),
    })
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.session.tailoredResume : null
    }).not.toBeNull()
    this.#outcome = this.#journey.readView()
  }

  async requestResumePreparation() {
    this.#journey.startTailoredResumePreparation({
      sourceDocument: documentFromText('Source professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent),
    })
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.preparationOutcome : null
    }).not.toBeNull()
    this.#outcome = this.#journey.readView()
  }

  async generateFromSourceWithSensitiveAttributes() {
    this.#journey.startTailoredResumePreparation({
      sourceDocument: documentFromText('Alex Morgan\nNationality: French\nalex@example.com\nFrontend Engineer at Northwind.'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent),
    })
    await this.#expectPreparationFinished()
  }

  expectIdentityLeftForCandidateEntry() {
    const resume = this.#expectOutcomeView()?.session.tailoredResume
    expect(resume?.identity).toBeNull()
    expect(resume?.contactDetails).toEqual([{ kind: 'email', value: 'alex@example.com' }])
    expect(JSON.stringify(resume)).not.toContain('Nationality')
  }

  expectNoCorrespondenceAlternative() {
    expect(this.#outcome?.status, 'Request preparation before reading the outcome').toBe('candidate-session-open')
    const view = this.#outcome?.status === 'candidate-session-open' ? this.#outcome : null
    expect(view?.preparationOutcome).toMatchObject({ status: 'no-relevant-evidence', alternative: 'normalized' })
    expect(view?.session.tailoredResume).toBeNull()
  }

  expectTargetedCorrection() {
    expect(this.#outcome?.status, 'Request preparation before reading the outcome').toBe('candidate-session-open')
    const view = this.#outcome?.status === 'candidate-session-open' ? this.#outcome : null
    expect(view?.preparationOutcome).toMatchObject({ status: 'awaiting-correction' })
    expect(view?.session.tailoredResume).toBeNull()
  }

  async reopenInterruptedPreparation() {
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText('Source professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.preparationPhase : null
    }).toBe('writing')
    this.#journey = createCandidateJourney({ dependencies: this.#dependencies })
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
    this.#outcome = this.#journey.readView()
  }

  expectRecoverableInputs() {
    expect(this.#outcome?.status, 'Reopen preparation before reading the outcome').toBe('candidate-session-open')
    const view = this.#outcome?.status === 'candidate-session-open' ? this.#outcome : null
    expect(view?.operation).toBeNull()
    expect(view?.session.preparation).toMatchObject({ status: 'interrupted',
      sourceIntake: { sourceProfile: structuredResumeSource.sourceProfile } })
  }

  expectUnsafeWordingNotPublished() {
    expect(this.#outcome?.status, 'Request preparation before reading the outcome').toBe('candidate-session-open')
    const view = this.#outcome?.status === 'candidate-session-open' ? this.#outcome : null
    expect(view?.preparationOutcome).toMatchObject({ status: 'failed', reason: 'unsupported-content' })
    expect(view?.session.tailoredResume).toBeNull()
  }

  async givenStableResume() {
    await this.givenConsentedSession()
    await this.generateApplicationResume()
    const view = this.#journey.readView()
    this.#stableResume = view.status === 'candidate-session-open' ? view.session.tailoredResume : null
  }

  async givenEditedStableResume() {
    await this.givenStableResume()
    this.#journey.updateResumeContacts({ identity: { kind: 'personal-information', value: 'Alex Morgan' },
      contactDetails: [{ kind: 'email', value: 'corrected@example.com' }] })
    this.#journey.hideResumeField({ fieldId: 'summary-billing' })
    const view = this.#journey.readView()
    this.#stableResume = view.status === 'candidate-session-open' ? view.session.tailoredResume : null
  }

  async regenerateCurrentResume() {
    this.#journey.startTailoredResumePreparation()
    await this.#expectPreparationFinished()
  }

  expectFreshDraftWithCorrectedContacts() {
    const view = this.#expectOutcomeView()
    expect(view?.preparationOutcome).toMatchObject({ status: 'prepared' })
    expect(view?.session.tailoredResume?.contactDetails).toEqual([{ kind: 'email', value: 'corrected@example.com' }])
    expect(view?.session.tailoredResume?.valueProposition.paragraphs).toHaveLength(1)
    expect(view?.session.resumeEditing).toMatchObject({ revision: view?.session.preparedResumeRevision,
      hiddenFields: [], unsupportedFieldIds: [], manuallyEdited: false })
  }

  async #expectPreparationFinished() {
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.operation : 'pending'
    }).toBeNull()
    this.#outcome = this.#journey.readView()
  }

  async prepareForAnotherPosting() {
    this.#options = { ...this.#options, extraction: 'unavailable' }
    this.#journey.startTailoredResumePreparation({ jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await this.#expectPreparationFinished()
  }

  async regenerateUnsafeResume() {
    this.#options = { ...this.#options, preparation: 'unsafe' }
    this.#journey.startTailoredResumePreparation()
    await this.#expectPreparationFinished()
  }

  async prepareNormalizedResume() {
    this.#journey.startTailoredResumePreparation({ purpose: 'normalized' })
    await this.#expectPreparationFinished()
  }

  async generateFrenchResume() {
    this.#journey.startTailoredResumePreparation({ locale: 'fr', sourceDocument: documentFromText('Professional evidence'),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await this.#expectPreparationFinished()
  }

  #expectOutcomeView() {
    expect(this.#outcome?.status, 'Complete a Candidate Journey action before reading the outcome').toBe('candidate-session-open')
    return this.#outcome?.status === 'candidate-session-open' ? this.#outcome : null
  }

  expectStableResumePreserved() {
    const view = this.#expectOutcomeView()
    expect(view?.preparationOutcome).toMatchObject({ status: 'failed', reason: 'unsupported-content' })
    expect(view?.session.tailoredResume).toEqual(this.#stableResume)
    expect(view?.session.sourceIntake?.sourceProfile).toEqual(structuredResumeSource.sourceProfile)
  }

  expectNormalizedResume() {
    const resume = this.#expectOutcomeView()?.session.tailoredResume
    expect(resume).toMatchObject({ purpose: 'normalized', targetRole: null, valueProposition: { kind: 'prose' } })
    expect(resume?.experiences).toHaveLength(2)
  }

  expectFrenchDocument() {
    const resume = this.#expectOutcomeView()?.session.tailoredResume
    expect(resume).toMatchObject({ locale: 'fr', valueProposition: { kind: 'prose' } })
    expect(resume?.valueProposition.paragraphs[0]?.text).toContain('facturation')
    expect(resume?.experiences[0]?.organization?.text).toBe('Northwind')
  }

  expectUnavailablePreparation() {
    const view = this.#expectOutcomeView()
    expect(view?.preparationOutcome).toMatchObject({ status: 'failed', reason: 'unavailable' })
    expect(view?.session.tailoredResume).toBeNull()
  }

  expectConsentRenewal() {
    const view = this.#expectOutcomeView()
    expect(view?.preparationOutcome).toMatchObject({ status: 'failed', reason: 'processing-consent-required', recovery: 'renew-consent' })
    expect(view?.session.tailoredResume).toBeNull()
  }

  expectIsolatedAmbiguity() {
    const session = this.#expectOutcomeView()?.session
    expect(session?.tailoredResume?.experiences[0]?.context).toBeNull()
    expect(session?.sourceIntake?.sourceProfile.experiences[0]?.context).toBe('Customer billing team')
    expect(session?.sourceIntake?.criticalAmbiguities).toHaveLength(1)
  }

  expectCorrectionNoLongerActionable() {
    expect(this.#expectOutcomeView()?.session.preparation?.status).toBe('outdated')
    expect(this.#expectOutcomeView()?.session.tailoredResume).toBeNull()
  }

  expectSourceMustBeReplaced() {
    const view = this.#expectOutcomeView()
    expect(view?.preparationOutcome).toMatchObject({ status: 'failed', detail: 'empty-document' })
    expect(view?.session.tailoredResume).toBeNull()
  }

  changeResumeInputs() {
    this.#journey.invalidateResumeInputs()
    this.#outcome = this.#journey.readView()
  }

  expectOutdatedStableResume() {
    const session = this.#expectOutcomeView()?.session
    expect(session?.preparedResumeStatus).toBe('outdated')
    expect(session?.tailoredResume).toEqual(this.#stableResume)
  }

  expectWrittenResumeAndCompleteSourceProfile() {
    expect(this.#outcome?.status, 'Generate a resume before reading the outcome').toBe('candidate-session-open')
    const session = this.#outcome?.status === 'candidate-session-open' ? this.#outcome.session : null
    expect(session?.tailoredResume?.valueProposition.kind).toBe('prose')
    expect(session?.tailoredResume?.valueProposition.paragraphs).toHaveLength(1)
    expect(session?.tailoredResume?.valueProposition.paragraphs[0]?.factIds).toEqual([
      'source-fact-experiences-0-role-0', 'source-fact-experiences-0-achievements-0',
    ])
    expect(session?.sourceIntake?.sourceProfile).toEqual(structuredResumeSource.sourceProfile)
    expect(session?.tailoredResume?.experiences).toHaveLength(2)
    expect(session?.jobMatch?.analysis.generationEligibility).toBe('eligible')
  }
}

const policy = { provider: 'Test', purposes: ['Write'], retentionPolicy: 'None',
  storageBehavior: 'Browser-local', transmittedDataCategories: ['Evidence'], version: 'test' } as const

function createDependencies(options: () => TestOptions, writingDelivery: () => Promise<void>): CandidateJourneyDependencies {
  let writingFailures = 0
  const startedAt = Date.now()
  let session: CandidateSession | null = { expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000057', version: candidateSessionStorageVersion,
    phase: 'source-intake', processingConsent: { grantedAt: startedAt, policy: options().consent === 'outdated' ? { ...policy, version: 'old' } : policy },
    sourceIntake: null, jobMatch: null, tailoredResume: null }
  return {
    createSessionId: () => crypto.randomUUID(), now: () => startedAt,
    languageModelGateway: { processingPolicy: policy },
    persistence: { restore: () => ({ ok: true, value: { notice: null, session } }),
      save: ({ session: nextSession }) => { session = nextSession; return { ok: true, value: session } },
      delete: () => { session = null; return { ok: true, value: null } } },
    sourceDocumentReader: { read: (document) => Promise.resolve({ ok: true,
      value: { text: new TextDecoder().decode(document.bytes), pageCount: 1 } }) },
    sourceProfileExtractor: { extract: () => options().extraction === 'unavailable'
      ? Promise.resolve({ ok: false, error: 'source-profile-extraction-unavailable' }) : Promise.resolve({ ok: true,
      value: options().ambiguity === 'no-usable-evidence' ? { experiences: [{ role: null, organization: 'Northwind', startDate: '2021', endDate: '2024', context: null, achievements: [] }], projects: [], education: [], languages: [], certifications: [], skills: [], criticalAmbiguities: [] } : options().ambiguity === 'blocking' ? { experiences: [], projects: [], education: [], languages: [], certifications: [],
        skills: [{ name: 'React', category: null }], criticalAmbiguities: [{ path: 'skills.0.name.0', question: 'Which skill did you use?' }] }
        : { ...structuredResumeSource.sourceProfile, criticalAmbiguities: options().ambiguity === 'isolated'
          ? [{ path: 'experiences.0.context.0', question: 'Which team?' }] : [] } }) },
    jobPostingDocumentReader: { read: (document) => Promise.resolve({ ok: true,
      value: { text: new TextDecoder().decode(document.bytes) } }) },
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: true, value: structuredResumeJobMatch }) },
    matchEvidenceMatcher: { match: () => Promise.resolve({ ok: true, value: options().correspondence === 'none' ? { evidence: [], relevance: [] } : {
      evidence: [{ coverage: 'covered', factMatches: [{ factId: 'source-fact-skills-0-name-0', factTerm: 'React', requirementTerm: 'React', relationship: 'exact' }], requirementId: 'job-requirement-react' }],
      relevance: [{ requirementId: 'job-requirement-react', factMatch: { factId: 'source-fact-skills-0-name-0', factTerm: 'React', requirementTerm: 'React', relationship: 'exact' } }],
    } }) },
    resumeDocumentPorts: options().preparation === 'no-model' ? undefined : createResumePreparation({
      writer: { write: async ({ locale, purpose }) => {
        await writingDelivery()
        const allowance = options().preparation === 'transient-once' ? 1 : options().preparation === 'transient-twice' ? 2 : 0
        if (writingFailures < allowance) { writingFailures += 1; return Promise.resolve({ ok: false, error: { type: 'unavailable', transient: true } }) }
        return options().preparation === 'interrupted'
        ? new Promise(() => undefined) : Promise.resolve({ ok: true, value: {
          ...groupedResumeDocument, locale, purpose,
          experiences: groupedResumeDocument.experiences.map((experience) => ({ ...experience,
            context: options().ambiguity === 'isolated' ? null : experience.context })),
          valueProposition: { kind: 'prose', paragraphs: [{ id: 'summary-billing',
            text: options().preparation === 'unsafe' ? 'Led a global team of 100 engineers.' : locale === 'fr' ? 'Développement d’interfaces de facturation accessibles.' : 'Frontend engineer building accessible billing screens.',
            factIds: ['source-fact-experiences-0-role-0', 'source-fact-experiences-0-achievements-0'] }] },
        } }) } },
      validator: { validate: ({ document }) => Promise.resolve({ ok: true, value: {
        coherent: true, languageMatches: true,
        fields: readProfessionalResumeFields(document).filter((_field, index) => options().preparation !== 'partial-validation' || index > 0).map(({ id }) => ({ fieldId: id,
          supported: options().preparation !== 'unsafe' || id !== 'summary-billing' })),
      } }) },
    }),
  }
}

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
