import { describe, expect, it } from 'vitest'
import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion, createCandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourney, CandidateJourneyView, CandidateSession } from '@resume-tailoring/application/candidate-journey'
import type { MatchEvidenceProposal } from '@resume-tailoring/application/job-match'
import type { CandidateJourneyDependencies } from '@resume-tailoring/application/ports'
import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import { createFakeCandidateJourneyDependencies, createFakeJobPostingExtractor, createFakeMatchEvidenceMatcher,
  createInMemoryCandidateSessionPersistence, testProcessingPolicy } from '@resume-tailoring/application/testing'

describe('Candidate Journey duration requirements computed from dated experiences', () => {
  it('gives the matcher each skill\'s non-overlapping duration across the dated experiences that mention it', async () => {
    const system = createSystemUnderTest()
    await system.givenCandidateJourneyIsReadyForJobMatch()

    await system.submitJobPostingAskingForThreeYearsOfReact()

    system.expectDerivedDurations(['React: 93 months of dated experience', 'React Native: 24 months of dated experience'])
  })

  it('covers a duration requirement with the Candidate Facts behind the computed duration, never the Derived Fact', async () => {
    const system = createSystemUnderTest()
    await system.givenCandidateJourneyIsReadyForJobMatch()

    await system.submitJobPostingAskingForThreeYearsOfReact()

    system.expectDurationRequirementCoveredBy([
      'source-fact-skills-0-name-0',
      'source-fact-experiences-0-achievements-0', 'source-fact-experiences-0-startDate-0', 'source-fact-experiences-0-endDate-0',
      'source-fact-experiences-1-achievements-0', 'source-fact-experiences-1-startDate-0', 'source-fact-experiences-1-endDate-0',
    ])
  })
})

function createSystemUnderTest() {
  return new DatedSkillDurationTestSystem()
}

// 29 September 2026: the ongoing role runs from March 2021 to September 2026.
const currentTime = Date.UTC(2026, 8, 29, 10)
const jobPostingText = 'Frontend Engineer. At least 3 years of React experience.'
const durationRequirementId = 'job-requirement-react-duration'

/**
 * React is used in an ongoing role since March 2021 and in a 2019–2021 role that overlaps it, so the union runs from
 * January 2019 to September 2026. An undated experience never counts, a React Native role counts for React Native
 * only, "c'est" and "R&D" name neither C nor R, and TypeScript is used nowhere.
 */
const candidateFacts: readonly CandidateFact[] = [
  ['experiences.0.role.0', 'Frontend Engineer'],
  ['experiences.0.startDate.0', 'March 2021'],
  ['experiences.0.endDate.0', 'Present'],
  ['experiences.0.achievements.0', 'Built the billing screens in React'],
  ['experiences.1.role.0', 'Web Developer'],
  ['experiences.1.startDate.0', '2019'],
  ['experiences.1.endDate.0', '2021'],
  ['experiences.1.achievements.0', 'Maintained React dashboards for 12 clients'],
  ['experiences.2.role.0', 'Mobile Developer'],
  ['experiences.2.startDate.0', '2015'],
  ['experiences.2.endDate.0', '2016'],
  ['experiences.2.achievements.0', 'Shipped a React Native app, c\'est-à-dire iOS et Android, for the R&D team'],
  ['experiences.3.role.0', 'Volunteer Developer'],
  ['experiences.3.achievements.0', 'Rebuilt a charity website in React'],
  ['skills.0.name.0', 'React'],
  ['skills.1.name.0', 'TypeScript'],
  ['skills.2.name.0', 'React Native'],
  ['skills.3.name.0', 'C'],
  ['skills.4.name.0', 'R'],
].map(([path = '', value = '']) => ({ id: `source-fact-${path.replaceAll('.', '-')}` as const, path, status: 'attested' as const, value }))

class DatedSkillDurationTestSystem {
  readonly #journey: CandidateJourney
  readonly #matchedFacts: Parameters<CandidateJourneyDependencies['matchEvidenceMatcher']['match']>[0]['candidateFacts'][] = []
  #view: CandidateJourneyView | null = null

