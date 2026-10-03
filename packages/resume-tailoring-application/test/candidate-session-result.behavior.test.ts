import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyDependencies, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { createFixtureResumeSectionModels, structuredResumeJobMatch, structuredResumeSource, writeResumeSectionFromFacts } from '@resume-tailoring/application/structured-resume-fixtures'

describe('Candidate Session result', () => {
  it('keeps the resume photo in the Candidate Session after reopening it', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedResume()

    await system.choosePhotoAndReopen()

    system.expectPhotoRestored()
  })

  it('forgets the resume photo once it is removed', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedResume()
    await system.choosePhotoAndReopen()

    await system.removePhotoAndReopen()

    system.expectNoPhoto()
  })

  it('forgets the Job Posting and keeps the analyzed Source Profile and the Tailored Resume when the posting changes', async () => {
    const system = createSystemUnderTest()
    await system.givenPreparedResume()

    await system.changeJobPostingAndReopen()

    system.expectJobPostingClearedAndResumeKept()
  })
})

function createSystemUnderTest() {
  return new CandidateSessionResultSystem()
}

const photo = { dataUrl: 'data:image/png;base64,iVBORw0KGgo=', name: 'portrait.png' } as const
const storedPosting = { data: btoa('Frontend Engineer. React is required.'), mediaType: 'text/plain', name: 'pasted.txt' } as const

class CandidateSessionResultSystem {
  readonly #dependencies = createDependencies()
  #journey = createCandidateJourney({ dependencies: this.#dependencies })
  #preparedResume: CandidateSession['tailoredResume'] = null
  #reopened: CandidateSession | null = null

  async givenPreparedResume() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
    this.#journey.grantProcessingConsent()
    await expect.poll(() => this.#readSession()?.processingConsent ?? null).not.toBeNull()
    this.#journey.startTailoredResumePreparation()
    await expect.poll(() => this.#readSession()?.tailoredResume ?? null).not.toBeNull()
    this.#preparedResume = this.#readSession()?.tailoredResume ?? null
  }

  async choosePhotoAndReopen() {
    this.#journey.updateResumePhoto(photo)
    await this.#reopen()
  }

  async removePhotoAndReopen() {
    this.#journey.updateResumePhoto(null)
    await this.#reopen()
  }

  async changeJobPostingAndReopen() {
    this.#journey.changeJobPosting()
    await this.#reopen()
  }

  expectPhotoRestored() {
    expect(this.#expectReopened().resumePhoto).toEqual(photo)
  }

  expectNoPhoto() {
    expect(this.#expectReopened().resumePhoto).toBeUndefined()
  }

  expectJobPostingClearedAndResumeKept() {
    const session = this.#expectReopened()
    expect(session.preparation?.jobPosting).toBeNull()
    expect(session.preparation?.sourceIntake).toEqual(structuredResumeSource)
    expect(session.tailoredResume).toEqual(this.#preparedResume)
    expect(session.preparedResumeStatus).not.toBe('outdated')
  }

  async #reopen() {
    this.#journey = createCandidateJourney({ dependencies: this.#dependencies })
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
    this.#reopened = this.#readSession()
  }

  #expectReopened() {
    expect(this.#reopened, 'Reopen the Candidate Session before reading it').not.toBeNull()
    if (this.#reopened === null) throw new Error('Candidate Session not reopened')
    return this.#reopened
  }

  #readSession() {
    const view = this.#journey.readView()
    return view.status === 'candidate-session-open' ? view.session : null
  }
}

function createMatchedSession(): CandidateSession {
  const startedAt = Date.now()
  return {
    expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000081',
    jobMatch: structuredResumeJobMatch, phase: 'job-match', processingConsent: null,
    sourceIntake: structuredResumeSource, tailoredResume: null,
    preparation: { revision: 'previous', status: 'outdated', sourceDocument: null, jobPosting: storedPosting, locale: null,
      purpose: 'tailored', sourceIntake: structuredResumeSource, jobMatch: structuredResumeJobMatch, failure: null },
  }
}

function createDependencies(): CandidateJourneyDependencies {
  let session = createMatchedSession()
  return {
    resumeSectionModels: createFixtureResumeSectionModels({
      writeSection: (input) => Promise.resolve({ ok: true, value: writeResumeSectionFromFacts(input) }),
    }),
    createSessionId: () => crypto.randomUUID(), now: () => session.startedAt,
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
