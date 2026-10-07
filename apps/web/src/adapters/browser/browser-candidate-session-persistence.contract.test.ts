import { groupedResumeDocument, readGroupedResumeSection } from '@resume-tailoring/application/structured-resume-fixtures'
import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { describeCandidateSessionPersistenceContract } from '@resume-tailoring/application/testing'
import { createBrowserCandidateSessionPersistence } from './browser-candidate-session-persistence'

const sessionStartedAt = 1_000
const candidateSessionStorageKey = 'honest-resume:candidate-session'
const candidateSession = {
  expiresAt: sessionStartedAt + candidateSessionDurationMilliseconds,
  jobMatch: null,
  phase: 'source-intake',
  processingConsent: null,
  sessionId: 'candidate-session-00000000-0000-4000-8000-000000000038',
  sourceIntake: null,
  tailoredResume: null,
  startedAt: sessionStartedAt,
  version: candidateSessionStorageVersion,
} as const satisfies CandidateSession
const consentedCandidateSession = {
  ...candidateSession,
  processingConsent: {
    grantedAt: sessionStartedAt,
    policy: {
      provider: 'Example Model Provider',
      purposes: ['Extract professional evidence'],
      retentionPolicy: 'Abuse-monitoring retention may apply.',
      storageBehavior: 'Model storage is disabled.',
      transmittedDataCategories: ['Professional facts'],
      version: '2026-09-29',
    },
  },
} as const satisfies CandidateSession

describeCandidateSessionPersistenceContract({
  name: 'Browser Candidate Session persistence',
  createPersistence: ({ storedSession, storageAvailable }) => createBrowserCandidateSessionPersistence({
    storage: storageAvailable
      ? createMemoryStorage({ initialValue: storedSession === null ? null : JSON.stringify(storedSession) })
      : unavailableStorage,
  }),
})

