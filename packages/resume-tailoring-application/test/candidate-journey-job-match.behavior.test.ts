import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  createCandidateJourney,
} from '@resume-tailoring/application/candidate-journey'
import type {
  CandidateJourney,
  CandidateJourneyView,
  CandidateSession,
  CandidateSessionPersistence,
} from '@resume-tailoring/application/candidate-journey'
import type {
  ExtractedJobPosting,
  JobPostingDocumentReader,
  MatchEvidenceProposal,
} from '@resume-tailoring/application/job-match'

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
})

function createSystemUnderTest() {
  return new CandidateJourneyJobMatchTestSystem()
}

class CandidateJourneyJobMatchTestSystem {
  readonly #candidateJourney: CandidateJourney
  #extractedJobPosting: ExtractedJobPosting = extractedJobPosting
  #completedAction: 'job-posting-submitted' | null = null
  #view: CandidateJourneyView | null = null

  constructor() {
    this.#candidateJourney = createCandidateJourney({
      dependencies: {
        createSessionId: () => '00000000-0000-4000-8000-000000000042',
        jobPostingDocumentReader: createJobPostingDocumentReader(),
        jobPostingExtractor: { extract: () => Promise.resolve({
          ok: true,
          value: this.#extractedJobPosting,
        }) },
        languageModelGateway: { processingPolicy },
        matchEvidenceMatcher: { match: () => Promise.resolve({
          ok: true,
          value: matchEvidenceProposal,
        }) },
        now: () => currentTime,
        persistence: createInMemoryPersistence({ storedSession: createJobMatchSession() }),
        sourceDocumentReader: { read: () => Promise.resolve({
          ok: false,
          error: 'unsupported-document',
        }) },
        sourceProfileExtractor: { extract: () => Promise.resolve({
          ok: false,
          error: 'source-profile-extraction-unavailable',
        }) },
      },
    })
  }

  async givenCandidateJourneyIsReadyForJobMatch() {
    this.#candidateJourney.start()
    await this.#waitForReadyJobMatch()
  }

  async givenAStableMatchAnalysisExists() {
    this.#candidateJourney.submitJobPosting(createJobPostingDocument({
      mediaType: 'text/plain', name: 'stable-job-posting.txt',
    }))
    await this.#waitForCompletedJobMatch()
  }

  givenExtractionContainsAnInventedExcerpt() {
    this.#extractedJobPosting = {
      ...extractedJobPosting,
      targetRole: { sourceExcerpt: 'Invented role title', value: 'Invented role' },
    }
  }

  async submitPastedJobPosting() {
    this.#candidateJourney.submitJobPosting(createJobPostingDocument({
      mediaType: 'text/plain',
      name: 'pasted-job-posting.txt',
    }))
    this.#view = await this.#waitForCompletedJobMatch()
    this.#completedAction = 'job-posting-submitted'
  }

  async submitUploadedJobPosting({ mediaType, name }: Readonly<{
    mediaType: string
    name: string
  }>) {
    this.#candidateJourney.submitJobPosting(createJobPostingDocument({ mediaType, name }))
    this.#view = await this.#waitForCompletedJobMatch()
    this.#completedAction = 'job-posting-submitted'
  }

  async replaceJobPostingWithInvalidExtraction() {
    this.#candidateJourney.submitJobPosting(createJobPostingDocument({
      mediaType: 'text/plain', name: 'replacement.txt',
    }))
    this.#view = await this.#waitForJobMatchFailure()
    this.#completedAction = 'job-posting-submitted'
  }

  expectExplainableMatchAnalysis() {
    this.#expectCompletedAction()
    const jobMatch = this.#readOpenView().session.jobMatch
    expect(jobMatch).not.toBeNull()
    expect(jobMatch?.targetRole).toEqual({
      sourceExcerpt: 'We are hiring a Staff Engineer.',
      value: 'Staff Engineer',
    })
    expect(jobMatch?.analysis).toMatchObject({
      criticalRequirementReserve: { status: 'present' },
      generationEligibility: 'eligible',
      matchBand: 'credible',
      matchBandQualification: 'critical-requirement-reserve',
    })
    expect(jobMatch?.strengthRequirementIds).toHaveLength(3)
    expect(jobMatch?.priorityGapRequirementIds).toHaveLength(3)
    expect(jobMatch?.practicalConstraints).toEqual([{
      sourceExcerpt: 'Work from Paris three days per week.',
      value: 'Paris hybrid, three days per week',
    }])
    expect(jobMatch?.requirements.every(({ sourceExcerpt }) =>
      jobPostingText.includes(sourceExcerpt))).toBe(true)
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

  #expectCompletedAction() {
    expect(this.#completedAction, 'Expected a caller-visible Action before reading the outcome')
      .toBe('job-posting-submitted')
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
}

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
    startedAt: currentTime,
    version: candidateSessionStorageVersion,
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
  { id: 'source-fact-5', path: 'experiences.0.achievements.2', status: 'attested', value: 'Led executive communication' },
] as const

const jobPostingText = [
  'We are hiring a Staff Engineer.',
  'TypeScript expertise is essential.',
  'Strong TypeScript skills are required.',
  'Lead architecture across the organization.',
  'Mentor senior engineers.',
  'Own platform strategy.',
  'Present to executive stakeholders.',
  'Manage operational risk.',
  'Kubernetes is a plus.',
  'Work from Paris three days per week.',
].join('\n')

const extractedJobPosting = {
  practicalConstraints: [{
    sourceExcerpt: 'Work from Paris three days per week.',
    value: 'Paris hybrid, three days per week',
  }],
  requirements: [
    createRequirement('1', 'technical-expertise', 'TypeScript', 'critical', 'TypeScript expertise is essential.'),
    createRequirement('2', 'technical-expertise', 'TypeScript', 'critical', 'Strong TypeScript skills are required.'),
    createRequirement('3', 'leadership', 'Architecture leadership', 'critical', 'Lead architecture across the organization.'),
    createRequirement('4', 'leadership', 'Mentor', 'central', 'Mentor senior engineers.'),
    createRequirement('5', 'strategy', 'platform strategy', 'central', 'Own platform strategy.'),
    createRequirement('6', 'stakeholder-communication', 'Executive communication', 'central', 'Present to executive stakeholders.'),
    createRequirement('7', 'operational-risk', 'Operational risk', 'central', 'Manage operational risk.'),
    createRequirement('8', 'technical-expertise', 'Kubernetes', 'complementary', 'Kubernetes is a plus.'),
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

const matchEvidenceProposal = {
  evidence: [
    createEvidence('1', 'source-fact-1', 'covered', 'TypeScript', 'TypeScript'),
    createEvidence('4', 'source-fact-3', 'covered', 'Mentor', 'Mentor'),
    createEvidence('5', 'source-fact-4', 'covered', 'platform strategy', 'platform strategy'),
    createEvidence('6', 'source-fact-5', 'covered', 'Executive communication', 'executive communication'),
  ],
  relevantFactIds: ['source-fact-1', 'source-fact-3', 'source-fact-4', 'source-fact-5'],
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
