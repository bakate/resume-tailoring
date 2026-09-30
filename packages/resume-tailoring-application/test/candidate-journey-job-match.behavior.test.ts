import { describe, expect, it } from 'vitest'
import { groupedResumeDocument } from '@resume-tailoring/application/structured-resume-fixtures'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  createCandidateJourney,
} from '@resume-tailoring/application/candidate-journey'
import type {
  CandidateJourney,
  CandidateJourneyDependencies,
  CandidateJourneyView,
  CandidateSession,
  CandidateSessionPersistence,
} from '@resume-tailoring/application/candidate-journey'
import type {
  ExtractedJobPosting,
  JobPostingDocumentReader,
  MatchEvidenceProposal,
} from '@resume-tailoring/application/job-match'
import { createJobMatch } from '@resume-tailoring/application/job-match'

const currentTime = Date.UTC(2026, 8, 29, 10)

describe('Candidate Journey Job Match', () => {
  it('delivers a source-backed explainable Match Analysis in one action', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()

    // Action
    await system.submitPastedJobPosting()

    // Then
    system.expectExplainableMatchAnalysis()
  })

  it.each([
    ['a PDF', 'application/pdf', 'role.pdf'],
    ['a TXT file', 'text/plain', 'role.txt'],
  ] as const)('accepts %s Job Posting', async (_caseName, mediaType, name) => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()

    // Action
    await system.submitUploadedJobPosting({ mediaType, name })

    // Then
    system.expectUploadedJobPostingToBeAnalyzed({ name })
  })

  it('preserves the last Match Analysis when an extraction is not source-backed', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()
    await system.givenAStableMatchAnalysisExists()
    system.givenExtractionContainsAnInventedExcerpt()

    // Action
    await system.replaceJobPostingWithInvalidExtraction()

    // Then
    system.expectStableMatchAnalysisToRemainVisible()
  })

  it('rejects an extracted requirement that is not backed by its excerpt', async () => {
    const system = createSystemUnderTest()
    await system.givenCandidateJourneyIsReadyForJobMatch()
    system.givenExtractionContainsAnInventedRequirement()

    await system.replaceJobPostingWithInvalidExtraction()

    system.expectExtractionToBeRejected()
  })

  it('keeps valid relevance when another proposed relevance link is unsupported', async () => {
    const system = createSystemUnderTest()
    await system.givenCandidateJourneyIsReadyForJobMatch()
    system.givenMatchEvidenceIncludesAnUnsupportedRelevanceLink()

    await system.submitPastedJobPosting()

    system.expectOnlySupportedRelevantFacts()
  })

  it('omits an unsupported Practical Constraint without rejecting the analysis', async () => {
    const system = createSystemUnderTest()
    await system.givenCandidateJourneyIsReadyForJobMatch()
    system.givenExtractionContainsAnInventedPracticalConstraint()

    await system.submitPastedJobPosting()

    system.expectOnlySourceBackedPracticalConstraints()
  })

  it('does not analyze a posting before Critical Ambiguities are resolved', async () => {
    const system = createSystemUnderTest({ session: createSourceIntakeSession() })
    await system.givenCandidateJourneyIsReady()

    system.submitJobPostingBeforeJobMatch()

    system.expectJobPostingNotToBeAnalyzed()
  })

  it('derives French importance and validates source-backed alternatives', async () => {
    const system = createSystemUnderTest()

    await system.analyzeFrenchJobPosting()

    system.expectFrenchImportanceAndAlternatives()
  })

  it('reserves central importance for responsibilities the Job Posting emphasizes', async () => {
    const system = createSystemUnderTest()

    await system.analyzeJobPostingWithEmphasizedResponsibilities()

    system.expectCentralImportanceOnlyForEmphasizedResponsibilities()
  })

  it('confirms a missing Candidate Fact and refreshes Match Analysis atomically', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()
    await system.givenAStableMatchAnalysisExists()
    system.givenEnrichedOperationalRiskEvidenceMatches()

    // Action
    await system.confirmProfileEnrichment()

    // Then
    system.expectConfirmedCandidateFactAndRefreshedMatchAnalysis()
  })

  it('rejects empty Profile Enrichment and preserves the stable Match Analysis', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()
    await system.givenAStableMatchAnalysisExists()

    // Action
    await system.confirmEmptyProfileEnrichment()

    // Then
    system.expectRejectedProfileEnrichment('candidate-fact-invalid')
  })

  it('rejects Profile Enrichment for a complementary Job Requirement', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()
    await system.givenAStableMatchAnalysisExists()

    // Action
    await system.confirmComplementaryProfileEnrichment()

    // Then
    system.expectRejectedProfileEnrichment('profile-enrichment-unavailable')
  })

  it('starts Tailored Resume Preparation for a low evidence-backed Match Score', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()
    system.givenOnlyOneRelevantCandidateFactMatches()
    await system.givenAStableMatchAnalysisExists()

    // Action
    await system.startTailoredResumePreparation()

    // Then
    system.expectTailoredResumePreparationToStart()
  })

  it('refuses Tailored Resume Preparation when no relevant Candidate Fact exists', async () => {
    const system = createSystemUnderTest()

    // Given
    await system.givenCandidateJourneyIsReadyForJobMatch()
    system.givenNoRelevantCandidateFactMatches()
    await system.givenAStableMatchAnalysisExists()

    // Action
    system.startUnavailableTailoredResumePreparation()

    // Then
    system.expectJobMatchToRemainCurrent()
  })
})

