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

  it('collectively attests Candidate Facts from the approved professional content', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingSourceProfile })

    // Given
    system.givenTheStructuredModelFindsAtomicFacts()

    // Action
    await system.confirmProcessingAndExtractSourceProfile()

    // Then
    system.expectOnlyApprovedContentToProduceCollectivelyAttestedFacts()
  })

  it('isolates conflicting propositions without withholding unrelated Candidate Facts', async () => {
    const system = createSystemUnderTest({ sourceProfile: confirmedSourceProfile })

    // Given
    system.givenTheStructuredModelFindsAConflictAndAnUnrelatedFact()

    // Action
    await system.extractSourceProfile()

    // Then
    system.expectOnlyTheConflictingFactsToRequireCorrection()
  })

  it('excludes only a critically ambiguous fact from collective attestation', async () => {
    const system = createSystemUnderTest({ sourceProfile: confirmedSourceProfile })

    // Given
    system.givenTheStructuredModelFindsAUsableAndCriticallyAmbiguousFact()

    // Action
    await system.extractSourceProfile()

    // Then
    system.expectOnlyTheUsableFactToRemain()
  })

  it('reuses the current Processing Consent for later model operations', async () => {
    const system = createSystemUnderTest({ sourceProfile: confirmedSourceProfile })

    // Action
    await system.reviewJobPosting()

    // Then
    system.expectJobPostingProcessingToReuseCandidateSessionConsent()
  })

  it('does not reuse Processing Consent from an earlier notice version', async () => {
    const system = createSystemUnderTest({ sourceProfile: previousConsentFactsSourceProfile })

    // Action
    await system.reviewJobPosting()

    // Then
    system.expectJobPostingProcessingToRequireCurrentConsent()
  })

  it('collectively attests non-conflicting facts restored from an interrupted session', async () => {
    const system = createSystemUnderTest({ sourceProfile: reviewingFactsSourceProfile })

    // Action
    await system.readSourceProfile()

    // Then
    await system.expectEveryRestoredFactToBeCollectivelyAttestedAndPersisted()
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

})

function createSystemUnderTest({
  sourceProfile,
}: Readonly<{ sourceProfile?: SourceProfileReview }> = {}) {
  return new SourceProfileWorkflowTestSystem(sourceProfile)
}