describe('browser Candidate Session persistence', () => {
  it('recovers unresolved edits, hidden entries, and genuine fact restoration destinations', () => {
    const field = groupedResumeDocument.valueProposition.paragraphs[0]
    const location = { kind: 'value-proposition', fieldId: field.id } as const
    const session: CandidateSession = { ...candidateSession, tailoredResume: { ...groupedResumeDocument,
      sectionOrder: ['experiences', 'value-proposition', 'skills', 'education', 'languages', 'projects', 'certifications'] },
      resumeEditing: { revision: 'revision-edited', manuallyEdited: true, unsupportedFieldIds: [field.id],
        hiddenFields: [{ field: { ...field, text: '' }, location }], hiddenExperiences: [groupedResumeDocument.experiences[0]] },
      resumeFactLocations: [{ factId: 'source-fact-added', location }],
    }

    const restored = roundTrip({ session })

    expect(restored).toEqual({ ok: true, value: { notice: null, session } })
  })

  it('round-trips semantic values, stable identities, prose, and grouped provenance', () => {
    const session = { ...candidateSession, tailoredResume: groupedResumeDocument }

    const restored = roundTrip({ session })

    expect(restored).toEqual({ ok: true, value: { notice: null, session } })
  })

  it('restores the resume photo kept in the Candidate Session', () => {
    const session = { ...candidateSession, resumePhoto: { dataUrl: 'data:image/png;base64,iVBORw0KGgo=', name: 'portrait.png' } }

    const restored = roundTrip({ session })

    expect(restored).toEqual({ ok: true, value: { notice: null, session } })
  })

  it.each([
    ['a resume photo that is not an image', { ...candidateSession,
      resumePhoto: { dataUrl: 'data:text/html;base64,PHNjcmlwdD4=', name: 'portrait.png' } }],
    ['the previous flat document version', { ...candidateSession, version: 5 }],
    ['an incompatible version', { ...candidateSession, version: 999 }],
  ])('discards %s', (_caseName, storedSession) => {
    const storage = createMemoryStorage({ initialValue: JSON.stringify(storedSession) })
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    const restored = persistence.restore()

    expect(restored).toEqual({ ok: true, value: { notice: 'incompatible-session-discarded', session: null } })
    expect(storage.getItem(candidateSessionStorageKey)).toBeNull()
  })

  it('removes a deleted Candidate Session from browser storage', () => {
    const storage = createMemoryStorage({ initialValue: JSON.stringify(candidateSession) })
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    persistence.delete()

    expect(storage.getItem(candidateSessionStorageKey)).toBeNull()
  })

  it('keeps the last saved session while the page is being left, so cut-short work restores as interrupted', () => {
    const page = new EventTarget()
    const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage(), page })
    persistence.save({ session: candidateSession })
    page.dispatchEvent(new Event('beforeunload'))

    persistence.save({ session: consentedCandidateSession })

    expect(persistence.restore()).toEqual({ ok: true, value: { notice: null, session: candidateSession } })
  })

  it.each([
    ['the Candidate keeps using a page they did not leave', 'beforeunload', 'keydown'],
    ['a page left for the back-forward cache is shown again', 'pagehide', 'pageshow'],
  ])('saves again once %s', (_caseName, leavingEvent, stayingEvent) => {
    const page = new EventTarget()
    const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage(), page })
    page.dispatchEvent(new Event(leavingEvent))
    page.dispatchEvent(new Event(stayingEvent))

    persistence.save({ session: consentedCandidateSession })

    expect(persistence.restore()).toEqual({ ok: true, value: { notice: null, session: consentedCandidateSession } })
  })

  it.each([
    ['Processing Consent bound to its complete policy', consentedCandidateSession],
    ['the browser-local Source Document, contacts, and structured Source Profile', sourceIntakeCandidateSession],
    ['the complete explainable Match Analysis', jobMatchCandidateSession],
  ] as const)('restores %s', (_caseName, session) => {
    const restored = roundTrip({ session })

    expect(restored).toEqual({ ok: true, value: { notice: null, session } })
  })

  it('restores a Match Analysis stored before Adjacent Evidence existed', () => {
    const storedAnalysis: Record<string, unknown> = { ...jobMatchCandidateSession.jobMatch.analysis }
    delete storedAnalysis.adjacentEvidence
    const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage({
      initialValue: JSON.stringify({ ...jobMatchCandidateSession,
        jobMatch: { ...jobMatchCandidateSession.jobMatch, analysis: storedAnalysis } }),
    }) })

    const restored = persistence.restore()

    expect(restored).toEqual({ ok: true, value: { notice: null, session: jobMatchCandidateSession } })
  })

  it('restores the saved Resume Sections of an interrupted preparation, with text only on validated sections', () => {
    const session: CandidateSession = { ...preparingCandidateSession, preparation: { ...preparingCandidateSession.preparation,
      sections: [
        { key: 'value-proposition', kind: 'value-proposition', attempt: 1, status: 'validated',
          content: readGroupedResumeSection({ key: 'value-proposition', kind: 'value-proposition' }) },
        { key: 'experiences.0', kind: 'experience', attempt: 1, status: 'validated',
          content: readGroupedResumeSection({ key: 'experiences.0', kind: 'experience' }) },
        { key: 'skills', kind: 'skills', attempt: 2, status: 'failed' },
        { key: 'education', kind: 'education', attempt: 0, status: 'writing' },
        { key: 'languages', kind: 'languages', attempt: 0, status: 'planned' },
      ] } }

    const restored = roundTrip({ session })

    expect(restored).toEqual({ ok: true, value: { notice: null, session } })
  })

  it.each([
    { type: 'rate-limited', retryAfterSeconds: 20 },
    { type: 'access-required' },
  ] as const)('restores the Failure Cause of a failed preparation ($type)', (failureCause) => {
    const session: CandidateSession = { ...preparingCandidateSession, preparation: { ...preparingCandidateSession.preparation,
      status: 'failed', failure: 'source-profile-extraction-unavailable', failureCause } }

    const restored = roundTrip({ session })

    expect(restored).toEqual({ ok: true, value: { notice: null, session } })
  })

  it('restores a preparation stored before section-by-section preparation', () => {
    const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage({
      initialValue: JSON.stringify(preparingCandidateSession) }) })

    const restored = persistence.restore()

    expect(restored).toEqual({ ok: true, value: { notice: null, session: preparingCandidateSession } })
  })
})

