import { describe, expect, it } from 'vitest'

import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import type {
  SourceDocumentReader,
  SourceProfileReview,
  SourceProfileExtractor,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  createControllableCandidateSessionClock,
  createInMemoryCandidateSessionPersistence,
  createTelemetrySpy,
} from '@resume-tailoring/application/resume-tailoring-workflow-testing'

const sessionStartedAt = Date.UTC(2026, 8, 26, 12)
const sessionExpiresAt = Date.UTC(2026, 8, 27, 12)
const sessionIdentifier = 'candidate-session-00000000-0000-4000-8000-000000000008' as const

describe('Source Profile workflow', () => {
  it('imports a text-based Source Document and detects sensitive content locally', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenTextBasedSourceDocument()

    // Action
    await system.importSourceDocument()

    // Then
    system.expectSensitiveContentToBeDetectedBeforeExtraction()
  })

  it('detects inline sensitive labels without treating a long numeric ID as a phone', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenSourceDocumentWithInlineSensitiveLabelsAndNumericIdentifier()

    // Action
    await system.importSourceDocument()

    // Then
    system.expectInlineSensitiveContentToBeRedactedWithoutNumericIdentifier()
  })

  it('rejects an unsupported Source Document with a typed failure', async () => {
    const system = createSystemUnderTest()

    // Given
    system.givenUnsupportedSourceDocument()

    // Action
    await system.importSourceDocument()

    // Then
    system.expectUnsupportedSourceDocumentToBeRejected()
  })

  it('rejects a Source Document import when a Source Profile already exists', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingSourceProfile })

    // Action
    await system.importSourceDocument()

    // Then
    system.expectExistingSourceProfileToPreventImport()
  })

  it('lets the Candidate minimize the exact outgoing professional content', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingSourceProfile })

    // Given
    system.givenOutgoingContentContainsAnUnwantedLine()

    // Action
    await system.removeContentBeforeExtraction()

    // Then
    system.expectOnlyApprovedOutgoingContentToRemain()
  })

  it('records the versioned processing notice confirmed for the session', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingSourceProfile })

    // Given
    system.givenTheCandidateReviewedTheOutgoingContent()

    // Action
    await system.confirmProcessingNotice()

    // Then
    system.expectVersionedProcessingNoticeToBeConfirmed()
  })

  it('extracts atomic facts from only the approved professional content', async () => {
    const system = createSystemUnderTest({ sourceProfile: confirmedSourceProfile })

    // Given
    system.givenTheStructuredModelFindsAtomicFacts()

    // Action
    await system.extractSourceProfile()

    // Then
    system.expectOnlyApprovedContentToProduceExtractedFacts()
  })

  it('confirms one visible extracted fact', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingFactsSourceProfile })

    // Given
    system.givenAnExtractedFactIsVisible()

    // Action
    await system.confirmSourceProfileFact()

    // Then
    system.expectOnlyTheSelectedFactToBeVerified()
  })

  it('confirms a transparent batch of visible extracted facts', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingFactsSourceProfile })

    // Given
    system.givenTwoExtractedFactsAreSelected()

    // Action
    await system.confirmSelectedSourceProfileFacts()

    // Then
    system.expectEverySelectedFactToBeVerified()
  })

  it('rejects one visible extracted fact', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingFactsSourceProfile })

    // Given
    system.givenAnExtractedFactIsVisible()

    // Action
    await system.rejectSourceProfileFact()

    // Then
    system.expectOnlyTheSelectedFactToBeRejected()
  })

  it('creates an immutable correction that supersedes an earlier fact', async () => {
    const system = createSystemUnderTest({ sourceProfile: verifiedFactsSourceProfile })

    // Given
    system.givenAVerifiedFactNeedsCorrection()

    // Action
    await system.correctSourceProfileFact()

    // Then
    system.expectCorrectionToSupersedeTheOriginalFact()
  })

  it('rejects a correction that conflicts with another open fact', async () => {
    const system = createSystemUnderTest({ sourceProfile: correctionConflictSourceProfile })

    // Action
    await system.correctSourceProfileFact()

    // Then
    system.expectConflictingCorrectionToRequireResolution()
  })

  it('resolves conflicting propositions without disturbing unrelated verified facts', async () => {
    const system = createSystemUnderTest({ sourceProfile: conflictingFactsSourceProfile })

    // Given
    system.givenTwoFactsConflictAndAnotherFactIsVerified()

    // Action
    await system.resolveSourceProfileFactConflict()

    // Then
    system.expectConflictToBeResolvedAndUnrelatedFactToRemainUsable()
  })

  it('requires explicit resolution before a conflicting fact can be confirmed', async () => {
    const system = createSystemUnderTest({ sourceProfile: conflictingFactsSourceProfile })

    // Given
    system.givenTwoFactsConflictAndAnotherFactIsVerified()

    // Action
    await system.confirmSourceProfileFact()

    // Then
    system.expectConflictingFactConfirmationToRequireResolution()
  })
})