  constructor() {
    this.#journey = createCandidateJourney({ dependencies: createFakeCandidateJourneyDependencies({
      jobPostingExtractor: createFakeJobPostingExtractor({ extract: () => Promise.resolve({ ok: true, value: {
        practicalConstraints: [], targetRole: null,
        requirements: [{ id: durationRequirementId, value: 'At least 3 years of React experience',
          sourceExcerpt: 'At least 3 years of React experience.', importance: 'critical', importanceRationale: 'Explicit',
          capability: { dimension: 'technical-expertise', name: 'React' } }],
      } }) }),
      matchEvidenceMatcher: createFakeMatchEvidenceMatcher({ match: (request) => {
        this.#matchedFacts.push(request.candidateFacts)
        return Promise.resolve({ ok: true, value: proposeDurationEvidence(request.candidateFacts) })
      } }),
      now: () => currentTime,
      persistence: createInMemoryCandidateSessionPersistence({ session: createSession() }),
    }) })
  }

  async givenCandidateJourneyIsReadyForJobMatch() {
    this.#journey.start()
    await expect.poll(() => this.#journey.readView().status).toBe('candidate-session-open')
  }

  async submitJobPostingAskingForThreeYearsOfReact() {
    this.#journey.submitJobPosting({ document: { bytes: new TextEncoder().encode(jobPostingText),
      mediaType: 'text/plain', name: 'pasted-job-posting.txt' } })
    await expect.poll(() => this.#readOpenView().session.jobMatch).not.toBeNull()
    this.#view = this.#journey.readView()
  }

  expectDerivedDurations(values: readonly string[]) {
    const sourceFactIds = new Set<string>(candidateFacts.map(({ id }) => id))
    expect(this.#readMatchedFacts().filter(({ id }) => !sourceFactIds.has(id)).map(({ value }) => value)).toEqual(values)
  }

  expectDurationRequirementCoveredBy(factIds: readonly string[]) {
    const evidence = this.#readJobMatch().analysis.evidence.find(({ requirementId }) => requirementId === durationRequirementId)
    expect(evidence?.coverage).toBe('covered')
    expect([...evidence?.factIds ?? []].sort()).toEqual([...factIds].sort())
    expect(this.#readJobMatch().analysis.relevantFactIds.every((id) => candidateFacts.some((fact) => fact.id === id))).toBe(true)
  }

  #readMatchedFacts() {
    expect(this.#view, 'Submit the Job Posting before reading what the matcher received').not.toBeNull()
    const [first] = this.#matchedFacts
    if (first === undefined) return expect.fail('Expected the matcher to be called')
    return first
  }

  #readJobMatch() {
    expect(this.#view, 'Submit the Job Posting before reading the Match Analysis').not.toBeNull()
    const jobMatch = this.#view?.status === 'candidate-session-open' ? this.#view.session.jobMatch : null
    if (jobMatch === null) return expect.fail('Expected a Match Analysis')
    return jobMatch
  }

  #readOpenView() {
    const view = this.#journey.readView()
    if (view.status !== 'candidate-session-open') return expect.fail('Expected an open Candidate Session')
    return view
  }
}

/** As a model judging coverage would: a fact stating a long enough React duration covers the requirement. */
function proposeDurationEvidence(facts: readonly Readonly<{ id: string; value: string }>[]): MatchEvidenceProposal {
  const duration = facts.find(({ value }) => /^React: \d+ months/u.test(value))
  return { adjacentEvidence: [], relevance: [], evidence: duration === undefined ? [] : [{
    requirementId: durationRequirementId, coverage: 'covered',
    factMatches: [{ factId: duration.id, factExcerpt: duration.value, requirementExcerpt: '3 years of React' }],
  }] }
}

function createSession(): CandidateSession {
  return {
    expiresAt: currentTime + candidateSessionDurationMilliseconds, startedAt: currentTime,
    version: candidateSessionStorageVersion, sessionId: 'candidate-session-00000000-0000-4000-8000-000000000139',
    jobMatch: null, phase: 'job-match', processingConsent: { grantedAt: currentTime, policy: testProcessingPolicy },
    sourceIntake: { candidateFacts, contactDetails: [], criticalAmbiguities: [],
      sourceDocument: { kind: 'pasted-text', name: 'source.txt' },
      sourceProfile: { certifications: [], education: [], experiences: [], languages: [], projects: [], skills: [] } },
    tailoredResume: null,
  }
}