async function analyzeFrenchJobPosting() {
  const extraction = createFrenchExtraction()
  return createJobMatch({
    candidateFacts: [],
    document: { bytes: new TextEncoder().encode(frenchJobPostingText),
      mediaType: 'text/plain', name: 'role.txt' },
    jobPostingDocumentReader: createJobPostingDocumentReader(),
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: true, value: extraction }) },
    matchEvidenceMatcher: emptyMatchEvidenceMatcher,
  })
}

async function analyzeJobPostingWithEmphasizedResponsibilities() {
  return createJobMatch({
    candidateFacts: [],
    document: { bytes: new TextEncoder().encode(emphasizedResponsibilitiesJobPostingText),
      mediaType: 'text/plain', name: 'role.txt' },
    jobPostingDocumentReader: createJobPostingDocumentReader(),
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: true, value: {
      practicalConstraints: [],
      requirements: emphasizedResponsibilitiesJobRequirements,
      targetRole: null,
    } }) },
    matchEvidenceMatcher: emptyMatchEvidenceMatcher,
  })
}

function createFrenchExtraction(): ExtractedJobPosting {
  return {
    practicalConstraints: [],
    requirements: frenchJobRequirements,
    targetRole: null,
  }
}

function createSystemUnderTest({ session = createJobMatchSession() }: Readonly<{
  session?: CandidateSession
}> = {}) {
  return new CandidateJourneyJobMatchTestSystem({ session })
}

type TestDependenciesRequest = Readonly<{
  onMatch: () => void
  readMatchEvidence: (request: Parameters<CandidateJourneyDependencies['matchEvidenceMatcher']['match']>[0]) => MatchEvidenceProposal
  readExtraction: () => ExtractedJobPosting
  session: CandidateSession
}>

function createTestDependencies({
  onMatch, readExtraction, readMatchEvidence, session,
}: TestDependenciesRequest): CandidateJourneyDependencies {
  return {
    resumeDocumentPorts: { prepare: ({ revision }) => Promise.resolve({ status: 'prepared', revision, document: groupedResumeDocument }) },
    createSessionId: () => '00000000-0000-4000-8000-000000000042',
    jobPostingDocumentReader: createJobPostingDocumentReader(),
    jobPostingExtractor: { extract: () => Promise.resolve({ ok: true, value: readExtraction() }) },
    languageModelGateway: { processingPolicy },
    matchEvidenceMatcher: { match: (request) => {
      onMatch()
      return Promise.resolve({ ok: true, value: readMatchEvidence(request) })
    } },
    now: () => currentTime,
    persistence: createInMemoryPersistence({ storedSession: session }),
    sourceDocumentReader: unavailableSourceDocumentReader,
    sourceProfileExtractor: unavailableSourceProfileExtractor,
  }
}

class CandidateJourneyJobMatchTestSystem {
  readonly #candidateJourney: CandidateJourney
  #directJobMatch: Awaited<ReturnType<typeof createJobMatch>> | null = null
  #extractedJobPosting: ExtractedJobPosting = extractedJobPosting
  #matchRequestCount = 0
  #matchEvidence: MatchEvidenceProposal = matchEvidenceProposal
  #completedAction: JobMatchAction | null = null
  #view: CandidateJourneyView | null = null