function createSystemUnderTest({
  sourceProfile,
}: Readonly<{ sourceProfile?: SourceProfileReview }> = {}) {
  return new SourceProfileWorkflowTestSystem(sourceProfile)
}

class SourceProfileWorkflowTestSystem {
  readonly #telemetry = createTelemetrySpy()
  readonly #modelRequests: string[] = []
  readonly #workflow: ResumeTailoringWorkflow
  #actionResult: ResumeTailoringResult<ResumeTailoringView> | undefined
  #documentReadCount = 0
  #extractionResult: Awaited<ReturnType<SourceProfileExtractor['extract']>> = {
    ok: true,
    value: [],
  }
  #documentReadResult: Awaited<ReturnType<SourceDocumentReader['read']>> = {
    ok: true,
    value: [
      'Bakate Example',
      'bakate@example.com · +33 6 12 34 56 78',
      'Senior FullStack Developer at Acme',
      'Built a billing platform with TypeScript.',
      'Address: 12 Rue Exemple, Paris, +33 6 98 76 54 32',
      'Date of birth: 1990-01-01',
      'Nationality: French',
      'https://example.com/private-profile',
    ].join('\n'),
  }

  constructor(sourceProfile: SourceProfileReview | undefined) {
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: sessionStartedAt }),
      candidateSessionIdentity: { create: () => ({ ok: true, value: sessionIdentifier }) },
      candidateSessionPersistence: createSourceProfileTestPersistence({ sourceProfile }),
      sourceDocumentReader: { read: () => {
        this.#documentReadCount += 1
        return Promise.resolve(this.#documentReadResult)
      } },
      sourceProfileExtractor: this.#createExtractor(),
      sourceProfileFactIdentity: createSequentialSourceProfileFactIdentity({
        startingIdentifier: (sourceProfile?.facts.length ?? 0) + 1,
      }),
      telemetry: this.#telemetry,
    })
  }

  #createExtractor(): SourceProfileExtractor {
    return { extract: ({ professionalContent }) => {
      this.#modelRequests.push(professionalContent)
      return Promise.resolve(this.#extractionResult)
    } }
  }

  givenTextBasedSourceDocument() {}

  givenSourceDocumentWithInlineSensitiveLabelsAndNumericIdentifier() {
    this.#documentReadResult = {
      ok: true,
      value: [
        'Employee ID: 12345678901234567890',
        'Hyphenated phone: 06-10-10-20-30',
        'Spaced phone: 06 10 10 20 30',
        'Compact phone: 0603020301',
        'Foreign office: 212-555-1234',
        'Contact details — Address: 12 Rue Exemple, Paris',
        'Profile — Date of birth: 1990-01-01',
        'Summary — Nationality: French',
      ].join('\n'),
    }
  }

  givenUnsupportedSourceDocument() {
    this.#documentReadResult = {
      ok: false,
      error: { type: 'unsupported-source-document' },
    }
  }

  givenOutgoingContentContainsAnUnwantedLine() {}

  givenTheCandidateReviewedTheOutgoingContent() {}

  givenTheStructuredModelFindsAtomicFacts() {
    this.#extractionResult = {
      ok: true,
      value: [
        {
          kind: 'experience',
          propositionKey: 'proposition-experience-acme-role',
          value: 'Senior FullStack Developer at Acme',
        },
        {
          kind: 'skill',
          propositionKey: 'proposition-skill-candidate-typescript',
          value: 'TypeScript',
        },
      ],
    }
  }

  givenAnExtractedFactIsVisible() {}

  givenTwoExtractedFactsAreSelected() {}

  givenAVerifiedFactNeedsCorrection() {}

  givenTwoFactsConflictAndAnotherFactIsVerified() {}

  async importSourceDocument() {
    this.#actionResult = await this.#workflow.execute({
      type: 'import-source-document',
      document: {
        bytes: new Uint8Array([37, 80, 68, 70]),
        mediaType: 'application/pdf',
        name: 'resume.pdf',
      },
    })
  }

  async removeContentBeforeExtraction() {
    this.#actionResult = await this.#workflow.execute({
      type: 'update-source-content',
      outgoingContent: 'Senior FullStack Developer at Acme',
    })
  }

  async confirmProcessingNotice() {
    this.#actionResult = await this.#workflow.execute({ type: 'confirm-processing-notice' })
  }

  async extractSourceProfile() {
    this.#actionResult = await this.#workflow.execute({ type: 'extract-source-profile' })
  }

  async confirmSourceProfileFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'confirm-source-fact',
      factId: 'source-fact-1',
    })
  }

  async confirmSelectedSourceProfileFacts() {
    this.#actionResult = await this.#workflow.execute({
      type: 'confirm-source-facts',
      factIds: ['source-fact-1', 'source-fact-2'],
    })
  }

  async rejectSourceProfileFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'reject-source-fact',
      factId: 'source-fact-1',
    })
  }

  async correctSourceProfileFact() {
    this.#actionResult = await this.#workflow.execute({
      type: 'correct-source-fact',
      factId: 'source-fact-1',
      correctedValue: 'Staff FullStack Developer at Acme',
    })
  }

  async resolveSourceProfileFactConflict() {
    this.#actionResult = await this.#workflow.execute({
      type: 'resolve-source-fact-conflict',
      selectedFactId: 'source-fact-2',
    })
  }

  expectSensitiveContentToBeDetectedBeforeExtraction() {
    expect(this.#readActionResult()).toEqual(expectedImportedSourceProfileResult)
    expect(this.#modelRequests).toEqual([])
  }

  expectInlineSensitiveContentToBeRedactedWithoutNumericIdentifier() {
    expect(this.#readReadySourceProfile()).toMatchObject({
      detectedSensitiveContent: [
        { kind: 'phone', value: '06-10-10-20-30' },
        { kind: 'phone', value: '06 10 10 20 30' },
        { kind: 'phone', value: '0603020301' },
        { kind: 'address', value: 'Address: 12 Rue Exemple, Paris' },
        { kind: 'date-of-birth', value: 'Date of birth: 1990-01-01' },
        { kind: 'personal-information', value: 'Nationality: French' },
      ],
      outgoingContent: [
        'Employee ID: 12345678901234567890',
        'Hyphenated phone: ',
        'Spaced phone: ',
        'Compact phone: ',
        'Foreign office: 212-555-1234',
        'Contact details — ',
        'Profile — ',
        'Summary — ',
      ].join('\n'),
    })
  }

  expectUnsupportedSourceDocumentToBeRejected() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'unsupported-source-document' },
    })
    expect(this.#modelRequests).toEqual([])
  }

  expectExistingSourceProfileToPreventImport() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'candidate-session-unavailable' },
    })
    expect(this.#documentReadCount).toBe(0)
  }

  expectOnlyApprovedOutgoingContentToRemain() {
    expect(this.#readReadySourceProfile().outgoingContent).toBe(
      'Senior FullStack Developer at Acme',
    )
    expect(this.#modelRequests).toEqual([])
  }

  expectVersionedProcessingNoticeToBeConfirmed() {
    expect(this.#readReadySourceProfile().processingNotice).toEqual({
      version: '2026-09-26',
      confirmedAt: sessionStartedAt,
    })
    expect(this.#modelRequests).toEqual([])
  }

  expectOnlyApprovedContentToProduceExtractedFacts() {
    expect(this.#modelRequests).toEqual([confirmedSourceProfile.outgoingContent])
    expect(this.#readReadySourceProfile()).toMatchObject(expectedExtractedSourceProfile)
  }

  expectOnlyTheSelectedFactToBeVerified() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      { id: 'source-fact-1', status: 'verified' },
      { id: 'source-fact-2', status: 'extracted' },
    ])
  }

  expectEverySelectedFactToBeVerified() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      { id: 'source-fact-1', status: 'verified' },
      { id: 'source-fact-2', status: 'verified' },
    ])
  }

  expectOnlyTheSelectedFactToBeRejected() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      { id: 'source-fact-1', status: 'rejected' },
      { id: 'source-fact-2', status: 'extracted' },
    ])
  }

  expectCorrectionToSupersedeTheOriginalFact() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      {
        id: 'source-fact-1',
        value: 'Senior FullStack Developer at Acme',
        status: 'superseded',
      },
      { id: 'source-fact-2', status: 'verified' },
      {
        id: 'source-fact-3',
        value: 'Staff FullStack Developer at Acme',
        status: 'verified',
        supersedesFactId: 'source-fact-1',
      },
    ])
  }

  expectConflictingCorrectionToRequireResolution() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'source-fact-conflict' },
    })
  }

  expectConflictToBeResolvedAndUnrelatedFactToRemainUsable() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      { id: 'source-fact-1', status: 'rejected' },
      { id: 'source-fact-2', status: 'verified' },
      { id: 'source-fact-3', status: 'verified' },
    ])
  }

  expectConflictingFactConfirmationToRequireResolution() {
    expect(this.#readActionResult()).toEqual({
      ok: false,
      error: { type: 'source-fact-conflict' },
    })
  }

  #readReadySourceProfile() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok) return reviewingSourceProfile
    expect(result.value.status).toBe('ready')
    if (result.value.status !== 'ready') return reviewingSourceProfile
    expect(result.value.sourceProfile).toBeDefined()
    return result.value.sourceProfile ?? reviewingSourceProfile
  }

  #readActionResult() {
    expect(this.#actionResult).toBeDefined()
    return this.#actionResult ?? { ok: false, error: { type: 'candidate-session-unavailable' } }
  }
}

