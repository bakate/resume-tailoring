import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyDependencies, CandidateSession, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import { groupedResumeDocument, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'

describe('Candidate Journey document rendering', () => {
  it('rejects a late layout when a newer draft was requested', async () => {
    const system = createSystemUnderTest()
    await system.givenAnOlderDraftIsRendering()

    await system.renderCurrentDraft()

    system.expectOnlyCurrentDraftCanBeExported()
  })

  it('keeps the draft revision stable when retrying the same document', async () => {
    const system = createSystemUnderTest()
    await system.givenCurrentDraftWasRendered()

    await system.renderCurrentDraft()

    system.expectSameDraftRevision()
  })

  it('rejects a pending rendering after Candidate Session deletion', async () => {
    const system = createSystemUnderTest()
    await system.givenAnOlderDraftIsRendering()

    await system.deleteCandidateSession()

    system.expectPendingRenderingDiscarded()
  })


  it('rejects a pending rendering after a persisted resume edit', async () => {
    const system = createSystemUnderTest()
    await system.givenAnOlderDraftIsRendering()

    await system.editResumeContacts()

    system.expectPendingRenderingDiscarded()
  })

  it('rejects a pending rendering when preparation inputs become outdated', async () => {
    const system = createSystemUnderTest()
    await system.givenAnOlderDraftIsRendering()

    await system.invalidateResumeInputs()

    system.expectPendingRenderingDiscarded()
  })

  it('keeps the preview of a document whose download waits only for the Candidate name', async () => {
    const system = createSystemUnderTest()
    await system.givenCurrentDraftWasRendered()

    await system.renderDraftWithoutName()

    system.expectPreviewWithoutDownload()
  })

  it('publishes the actual rendered layout on the current editor revision', async () => {
    const system = createSystemUnderTest()
    await system.givenCurrentDraftWasRendered()

    await system.renderCurrentDraft()

    system.expectCurrentEditorLayout()
  })

  it('includes the selected photo when checking the current editor layout', async () => {
    const system = createSystemUnderTest()
    await system.givenCurrentDraftWasRendered()

    await system.assessLayoutWithPhoto()

    system.expectPhotoIncludedInCurrentLayout()
  })

  it('includes the selected photo when measuring a condensation proposal', async () => {
    const system = createSystemUnderTest()
    await system.givenCondensationIsAvailable()

    await system.proposeCondensationWithPhoto()

    system.expectPhotoIncludedInProposalLayout()
  })

  it('preserves the source and draft when rendering fails', async () => {
    const system = createSystemUnderTest()
    await system.givenRenderingIsUnavailable()

    await system.renderCurrentDraft()

    system.expectDraftPreservedForRetry()
  })
})

function createSystemUnderTest() {
  let settlePrevious: ((result: ResumeRenderResult) => void) | undefined
  let previous: Promise<ResumeRenderResult> | undefined
  let result: ResumeRenderResult | undefined
  let previousResult: ResumeRenderResult | undefined
  let initialRevision: string | undefined
  let unavailable = false
  const session = createSession()
  const journey = createCandidateJourney({ dependencies: {
    ...unusedDependencies,
    now: () => 1000,
    persistence: { restore: () => ({ ok: true, value: { notice: null, session } }),
      save: ({ session: nextSession }) => ({ ok: true, value: nextSession }),
      delete: () => ({ ok: true, value: null }) },
    resumeDocumentPorts: { proposeCondensation: ({ document, baseRevision }) => Promise.resolve({ status: 'proposed',
      proposal: { id: 'photo-proposal', document, baseRevision, layout: { status: 'unavailable', revision: baseRevision } } }) },
    resumeDocumentRenderer: { render: ({ draft, photoDataUrl }) => {
      if (photoDataUrl !== undefined) return Promise.resolve({ pdf: null, assessment: {
        layout: { status: 'overflow', revision: draft.revision, pageCount: 3 },
        exportEligibility: { status: 'blocked', revision: draft.revision, reasons: ['overflow'] },
      } })
      if (draft.document.identity?.value === 'Old Alex') return new Promise((resolve) => { settlePrevious = resolve })
      return Promise.resolve(unavailable ? { ...failedResult, assessment: { layout: { status: 'unavailable', revision: draft.revision }, exportEligibility: { status: 'blocked', revision: draft.revision, reasons: ['layout-unavailable'] } } } : successfulResult({ revision: draft.revision }))
    } },
  } })
  const start = async () => { journey.start(); await Promise.resolve(); await Promise.resolve() }
  return {
    givenAnOlderDraftIsRendering: async () => { await start()
      previous = journey.renderResumeDocument({ document: { ...groupedResumeDocument, identity: { kind: 'personal-information', value: 'Old Alex' } }, unsupportedFieldIds: [] }) },
    givenCurrentDraftWasRendered: async () => {
      await start()
      initialRevision = (await journey.renderResumeDocument({ document: groupedResumeDocument,
        unsupportedFieldIds: [] })).assessment.layout.revision
    },
    givenCondensationIsAvailable: async () => {
      await start()
      journey.grantProcessingConsent()
      await Promise.resolve()
      await Promise.resolve()
    },
    assessLayoutWithPhoto: () => journey.assessResumeLayout({ photoDataUrl: 'data:image/png;base64,photo' }),
    proposeCondensationWithPhoto: () => journey.proposeResumeCondensation({ photoDataUrl: 'data:image/png;base64,photo' }),
    expectPhotoIncludedInCurrentLayout: () => {
      const view = journey.readView()
      const assessment = view.status === 'candidate-session-open' ? view.resumeReview?.assessment : null
      expect(assessment?.layout).toMatchObject({ status: 'overflow', pageCount: 3 })
      expect(assessment?.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['overflow'] })
    },
    expectPhotoIncludedInProposalLayout: () => {
      const view = journey.readView()
      const proposal = view.status === 'candidate-session-open' ? view.resumeReview?.proposal : null
      expect(proposal?.layout).toMatchObject({ status: 'overflow', pageCount: 3 })
    },
    deleteCandidateSession: async () => {
      journey.deleteCandidateSession()
      settlePrevious?.(successfulResult({ revision: 'old' }))
      previousResult = await previous
    },
    editResumeContacts: async () => {
      journey.updateResumeContacts({ identity: { kind: 'personal-information', value: 'Updated Alex' },
        contactDetails: groupedResumeDocument.contactDetails })
      settlePrevious?.(successfulResult({ revision: 'old' }))
      previousResult = await previous
    },
    invalidateResumeInputs: async () => {
      journey.invalidateResumeInputs()
      settlePrevious?.(successfulResult({ revision: 'old' }))
      previousResult = await previous
    },
    expectCurrentEditorLayout: () => {
      const view = journey.readView()
      const review = view.status === 'candidate-session-open' ? view.resumeReview : null
      expect(review).not.toBeNull()
      expect(review?.assessment?.layout).toEqual({ status: 'fits', pageCount: 1, revision: review?.draft.revision })
      expect(review?.assessment?.exportEligibility).toMatchObject({ status: 'eligible', revision: review?.draft.revision })
    },
    expectPendingRenderingDiscarded: () => {
      expect(previousResult, 'a pending rendering must have been invalidated').toBeDefined()
      expect(previousResult?.pdf).toBeNull()
      expect(previousResult?.assessment.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['stale-layout'] })
    },
    expectSameDraftRevision: () => {
      expect(result, 'renderCurrentDraft must run first').toBeDefined()
      expect(initialRevision).toBeDefined()
      expect(result?.assessment.layout.revision).toBe(initialRevision)
    },
    givenRenderingIsUnavailable: async () => { unavailable = true; await start() },
    renderCurrentDraft: async () => {
      result = await journey.renderResumeDocument({ document: groupedResumeDocument, unsupportedFieldIds: [] })
      settlePrevious?.(successfulResult({ revision: 'old' }))
      previousResult = await previous
    },
    renderDraftWithoutName: async () => {
      result = await journey.renderResumeDocument({ document: { ...groupedResumeDocument, identity: null }, unsupportedFieldIds: [] })
    },
    expectPreviewWithoutDownload: () => {
      expect(result, 'renderDraftWithoutName must run first').toBeDefined()
      expect(result?.pdf, 'A missing name never hides the preview').not.toBeNull()
      expect(result?.assessment.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['missing-identity'] })
    },
    expectOnlyCurrentDraftCanBeExported: () => {
      expect(result, 'renderCurrentDraft must run first').toBeDefined()
      expect(result?.assessment.exportEligibility.status).toBe('eligible')
      expect(previousResult?.pdf).toBeNull()
      expect(previousResult?.assessment.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['stale-layout'] })
    },
    expectDraftPreservedForRetry: () => {
      expect(result, 'renderCurrentDraft must run first').toBeDefined()
      expect(result?.assessment.layout.status).toBe('unavailable')
      const view = journey.readView()
      expect(view.status === 'candidate-session-open' ? view.session : null).toEqual(session)
    },
  }
}