  constructor({ session }: Readonly<{ session: CandidateSession }>) {
    this.#candidateJourney = createCandidateJourney({
      dependencies: createTestDependencies({
        onMatch: () => {
          this.#matchRequestCount += 1
        },
        readMatchEvidence: () => this.#matchEvidence,
        readExtraction: () => this.#extractedJobPosting,
        session,
      }),
    })
  }

  async givenCandidateJourneyIsReadyForJobMatch() {
    this.#candidateJourney.start()
    await this.#waitForReadyJobMatch()
  }

  async analyzeFrenchJobPosting() {
    this.#directJobMatch = await analyzeFrenchJobPosting()
  }

  async analyzeJobPostingWithEmphasizedResponsibilities() {
    this.#directJobMatch = await analyzeJobPostingWithEmphasizedResponsibilities()
  }

  async givenCandidateJourneyIsReady() {
    this.#candidateJourney.start()
    await this.#waitForOpenSession()
  }

  async givenAStableMatchAnalysisExists() {
    this.#candidateJourney.submitJobPosting({ document: createJobPostingDocument({
      mediaType: 'text/plain', name: 'stable-job-posting.txt',
    }) })
    await this.#waitForCompletedJobMatch()
  }

  givenExtractionContainsAnInventedExcerpt() {
    this.#extractedJobPosting = {
      ...extractedJobPosting,
      targetRole: { sourceExcerpt: 'Invented role title', value: 'Invented role' },
    }
  }

  givenExtractionContainsAnInventedPracticalConstraint() {
    this.#extractedJobPosting = {
      ...extractedJobPosting,
      practicalConstraints: [...extractedJobPosting.practicalConstraints, {
        sourceExcerpt: 'Work from Paris three days per week.', value: 'Lyon',
      }],
    }
  }

  givenExtractionContainsAnInventedRequirement() {
    this.#extractedJobPosting = {
      ...extractedJobPosting,
      requirements: extractedJobPosting.requirements.map((requirement, requirementIndex) =>
        requirementIndex === 0 ? { ...requirement, value: 'TypeScript payroll' } : requirement),
    }
  }

  givenMatchEvidenceIncludesAnUnsupportedRelevanceLink() {
    this.#matchEvidence = {
      ...matchEvidenceProposal,
      relevance: [...matchEvidenceProposal.relevance,
        createRelevance('1', 'source-fact-3', 'Mentor', 'TypeScript')],
    }
  }

  givenEnrichedOperationalRiskEvidenceMatches() {
    this.#matchEvidence = enrichedMatchEvidenceProposal
  }

  givenOnlyOneRelevantCandidateFactMatches() {
    this.#matchEvidence = lowMatchEvidenceProposal
  }

  givenNoRelevantCandidateFactMatches() {
    this.#matchEvidence = emptyMatchEvidenceProposal
  }

  async submitPastedJobPosting() {
    this.#candidateJourney.submitJobPosting({ document: createJobPostingDocument({
      mediaType: 'text/plain',
      name: 'pasted-job-posting.txt',
    }) })
    this.#view = await this.#waitForCompletedJobMatch()
    this.#completedAction = 'job-posting-submitted'
  }

  async submitUploadedJobPosting({ mediaType, name }: Readonly<{
    mediaType: string
    name: string
  }>) {
    this.#candidateJourney.submitJobPosting({
      document: createJobPostingDocument({ mediaType, name }),
    })
    this.#view = await this.#waitForCompletedJobMatch()
    this.#completedAction = 'job-posting-submitted'
  }

  async replaceJobPostingWithInvalidExtraction() {
    this.#candidateJourney.submitJobPosting({ document: createJobPostingDocument({
      mediaType: 'text/plain', name: 'replacement.txt',
    }) })
    this.#view = await this.#waitForJobMatchFailure()
    this.#completedAction = 'job-posting-submitted'
  }

  async confirmProfileEnrichment() {
    this.#candidateJourney.confirmProfileEnrichment({
      kind: 'experience',
      requirementId: 'job-requirement-7',
      value: 'Managed operational risk for production services',
    })
    this.#view = await this.#waitForProfileEnrichment()
    this.#completedAction = 'profile-enrichment-confirmed'
  }

  async confirmEmptyProfileEnrichment() {
    await this.#confirmRejectedProfileEnrichment({
      requirementId: 'job-requirement-7', value: '   ',
    })
  }

  async confirmComplementaryProfileEnrichment() {
    await this.#confirmRejectedProfileEnrichment({
      requirementId: 'job-requirement-8', value: 'Used Kubernetes',
    })
  }

  async startTailoredResumePreparation() {
    this.#candidateJourney.startTailoredResumePreparation()
    this.#view = await this.#waitForTailoredResumePreparation()
    this.#completedAction = 'tailored-resume-preparation-started'
  }

  startUnavailableTailoredResumePreparation() {
    this.#candidateJourney.startTailoredResumePreparation()
    this.#view = this.#candidateJourney.readView()
    this.#completedAction = 'tailored-resume-preparation-started'
  }

  expectExplainableMatchAnalysis() {
    this.#expectCompletedAction()
    const jobMatch = this.#readOpenView().session.jobMatch
    if (jobMatch === null) expect.fail('Expected an explainable Match Analysis')
    this.#expectMatchOverview({ jobMatch })
    this.#expectMatchSummary({ jobMatch })
    this.#expectSourceBackedRequirements({ jobMatch })
  }

  #expectMatchOverview({ jobMatch }: Readonly<{ jobMatch: NonNullable<CandidateSession['jobMatch']> }>) {
    expect(jobMatch.targetRole).toEqual({
      sourceExcerpt: 'We are hiring a Staff Engineer.',
      value: 'Staff Engineer',
    })
    expect(jobMatch.analysis).toMatchObject({
      criticalRequirementReserve: { status: 'present' },
      generationEligibility: 'eligible',
      matchBand: 'credible',
      matchBandQualification: 'critical-requirement-reserve',
    })
  }

  #expectMatchSummary({ jobMatch }: Readonly<{ jobMatch: NonNullable<CandidateSession['jobMatch']> }>) {
    expect(jobMatch.strengthRequirementIds).toHaveLength(3)
    expect(jobMatch.priorityGapRequirementIds).toHaveLength(3)
    expect(jobMatch.practicalConstraints).toEqual([{
      sourceExcerpt: 'Work from Paris three days per week.',
      value: 'Paris three days per week',
    }])
  }

  #expectSourceBackedRequirements({ jobMatch }: Readonly<{
    jobMatch: NonNullable<CandidateSession['jobMatch']>
  }>) {
    expect(jobMatch.requirements.every(({ sourceExcerpt }) =>
      jobPostingText.includes(sourceExcerpt))).toBe(true)
    expect(jobMatch.requirements.find(({ id }) => id === 'job-requirement-7')).toMatchObject({
      importance: 'critical',
      importanceRationale: 'Operational risk management is required.',
    })
    expect(jobMatch.requirements.find(({ id }) => id === 'job-requirement-8'))
      .toMatchObject({ importance: 'complementary' })
  }

  expectUploadedJobPostingToBeAnalyzed({ name }: Readonly<{ name: string }>) {
    this.#expectCompletedAction()
    expect(this.#readOpenView().session.jobMatch?.jobPosting.name).toBe(name)
  }

  expectStableMatchAnalysisToRemainVisible() {
    this.#expectCompletedAction()
    const view = this.#readOpenView()
    expect(view.jobMatchFailure).toBe('job-posting-extraction-unavailable')
    expect(view.session.jobMatch?.jobPosting.name).toBe('stable-job-posting.txt')
  }

  expectOnlySupportedRelevantFacts() {
    this.#expectCompletedAction()
    const view = this.#readOpenView()
    expect(view.jobMatchFailure).toBeNull()
    expect(view.session.jobMatch?.analysis.relevantFactIds).toEqual(
      matchEvidenceProposal.relevance.map(({ factMatch }) => factMatch.factId))
  }

  expectOnlySourceBackedPracticalConstraints() {
    this.#expectCompletedAction()
    const view = this.#readOpenView()
    expect(view.jobMatchFailure).toBeNull()
    expect(view.session.jobMatch?.practicalConstraints).toEqual(extractedJobPosting.practicalConstraints)
  }

  expectExtractionToBeRejected() {
    this.#expectCompletedAction()
    const view = this.#readOpenView()
    expect(view.jobMatchFailure).toBe('job-posting-extraction-unavailable')
    expect(view.session.jobMatch).toBeNull()
  }

  submitJobPostingBeforeJobMatch() {
    this.#candidateJourney.submitJobPosting({ document: createJobPostingDocument({
      mediaType: 'text/plain', name: 'premature.txt',
    }) })
  }

  expectJobPostingNotToBeAnalyzed() {
    expect(this.#candidateJourney.readView()).toMatchObject({
      operation: null,
      status: 'candidate-session-open',
    })
    expect(this.#matchRequestCount).toBe(0)
  }

  expectFrenchImportanceAndAlternatives() {
    expect(this.#directJobMatch?.ok).toBe(true)
    if (this.#directJobMatch?.ok !== true) return
    expect(this.#directJobMatch.value.requirements.map(({ importance }) => importance)).toEqual([
      'critical', 'critical', 'critical', 'central', 'central',
    ])
    expect(this.#directJobMatch.value.analysis.requirementGroups).toEqual([
      expect.objectContaining({ requirementIds: ['job-requirement-1'] }),
      expect.objectContaining({
        requirementIds: ['job-requirement-3', 'job-requirement-4'],
      }),
      expect.objectContaining({
        requirementIds: ['job-requirement-5', 'job-requirement-6'],
      }),
    ])
  }

  expectCentralImportanceOnlyForEmphasizedResponsibilities() {
    if (this.#directJobMatch === null) expect.fail('Expected a Job Posting analysis')
    expect(this.#directJobMatch.ok).toBe(true)
    if (!this.#directJobMatch.ok) return
    expect(this.#directJobMatch.value.requirements.map(({ capability, importance }) =>
      [capability.name, importance])).toEqual([
      ['payments platform architecture', 'central'],
      ['Define features, ensure quality and collaborate with product managers', 'complementary'],
      ['Kafka', 'central'],
      ['TypeScript', 'critical'],
      ['Go', 'complementary'],
      ['plusieurs équipes produit', 'central'],
      ['SQL', 'critical'],
    ])
  }

  expectConfirmedCandidateFactAndRefreshedMatchAnalysis() {
    this.#expectCompletedAction('profile-enrichment-confirmed')
    const view = this.#readOpenView()
    expect(view.session.sourceIntake?.candidateFacts).toContainEqual(expect.objectContaining({
      status: 'attested',
      value: 'Managed operational risk for production services',
    }))
    expect(view.session.jobMatch?.analysis.evidence).toContainEqual(expect.objectContaining({
      coverage: 'covered',
      requirementId: 'job-requirement-7',
    }))
    expect(this.#matchRequestCount).toBe(2)
  }

  expectRejectedProfileEnrichment(expectedFailure: 'candidate-fact-invalid'
    | 'profile-enrichment-unavailable') {
    this.#expectCompletedAction('profile-enrichment-confirmed')
    const view = this.#readOpenView()
    expect(view.profileEnrichmentFailure).toBe(expectedFailure)
    expect(view.session.sourceIntake?.candidateFacts).toEqual(candidateFacts)
    expect(this.#matchRequestCount).toBe(1)
  }

  expectTailoredResumePreparationToStart() {
    this.#expectCompletedAction('tailored-resume-preparation-started')
    expect(this.#readOpenView().session.phase).toBe('tailored-resume-preparation')
  }

  expectJobMatchToRemainCurrent() {
    this.#expectCompletedAction('tailored-resume-preparation-started')
    expect(this.#readOpenView().session.phase).toBe('job-match')
  }

  #expectCompletedAction(expectedAction: JobMatchAction = 'job-posting-submitted') {
    expect(this.#completedAction, 'Expected a caller-visible Action before reading the outcome')
      .toBe(expectedAction)
  }

  #readOpenView() {
    if (this.#view?.status !== 'candidate-session-open') {
      expect.fail('Expected an open Candidate Session before reading Job Match')
    }
    return this.#view
  }

  async #waitForCompletedJobMatch() {
    const currentView = this.#candidateJourney.readView()
    if (hasCompletedJobMatch({ view: currentView })) return currentView
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (!hasCompletedJobMatch({ view: nextView })) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }

  async #waitForReadyJobMatch() {
    const currentView = this.#candidateJourney.readView()
    if (isReadyForJobMatch({ view: currentView })) return currentView
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (!isReadyForJobMatch({ view: nextView })) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }

  async #waitForOpenSession() {
    const currentView = this.#candidateJourney.readView()
    if (currentView.status === 'candidate-session-open') return currentView
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (nextView.status !== 'candidate-session-open') return
        unsubscribe()
        resolve(nextView)
      })
    })
  }

  async #waitForJobMatchFailure() {
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (nextView.status !== 'candidate-session-open' || nextView.jobMatchFailure === null) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }


  async #waitForProfileEnrichment() {
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (nextView.status !== 'candidate-session-open'
          || nextView.operation === 'processing-profile-enrichment') return
        const hasEnrichment = nextView.session.sourceIntake?.candidateFacts.some(({ value }) =>
          value === 'Managed operational risk for production services') ?? false
        if (!hasEnrichment) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }


  async #confirmRejectedProfileEnrichment({ requirementId, value }: Readonly<{
    requirementId: `job-requirement-${string}`
    value: string
  }>) {
    this.#candidateJourney.confirmProfileEnrichment({ kind: 'skill', requirementId, value })
    this.#view = await this.#waitForProfileEnrichmentFailure()
    this.#completedAction = 'profile-enrichment-confirmed'
  }

  async #waitForProfileEnrichmentFailure() {
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (nextView.status !== 'candidate-session-open'
          || nextView.profileEnrichmentFailure === null) return
        unsubscribe()
        resolve(nextView)
      })
    })
  }

  async #waitForTailoredResumePreparation() {
    return new Promise<CandidateJourneyView>((resolve) => {
      const unsubscribe = this.#candidateJourney.subscribe(() => {
        const nextView = this.#candidateJourney.readView()
        if (nextView.status !== 'candidate-session-open'
          || nextView.session.phase !== 'tailored-resume-preparation') return
        unsubscribe()
        resolve(nextView)
      })
    })
  }
}