function createSourceProfileTestPersistence({
  sourceProfile,
}: Readonly<{ sourceProfile: SourceProfileReview | undefined }>) {
  return createInMemoryCandidateSessionPersistence({
    initialState: {
      status: 'ready',
      sessionId: sessionIdentifier,
      expiresAt: sessionExpiresAt,
      ...(sourceProfile === undefined ? {} : { sourceProfile }),
    },
  })
}

const expectedImportedSourceProfileResult = {
  ok: true,
  value: {
    status: 'ready', sessionId: sessionIdentifier, expiresAt: sessionExpiresAt,
    sourceProfile: {
      status: 'reviewing-document', documentName: 'resume.pdf', processingNotice: null, facts: [],
      detectedSensitiveContent: [
        { id: 'sensitive-1', kind: 'email', value: 'bakate@example.com' },
        { id: 'sensitive-2', kind: 'phone', value: '+33 6 12 34 56 78' },
        { id: 'sensitive-3', kind: 'phone', value: '+33 6 98 76 54 32' },
        { id: 'sensitive-4', kind: 'url', value: 'https://example.com/private-profile' },
        { id: 'sensitive-5', kind: 'address', value: 'Address: 12 Rue Exemple, Paris, +33 6 98 76 54 32' },
        { id: 'sensitive-6', kind: 'date-of-birth', value: 'Date of birth: 1990-01-01' },
        { id: 'sensitive-7', kind: 'personal-information', value: 'Nationality: French' },
      ],
      outgoingContent: [
        'Bakate Example', ' · ', 'Senior FullStack Developer at Acme',
        'Built a billing platform with TypeScript.', '', '', '', '',
      ].join('\n'),
    },
  },
} as const

