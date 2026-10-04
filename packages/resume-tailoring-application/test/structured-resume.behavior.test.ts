import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyView, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createFakeCandidateJourneyDependencies, createFakeResumeSectionModels, createInMemoryCandidateSessionPersistence,
  testProcessingPolicy } from '@resume-tailoring/application/testing'
import type { CandidateJourneyDependencies } from '@resume-tailoring/application/ports'

describe('Candidate Journey structured resume', () => {
  it('preserves each experience and its evidence through preparation', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectCoherentExperiencesWithProvenance()
  })
  it('groups skill categories and deduplicates items without losing evidence', async () => {
    const system = createSystemUnderTest()
    await system.givenMatchedCandidateSession()

    await system.prepareTailoredResume()

    system.expectGroupedSkillsWithAllSupportingFacts()
  })

})

function createSystemUnderTest() {
  return new StructuredResumeTestSystem()
}

class StructuredResumeTestSystem {
  readonly #journey = createCandidateJourney({ dependencies: createDependencies() })
  #outcome: CandidateJourneyView | null = null

  async givenMatchedCandidateSession() {
    this.#journey.start()
    await this.#expectOpenCandidateSession()
  }

  async prepareTailoredResume() {
    this.#journey.startTailoredResumePreparation()
    await this.#expectTailoredResumePrepared()
    this.#outcome = this.#journey.readView()
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

  expectGroupedSkillsWithAllSupportingFacts() {
    const session = this.#expectPreparedSession()
    expect(session?.tailoredResume?.sections.find(({ section }) => section === 'skills'))
      .toMatchObject({ section: 'skills', groups: [{
        category: { text: 'Front-end', factIds: ['source-fact-skills-0-category-0',
          'source-fact-skills-1-category-0', 'source-fact-skills-2-category-0'] },
        items: [{ text: 'React', factIds: ['source-fact-skills-0-name-0', 'source-fact-skills-2-name-0'] },
          { text: 'TypeScript' }],
      }] })
    expect(session?.sourceIntake?.sourceProfile.skills).toHaveLength(3)
  }

  expectCoherentExperiencesWithProvenance() {
    const session = this.#expectPreparedSession()
    expect(session?.sourceIntake).toEqual(structuredResumeSource)
    expect(session?.tailoredResume?.experiences).toMatchObject([
      { id: 'experiences.0', role: { text: 'Frontend Engineer', factIds: ['source-fact-experiences-0-role-0'] },
        organization: { text: 'Northwind' }, startDate: { text: '2021' }, endDate: { text: '2024' },
        context: { text: 'Customer billing team' }, achievements: [{ text: 'Built accessible billing screens' }] },
      { id: 'experiences.1', role: { text: 'Software Developer' }, organization: { text: 'Contoso' },
        startDate: { text: '2018' }, endDate: { text: '2021' } },
    ])
  }
}

function createMatchedSession(): CandidateSession {
  const startedAt = Date.now()
  return {
    expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000056',
    jobMatch: structuredResumeJobMatch, phase: 'job-match', processingConsent: { grantedAt: startedAt, policy: testProcessingPolicy },
    sourceIntake: structuredResumeSource, tailoredResume: null,
  }
}

function createDependencies(): CandidateJourneyDependencies {
  const session = createMatchedSession()
  return createFakeCandidateJourneyDependencies({
    now: () => session.startedAt,
    resumeSectionModels: createFakeResumeSectionModels(),
    persistence: createInMemoryCandidateSessionPersistence({ session }),
  })
}