type JobMatchAction = 'job-posting-submitted' | 'profile-enrichment-confirmed'
  | 'tailored-resume-preparation-started'

function createJobPostingDocumentReader(): JobPostingDocumentReader {
  return { read: (document) => Promise.resolve({
    ok: true,
    value: { text: new TextDecoder().decode(document.bytes) },
  }) }
}

function createInMemoryPersistence({ storedSession }: Readonly<{
  storedSession: CandidateSession
}>): CandidateSessionPersistence {
  let session = storedSession
  return {
    delete: () => ({ ok: true, value: null }),
    restore: () => ({ ok: true, value: { notice: null, session } }),
    save: ({ session: nextSession }) => {
      session = nextSession
      return { ok: true, value: session }
    },
  }
}

function createJobMatchSession(): CandidateSession {
  return {
    expiresAt: currentTime + candidateSessionDurationMilliseconds,
    jobMatch: null,
    phase: 'job-match',
    processingConsent: { grantedAt: currentTime, policy: processingPolicy },
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000042',
    sourceIntake: {
      candidateFacts,
      contactDetails: [],
      criticalAmbiguities: [],
      originalContent: 'Professional source content',
      sourceDocument: { kind: 'pasted-text', name: 'source.txt' },
      sourceProfile: {
        certifications: [], education: [], experiences: [], languages: [], projects: [], skills: [],
      },
    },
    tailoredResume: null,
    startedAt: currentTime,
    version: candidateSessionStorageVersion,
  }
}