function successfulResult({ revision }: Readonly<{ revision: string }>): ResumeRenderResult {
  return { assessment: { layout: { status: 'fits', revision, pageCount: 1 },
    exportEligibility: { status: 'eligible', revision, pageCount: 1 } }, pdf: new Uint8Array([37, 80, 68, 70, 45]) }
}

const failedResult: ResumeRenderResult = { assessment: { layout: { status: 'unavailable', revision: 'current' },
  exportEligibility: { status: 'blocked', revision: 'current', reasons: ['layout-unavailable'] } }, pdf: null }

function createSession(): CandidateSession {
  return { expiresAt: 1000 + candidateSessionDurationMilliseconds, startedAt: 1000,
    sessionId: 'candidate-session-fixture' as const, version: candidateSessionStorageVersion,
    phase: 'tailored-resume-preparation' as const, processingConsent: null,
    sourceIntake: structuredResumeSource, jobMatch: structuredResumeJobMatch, tailoredResume: groupedResumeDocument }
}

const unusedDependencies = {
  createSessionId: () => 'fixture',
  languageModelGateway: { processingPolicy: { version: 'test', provider: 'Test provider', purposes: [],
    transmittedDataCategories: [], retentionPolicy: 'None', storageBehavior: 'None' } },
  jobPostingDocumentReader: { read: () => Promise.resolve({ ok: false, error: 'unsupported-job-posting' }) },
  jobPostingExtractor: { extract: () => Promise.resolve({ ok: false, error: 'job-posting-extraction-unavailable' }) },
  matchEvidenceMatcher: { match: () => Promise.resolve({ ok: false, error: 'match-evidence-unavailable' }) },
  sourceDocumentReader: { read: () => Promise.resolve({ ok: false, error: 'unsupported-document' }) },
  sourceProfileExtractor: { extract: () => Promise.resolve({ ok: false, error: 'source-profile-extraction-unavailable' }) },
} satisfies Omit<CandidateJourneyDependencies, 'now' | 'persistence'>