/** Saves a Candidate Session into fresh browser storage and restores it, as the next page load would. */
function roundTrip({ session }: Readonly<{ session: CandidateSession }>) {
  const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage() })
  persistence.save({ session })
  return persistence.restore()
}

const sourceIntakeCandidateSession = {
  ...consentedCandidateSession,
  phase: 'job-match',
  sourceIntake: {
    candidateFacts: [{
      id: 'source-fact-skills-0-name-0',
      path: 'skills.0.name.0',
      status: 'attested',
      value: 'TypeScript',
    }],
    contactDetails: [{ kind: 'email', value: 'bakate@example.com' }],
    criticalAmbiguities: [],
    originalContent: 'bakate@example.com\nTypeScript',
    sourceDocument: { kind: 'pasted-text', name: 'pasted-professional-text.txt' },
    sourceProfile: {
      certifications: [],
      education: [],
      experiences: [],
      languages: [],
      projects: [],
      skills: [{ category: 'Programming language', name: 'TypeScript' }],
    },
  },
} as const satisfies CandidateSession

const jobMatchCandidateSession = {
  ...sourceIntakeCandidateSession,
  jobMatch: {
    analysis: {
      adjacentEvidence: [],
      criticalRequirementReserve: { requirementIds: [], status: 'clear' },
      evidence: [{
        coverage: 'covered',
        factIds: ['source-fact-skills-0-name-0'],
        requirementId: 'job-requirement-1',
      }],
      generationEligibility: 'eligible',
      matchBand: 'strong',
      matchBandQualification: null,
      matchScore: 100,
      relevantFactIds: ['source-fact-skills-0-name-0'],
      requirementGroups: [{
        capabilities: [{ dimension: 'technical-expertise', name: 'TypeScript' }],
        coverage: 'covered',
        effectiveWeight: 3,
        importance: 'critical',
        requirementIds: ['job-requirement-1'],
      }],
    },
    jobPosting: {
      kind: 'pasted-text',
      name: 'pasted-job-posting.txt',
      originalContent: 'TypeScript is required.',
    },
    practicalConstraints: [],
    priorityGapRequirementIds: [],
    requirements: [{
      capability: { dimension: 'technical-expertise', name: 'TypeScript' },
      id: 'job-requirement-1',
      importance: 'critical',
      importanceRationale: 'The posting says required.',
      sourceExcerpt: 'TypeScript is required.',
      value: 'TypeScript',
    }],
    strengthRequirementIds: ['job-requirement-1'],
    targetRole: null,
  },
} as const satisfies CandidateSession

const preparingCandidateSession = {
  ...jobMatchCandidateSession,
  phase: 'tailored-resume-preparation',
  preparation: {
    revision: 'candidate-session-00000000-0000-4000-8000-000000000038:revision-1', status: 'pending', failure: null,
    sourceDocument: null, jobPosting: null, locale: 'en', purpose: 'tailored',
    sourceIntake: jobMatchCandidateSession.sourceIntake, jobMatch: jobMatchCandidateSession.jobMatch,
  },
} as const satisfies CandidateSession

function createMemoryStorage({ initialValue = null }: Readonly<{
  initialValue?: string | null
}> = {}) {
  const storedValues = new Map<string, string>()
  if (initialValue !== null) storedValues.set(candidateSessionStorageKey, initialValue)
  return {
    getItem: (key: string) => storedValues.get(key) ?? null,
    removeItem: (key: string) => { storedValues.delete(key) },
    setItem: (key: string, value: string) => { storedValues.set(key, value) },
  }
}

const unavailableStorage = { getItem: refuseStorage, removeItem: refuseStorage, setItem: refuseStorage }

function refuseStorage(): never {
  throw new DOMException('Storage is disabled', 'SecurityError')
}