function createSourceIntakeSession(): CandidateSession {
  const session = createJobMatchSession()
  return {
    ...session,
    phase: 'source-intake',
    sourceIntake: session.sourceIntake === null ? null : {
      ...session.sourceIntake,
      criticalAmbiguities: [{
        candidateFactId: 'source-fact-1',
        id: 'critical-ambiguity-1',
        path: 'experiences.0.role',
        question: 'What was your role?',
      }],
    },
  }
}

function createJobPostingDocument({ mediaType, name }: Readonly<{
  mediaType: string
  name: string
}>) {
  return { bytes: new TextEncoder().encode(jobPostingText), mediaType, name }
}

function hasCompletedJobMatch({ view }: Readonly<{ view: CandidateJourneyView }>) {
  return view.status === 'candidate-session-open' && view.session.jobMatch !== null
}

function isReadyForJobMatch({ view }: Readonly<{ view: CandidateJourneyView }>) {
  return view.status === 'candidate-session-open' && view.session.phase === 'job-match'
}

const processingPolicy = {
  provider: 'Example Model Provider',
  purposes: ['Extract professional evidence', 'Analyze Job Posting evidence'],
  retentionPolicy: 'Requests may be retained for abuse monitoring for up to 30 days.',
  storageBehavior: 'Candidate content is not stored for model training.',
  transmittedDataCategories: ['Professional facts', 'Job Posting content'],
  version: '2026-09-29',
} as const

