import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
  createCandidateJourney,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { structuredResumeJobMatch } from '@resume-tailoring/application/structured-resume-fixtures'
import {
  createFakeCandidateJourneyDependencies,
  createFakeResumeSectionModels,
  createInMemoryCandidateSessionPersistence,
  testProcessingPolicy,
} from '@resume-tailoring/application/testing'

const startedAt = Date.UTC(2026, 9, 8, 9)
const rawSourceDocumentText = 'Alex Morgan. Frontend Engineer at Northwind, 2021–2024. Software Developer at Contoso, 2018–2021.'

describe('Candidate Journey keeps only what it needs in the Candidate Session', () => {
  it('stores no raw Source Document text once the Source Profile is extracted', async () => {
    const system = createSystemUnderTest()
    await system.givenOpenCandidateSession()

    await system.prepareTailoredResume()

    system.expectNoRawSourceDocumentTextStored()
  })

  it('stores the prepared Tailored Resume without the preparation copies or Resume Section drafts', async () => {
    const system = createSystemUnderTest()
    await system.givenOpenCandidateSession()

    await system.prepareTailoredResume()

    system.expectOnlyThePublishedResultStored()
  })

  it('still reuses the Source Profile for another Job Posting once the preparation copies are dropped', async () => {
    const system = createSystemUnderTest()
    await system.givenOpenCandidateSession()
    await system.prepareTailoredResume()

    await system.prepareForAnotherJobPosting()

    system.expectPreparedAgainFromTheStoredSourceProfile()
  })
})

function createSystemUnderTest() {
  return new CandidateSessionMinimizationTestSystem()
}

class CandidateSessionMinimizationTestSystem {
  readonly #persistence = createInMemoryCandidateSessionPersistence({ session: createConsentedSession() })
  readonly #journey: CandidateJourney
  #extractions = 0

  constructor() {
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      now: () => startedAt,
      persistence: this.#persistence,
      resumeSectionModels: createFakeResumeSectionModels(),
      sourceDocumentReader: { read: ({ bytes }) => {
        this.#extractions += 1
        return Promise.resolve({ ok: true, value: { pageCount: null, text: new TextDecoder().decode(bytes) } })
      } },
    }) })
  }

  async givenOpenCandidateSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async prepareTailoredResume() {
    this.#journey.startTailoredResumePreparation({ sourceDocument: documentFromText(rawSourceDocumentText),
      jobPosting: documentFromText(structuredResumeJobMatch.jobPosting.originalContent) })
    await this.#expectPreparedRevisionChanged(null)
  }

  async prepareForAnotherJobPosting() {
    const revision = this.#readStoredSession().preparedResumeRevision ?? null
    this.#journey.startTailoredResumePreparation({ jobPosting: documentFromText(`${structuredResumeJobMatch.jobPosting.originalContent} Remote.`) })
    await this.#expectPreparedRevisionChanged(revision)
  }

  expectNoRawSourceDocumentTextStored() {
    const stored = this.#readStoredSession()
    expect(stored.sourceIntake).not.toBeNull()
    expect(stored.sourceIntake).not.toHaveProperty('originalContent')
    expect(JSON.stringify(stored)).not.toContain(rawSourceDocumentText)
  }

  expectOnlyThePublishedResultStored() {
    const stored = this.#readStoredSession()
    expect(stored.tailoredResume).not.toBeNull()
    expect(stored.jobMatch).not.toBeNull()
    expect(stored.preparation).toMatchObject({ status: 'prepared', sourceIntake: null, jobMatch: null, sourceDocument: null })
    expect(stored.preparation).not.toHaveProperty('sections')
  }

  expectPreparedAgainFromTheStoredSourceProfile() {
    const stored = this.#readStoredSession()
    expect(this.#extractions).toBe(1)
    expect(stored.preparedResumeStatus).toBe('current')
    expect(stored.jobMatch?.jobPosting.originalContent).toContain('Remote.')
    expect(stored.preparation).toMatchObject({ status: 'prepared', sourceIntake: null, jobMatch: null })
  }

  async #expectPreparedRevisionChanged(previous: string | null) {
    await expect.poll(() => {
      const stored = this.#persistence.readStoredSession()
      return stored?.preparation?.status === 'prepared' && stored.preparedResumeRevision !== previous
    }).toBe(true)
  }

  #readStoredSession(): CandidateSession {
    const stored = this.#persistence.readStoredSession()
    if (stored === null) throw new Error('Open a Candidate Session before reading what it stores')
    return stored
  }
}

function createConsentedSession(): CandidateSession {
  return { expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    sessionId: 'candidate-session-00000000-0000-4000-8000-000000000148', version: candidateSessionStorageVersion,
    phase: 'source-intake', processingConsent: { grantedAt: startedAt, policy: testProcessingPolicy },
    sourceIntake: null, jobMatch: null, tailoredResume: null }
}

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'pasted.txt' }
}
