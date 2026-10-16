import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView } from '@resume-tailoring/application/candidate-journey'
import { createFakeCandidateJourneyDependencies } from '@resume-tailoring/application/testing'
import {
  createGatewayJobPostingExtractor,
  createGatewayMatchEvidenceMatcher,
  createGatewayResumeSectionModels,
  createGatewaySourceProfileExtractor,
} from './language-model-gateway-ports'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'

/**
 * Live Tailored Resume preparations, recorded from the real models and anonymized, replayed offline: each route
 * answers with the response it gave then, so preparation rules can change without paying for model calls again.
 */
describe('recorded Tailored Resume preparations replayed offline', () => {
  it.each(readRecordedPreparations())('prepares $id without losing content: $scenario', async (recording) => {
    const system = createSystemUnderTest({ recording })
    await system.givenOpenCandidateSession()

    await system.prepareTailoredResumeFromTheRecordedIntake()

    system.expectPreparedWithEveryWrittenAchievementAndAValueProposition()
  })
})

type RecordedResponse = Readonly<{ path: string; sectionKey: string | null; status: number; body: unknown }>
type RecordedPreparation = Readonly<{
  id: string
  scenario: string
  intake: Readonly<{ professionalContent: string; jobPostingContent: string }>
  responses: readonly RecordedResponse[]
}>

const recordingsDirectory = new URL('./recorded-preparations/', import.meta.url)

function readRecordedPreparations(): RecordedPreparation[] {
  return readdirSync(recordingsDirectory).filter((name) => name.endsWith('.json')).sort()
    .map((name) => JSON.parse(readFileSync(new URL(name, recordingsDirectory), 'utf8')) as RecordedPreparation)
}

function createSystemUnderTest({ recording }: Readonly<{ recording: RecordedPreparation }>) {
  return new RecordedPreparationTestSystem(recording)
}

class RecordedPreparationTestSystem {
  readonly #recording: RecordedPreparation
  readonly #journey: CandidateJourney
  readonly #unrecordedCalls: string[] = []
  #outcome: CandidateJourneyView | null = null

  constructor(recording: RecordedPreparation) {
    this.#recording = recording
    const queues = readResponseQueues(recording)
    const request: typeof fetch = (input, init) => {
      const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input
      const path = new URL(url, 'http://recorded.invalid').pathname
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as { section?: { key?: string } } : {}
      const key = readCallKey({ path, sectionKey: body.section?.key ?? null })
      const recorded = queues.get(key)?.shift()
      if (recorded === undefined) {
        this.#unrecordedCalls.push(key)
        return Promise.resolve(Response.json({ ok: false, error: { type: 'transient' } }, { status: 503 }))
      }
      return Promise.resolve(Response.json(recorded.body, { status: recorded.status }))
    }
    let journey: CandidateJourney | null = null
    const languageModelGateway = createOpenAiLanguageModelGateway({ request, readProcessingConsent: () => {
      const view = journey?.readView()
      return view?.status === 'candidate-session-open' ? view.session.processingConsent : null
    } })
    journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      languageModelGateway,
      sourceProfileExtractor: createGatewaySourceProfileExtractor({ languageModelGateway }),
      jobPostingExtractor: createGatewayJobPostingExtractor({ languageModelGateway }),
      matchEvidenceMatcher: createGatewayMatchEvidenceMatcher({ languageModelGateway }),
      resumeSectionModels: createGatewayResumeSectionModels({ languageModelGateway }),
    }) })
    this.#journey = journey
  }

  async givenOpenCandidateSession() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-absent')
    this.#journey.startCandidateSession()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async prepareTailoredResumeFromTheRecordedIntake() {
    const { professionalContent, jobPostingContent } = this.#recording.intake
    this.#journey.startTailoredResumePreparation({ grantProcessingConsent: true,
      sourceDocument: documentFromText(professionalContent), jobPosting: documentFromText(jobPostingContent) })
    await expect.poll(() => {
      const view = this.#journey.readView()
      return view.status === 'candidate-session-open' ? view.operation : 'pending'
    }, { timeout: 10_000 }).toBeNull()
    this.#outcome = this.#journey.readView()
  }

  expectPreparedWithEveryWrittenAchievementAndAValueProposition() {
    const view = this.#expectOutcome()
    expect(this.#unrecordedCalls, 'The preparation asked for a response the recording does not hold').toEqual([])
    expect(view.preparationOutcome).toMatchObject({ status: 'prepared' })
    const resume = view.session.tailoredResume
    expect(resume?.valueProposition.paragraphs.length).toBeGreaterThan(0)
    for (const [key, written] of readLastWrittenAchievements(this.#recording)) {
      const prepared = resume?.experiences.find(({ id }) => id === key)?.achievements ?? []
      expect(prepared.length, `${key} keeps every achievement written for it`).toBe(written)
    }
  }

  #expectOutcome() {
    const view = this.#outcome
    if (view?.status !== 'candidate-session-open') expect.fail('Prepare the recorded Tailored Resume first')
    return view
  }
}

function readResponseQueues(recording: RecordedPreparation) {
  const queues = new Map<string, RecordedResponse[]>()
  for (const response of recording.responses) {
    const key = readCallKey(response)
    queues.set(key, [...queues.get(key) ?? [], response])
  }
  return queues
}

function readCallKey({ path, sectionKey }: Readonly<{ path: string; sectionKey: string | null }>) {
  return sectionKey === null ? path : `${path} ${sectionKey}`
}

/** Achievements of the last experience version written, counted as preparation deduplicates them. */
function readLastWrittenAchievements(recording: RecordedPreparation) {
  const written = new Map<string, number>()
  for (const { path, sectionKey, body } of recording.responses) {
    const experience = (body as { value?: { kind?: string; experience?: { achievements: readonly { text: string }[] } } })
      .value
    if (path !== '/api/resume-section-writing' || sectionKey === null || experience?.kind !== 'experience') continue
    const texts = experience.experience?.achievements.map(({ text }) =>
      text.replaceAll('—', '–').trim().replace(/\s+/gu, ' ').toLocaleLowerCase()) ?? []
    written.set(sectionKey, new Set(texts).size)
  }
  return written
}

function documentFromText(text: string) {
  return { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'recorded.txt' }
}