const candidateFacts = [
  { id: 'source-fact-1', path: 'skills.0.name.0', status: 'attested', value: 'TypeScript' },
  { id: 'source-fact-2', path: 'experiences.0.context.0', status: 'attested', value: 'Architecture' },
  { id: 'source-fact-3', path: 'experiences.0.achievements.0', status: 'attested', value: 'Mentor senior engineers' },
  { id: 'source-fact-4', path: 'experiences.0.achievements.1', status: 'attested', value: 'Owned platform strategy' },
  { id: 'source-fact-5', path: 'experiences.0.achievements.2', status: 'attested', value: 'Presented to executive stakeholders' },
] as const

const jobPostingText = [
  'We are hiring a Staff Engineer.',
  'TypeScript expertise is essential.',
  'Strong TypeScript skills are required.',
  'Lead architecture across the organization.',
  'Mentor senior engineers.',
  'Own platform strategy.',
  'Present to executive stakeholders.',
  'Operational risk management is required.',
  'Kubernetes is a plus.',
  'Work from Paris three days per week.',
].join('\n')

const extractedJobPosting = {
  practicalConstraints: [{
    sourceExcerpt: 'Work from Paris three days per week.',
    value: 'Paris three days per week',
  }],
  requirements: [
    createRequirement('1', 'technical-expertise', 'TypeScript', 'critical', 'TypeScript expertise is essential.'),
    createRequirement('2', 'technical-expertise', 'TypeScript', 'critical', 'Strong TypeScript skills are required.'),
    createRequirement('3', 'leadership', 'architecture', 'central', 'Lead architecture across the organization.'),
    createRequirement('4', 'leadership', 'Mentor', 'central', 'Mentor senior engineers.'),
    createRequirement('5', 'strategy', 'platform strategy', 'central', 'Own platform strategy.'),
    createRequirement('6', 'stakeholder-communication', 'executive stakeholders', 'central', 'Present to executive stakeholders.'),
    createRequirement('7', 'operational-risk', 'Operational risk', 'complementary', 'Operational risk management is required.'),
    createRequirement('8', 'technical-expertise', 'Kubernetes', 'critical', 'Kubernetes is a plus.'),
  ],
  targetRole: {
    sourceExcerpt: 'We are hiring a Staff Engineer.',
    value: 'Staff Engineer',
  },
} as const satisfies ExtractedJobPosting