const expectedExtractedSourceProfile = {
  status: 'reviewing-facts',
  facts: [
    {
      id: 'source-fact-1', kind: 'experience',
      propositionKey: 'proposition-experience-acme-role',
      value: 'Senior FullStack Developer at Acme', status: 'extracted',
    },
    {
      id: 'source-fact-2', kind: 'skill',
      propositionKey: 'proposition-skill-candidate-typescript',
      value: 'TypeScript', status: 'extracted',
    },
  ],
} as const

const reviewingSourceProfile = {
  status: 'reviewing-document',
  documentName: 'resume.pdf',
  detectedSensitiveContent: [],
  outgoingContent: [
    'Senior FullStack Developer at Acme',
    'Personal hobby: marathon running',
  ].join('\n'),
  processingNotice: null,
  facts: [],
} as const satisfies SourceProfileReview

const confirmedSourceProfile = {
  ...reviewingSourceProfile,
  processingNotice: {
    version: '2026-09-26',
    confirmedAt: sessionStartedAt,
  },
} as const satisfies SourceProfileReview

function createSequentialSourceProfileFactIdentity({
  startingIdentifier,
}: Readonly<{ startingIdentifier: number }>) {
  let nextIdentifier = startingIdentifier
  return {
    create: () => {
      const identifier = `source-fact-${String(nextIdentifier)}` as const
      nextIdentifier += 1
      return { ok: true, value: identifier } as const
    },
  }
}