class SourceProfileWorkflowTestSystem {
  readonly #telemetry = createTelemetrySpy()
  readonly #modelRequests: string[] = []
  readonly #persistence: ReturnType<typeof createInMemoryCandidateSessionPersistence>
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
    this.#persistence = createSourceProfileTestPersistence({ sourceProfile })
    this.#workflow = createResumeTailoringWorkflow({
      candidateSessionClock: createControllableCandidateSessionClock({ now: sessionStartedAt }),
      candidateSessionIdentity: { create: () => ({ ok: true, value: sessionIdentifier }) },
      candidateSessionPersistence: this.#persistence,
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
          assessment: 'usable',
          kind: 'experience',
          propositionKey: 'proposition-experience-acme-role',
          value: 'Senior FullStack Developer at Acme',
        },
        {
          assessment: 'usable',
          kind: 'skill',
          propositionKey: 'proposition-skill-candidate-typescript',
          value: 'TypeScript',
        },
      ],
    }
  }

  givenTheStructuredModelFindsAConflictAndAnUnrelatedFact() {
    this.#extractionResult = {
      ok: true,
      value: [
        {
          assessment: 'usable',
          kind: 'experience',
          propositionKey: 'proposition-experience-acme-start-date',
          value: '2021',
        },
        {
          assessment: 'usable',
          kind: 'experience',
          propositionKey: 'proposition-experience-acme-start-date',
          value: '2022',
        },
        {
          assessment: 'usable',
          kind: 'skill',
          propositionKey: 'proposition-skill-candidate-typescript',
          value: 'TypeScript',
        },
      ],
    }
  }

  givenTheStructuredModelFindsAUsableAndCriticallyAmbiguousFact() {
    this.#extractionResult = {
      ok: true,
      value: [
        {
          assessment: 'critical-ambiguity',
          kind: 'experience',
          propositionKey: 'proposition-experience-acme-start-date',
          value: 'Started at Acme around 2021 or 2022',
        },
        {
          assessment: 'usable',
          kind: 'skill',
          propositionKey: 'proposition-skill-candidate-typescript',
          value: 'TypeScript',
        },
      ],
    }
  }

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

  async confirmProcessingAndExtractSourceProfile() {
    this.#actionResult = await this.#workflow.execute({
      type: 'confirm-processing-and-extract-source-profile',
    })
  }

  async reviewJobPosting() {
    this.#actionResult = await this.#workflow.execute({
      type: 'review-job-posting',
      content: 'Senior TypeScript Developer in Paris',
    })
  }

  async readSourceProfile() {
    this.#actionResult = await this.#workflow.readView()
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
      version: '2026-09-28',
      confirmedAt: sessionStartedAt,
    })
    expect(this.#modelRequests).toEqual([])
  }

  expectOnlyApprovedContentToProduceCollectivelyAttestedFacts() {
    expect(this.#modelRequests).toEqual([reviewingSourceProfile.outgoingContent])
    expect(this.#readReadySourceProfile()).toMatchObject(expectedExtractedSourceProfile)
    expect(this.#readReadySourceProfile().processingNotice).toEqual({
      version: '2026-09-28',
      confirmedAt: sessionStartedAt,
    })
  }

  expectOnlyTheConflictingFactsToRequireCorrection() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      { id: 'source-fact-1', status: 'extracted' },
      { id: 'source-fact-2', status: 'extracted' },
      { id: 'source-fact-3', status: 'verified' },
    ])
  }

  expectOnlyTheUsableFactToRemain() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      { kind: 'skill', status: 'verified', value: 'TypeScript' },
    ])
  }

  expectJobPostingProcessingToReuseCandidateSessionConsent() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return
    expect(result.value.jobPosting?.processingNotice).toEqual({
      provider: 'OpenAI',
      transmittedDataCategories: ['job-posting-content'],
      retentionPolicy: 'standard-abuse-monitoring',
      version: '2026-09-26',
      confirmedAt: sessionStartedAt,
    })
  }

  expectJobPostingProcessingToRequireCurrentConsent() {
    const result = this.#readActionResult()
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.status !== 'ready') return
    expect(result.value.sourceProfile).toMatchObject({
      status: 'reviewing-document',
      processingNotice: null,
      facts: [],
    })
    expect(result.value.jobPosting?.processingNotice).toBeNull()
  }

  async expectEveryRestoredFactToBeCollectivelyAttestedAndPersisted() {
    expect(this.#readReadySourceProfile().facts).toMatchObject([
      { id: 'source-fact-1', status: 'verified' },
      { id: 'source-fact-2', status: 'verified' },
    ])
    const persistedState = await this.#persistence.read()
    expect(persistedState.ok).toBe(true)
    if (!persistedState.ok || persistedState.value.status !== 'ready') return
    expect(persistedState.value.sourceProfile?.facts).toMatchObject([
      { id: 'source-fact-1', status: 'verified' },
      { id: 'source-fact-2', status: 'verified' },
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
      value: 'Senior FullStack Developer at Acme', status: 'verified',
    },
    {
      id: 'source-fact-2', kind: 'skill',
      propositionKey: 'proposition-skill-candidate-typescript',
      value: 'TypeScript', status: 'verified',
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
    version: '2026-09-28',
    confirmedAt: sessionStartedAt,
  },
} as const satisfies SourceProfileReview

const previousConsentSourceProfile = {
  ...confirmedSourceProfile,
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

const previousConsentFactsSourceProfile = {
  ...verifiedFactsSourceProfile,
  processingNotice: previousConsentSourceProfile.processingNotice,
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