function createRequirement(
  id: string,
  dimension: ExtractedJobPosting['requirements'][number]['capability']['dimension'],
  capabilityName: string,
  importance: ExtractedJobPosting['requirements'][number]['importance'],
  sourceExcerpt: string,
) {
  return {
    capability: { dimension, name: capabilityName },
    id: `job-requirement-${id}`,
    importance,
    importanceRationale: `The posting marks ${capabilityName} as ${importance}.`,
    sourceExcerpt,
    value: capabilityName,
  } as const
}

const frenchAlternativeExcerpt = 'AWS ou GCP est requis.'
const frenchJobPostingText = [
  'Kotlin est obligatoire.', "Rust n'est pas obligatoire.", frenchAlternativeExcerpt,
  'Build reliable services.', 'Develop resilient systems.', 'No degree is required.',
].join('\n')
const frenchJobRequirements = [
  createRequirement('1', 'technical-expertise', 'Kotlin', 'central', 'Kotlin est obligatoire.'),
  createRequirement('2', 'technical-expertise', 'Rust', 'critical', "Rust n'est pas obligatoire."),
  { ...createRequirement('3', 'technical-expertise', 'AWS', 'central', frenchAlternativeExcerpt),
    substitutableGroup: 'cloud-provider' },
  { ...createRequirement('4', 'technical-expertise', 'GCP', 'central', frenchAlternativeExcerpt),
    substitutableGroup: 'cloud-provider' },
  { ...createRequirement('5', 'execution', 'reliable services', 'central', 'Build reliable services.'),
    substitutableGroup: 'service-reliability' },
  { ...createRequirement('6', 'execution', 'resilient systems', 'central', 'Develop resilient systems.'),
    substitutableGroup: 'service-reliability' },
  createRequirement('7', 'technical-expertise', 'No degree is required', 'critical',
    'No degree is required.'),
] as const

const frenchEmphasizedResponsibilityExcerpt =
  'Votre mission principale est de piloter plusieurs équipes produit.'