const reviewingFactsSourceProfile = {
  ...confirmedSourceProfile,
  status: 'reviewing-facts',
  facts: [
    {
      id: 'source-fact-1',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-role',
      value: 'Senior FullStack Developer at Acme',
      status: 'extracted',
    },
    {
      id: 'source-fact-2',
      kind: 'skill',
      propositionKey: 'proposition-skill-candidate-typescript',
      value: 'TypeScript',
      status: 'extracted',
    },
  ],
} as const satisfies SourceProfileReview

const verifiedFactsSourceProfile = {
  ...reviewingFactsSourceProfile,
  facts: reviewingFactsSourceProfile.facts.map((fact) => ({
    ...fact,
    status: 'verified' as const,
  })),
} as const satisfies SourceProfileReview

const correctionConflictSourceProfile = {
  ...verifiedFactsSourceProfile,
  facts: [
    {
      id: 'source-fact-1',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-role',
      value: 'Senior FullStack Developer at Acme',
      status: 'verified',
    },
    {
      id: 'source-fact-2',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-role',
      value: 'Principal FullStack Developer at Acme',
      status: 'extracted',
    },
  ],
} as const satisfies SourceProfileReview

const conflictingFactsSourceProfile = {
  ...reviewingFactsSourceProfile,
  facts: [
    {
      id: 'source-fact-1',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-start-date',
      value: '2021',
      status: 'extracted',
    },
    {
      id: 'source-fact-2',
      kind: 'experience',
      propositionKey: 'proposition-experience-acme-start-date',
      value: '2022',
      status: 'extracted',
    },
    {
      id: 'source-fact-3',
      kind: 'skill',
      propositionKey: 'proposition-skill-candidate-typescript',
      value: 'TypeScript',
      status: 'verified',
    },
  ],
} as const satisfies SourceProfileReview