const genericDutiesExcerpt = 'Define features, ensure quality and collaborate with product managers.'
const emphasizedResponsibilitiesJobPostingText = [
  'Your core mission is to own the payments platform architecture.',
  genericDutiesExcerpt, 'Experience with Kafka.', 'TypeScript is required.', 'Go is a plus.',
  frenchEmphasizedResponsibilityExcerpt, 'La maîtrise de SQL est requise.',
].join('\n')
const emphasizedResponsibilitiesJobRequirements = [
  createRequirement('1', 'ownership', 'payments platform architecture', 'central',
    'Your core mission is to own the payments platform architecture.'),
  createRequirement('2', 'execution',
    'Define features, ensure quality and collaborate with product managers', 'complementary',
    genericDutiesExcerpt),
  createRequirement('3', 'technical-expertise', 'Kafka', 'critical', 'Experience with Kafka.'),
  createRequirement('4', 'technical-expertise', 'TypeScript', 'central', 'TypeScript is required.'),
  createRequirement('5', 'technical-expertise', 'Go', 'central', 'Go is a plus.'),
  createRequirement('6', 'leadership', 'plusieurs équipes produit', 'central',
    frenchEmphasizedResponsibilityExcerpt),
  createRequirement('7', 'technical-expertise', 'SQL', 'complementary',
    'La maîtrise de SQL est requise.'),
] as const

const emptyMatchEvidenceMatcher = { match: () => Promise.resolve({
  ok: true,
  value: { evidence: [], relevance: [] },
} as const) } as const

const unavailableSourceDocumentReader = { read: () => Promise.resolve({
  ok: false,
  error: 'unsupported-document',
} as const) } as const

const unavailableSourceProfileExtractor = { extract: () => Promise.resolve({
  ok: false,
  error: 'source-profile-extraction-unavailable',
} as const) } as const

const matchEvidenceProposal = {
  evidence: [
    createEvidence('1', 'source-fact-1', 'covered', 'TypeScript', 'TypeScript'),
    createEvidence('4', 'source-fact-3', 'covered', 'Mentor', 'Mentor'),
    createEvidence('5', 'source-fact-4', 'covered', 'platform strategy', 'platform strategy'),
    createEvidence('6', 'source-fact-5', 'covered', 'executive stakeholders', 'executive stakeholders'),
  ],
  relevance: [
    createRelevance('1', 'source-fact-1', 'TypeScript', 'TypeScript'),
    createRelevance('4', 'source-fact-3', 'Mentor', 'Mentor'),
    createRelevance('5', 'source-fact-4', 'platform strategy', 'platform strategy'),
    createRelevance('6', 'source-fact-5', 'executive stakeholders', 'executive stakeholders'),
  ],
} as const satisfies MatchEvidenceProposal

const enrichedMatchEvidenceProposal = {
  evidence: [
    ...matchEvidenceProposal.evidence,
    createEvidence('7', 'source-fact-experiences-1-candidate-enrichment-0', 'covered',
      'Operational risk', 'operational risk'),
  ],
  relevance: [
    ...matchEvidenceProposal.relevance,
    createRelevance('7', 'source-fact-experiences-1-candidate-enrichment-0',
      'Operational risk', 'operational risk'),
  ],
} as const satisfies MatchEvidenceProposal

const lowMatchEvidenceProposal = {
  evidence: [createEvidence('1', 'source-fact-1', 'covered', 'TypeScript', 'TypeScript')],
  relevance: [createRelevance('1', 'source-fact-1', 'TypeScript', 'TypeScript')],
} as const satisfies MatchEvidenceProposal

const emptyMatchEvidenceProposal = {
  evidence: [], relevance: [],
} as const satisfies MatchEvidenceProposal

function createEvidence(
  requirementId: string,
  factId: string,
  coverage: MatchEvidenceProposal['evidence'][number]['coverage'],
  requirementTerm: string,
  factTerm: string,
) {
  return {
    coverage,
    factMatches: [{ factId, factTerm, relationship: 'controlled', requirementTerm }],
    requirementId: `job-requirement-${requirementId}`,
  } as const
}

function createRelevance(
  requirementId: string,
  factId: string,
  requirementTerm: string,
  factTerm: string,
) {
  return {
    factMatch: { factId, factTerm, relationship: 'controlled', requirementTerm },
    requirementId: `job-requirement-${requirementId}`,
  } as const
}
