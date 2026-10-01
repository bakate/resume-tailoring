import { groupedResumeDocument } from '@resume-tailoring/application/structured-resume-fixtures'
import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  candidateSessionStorageVersion,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession } from '@resume-tailoring/application/candidate-journey'
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

describe('browser Candidate Session persistence', () => {
  it('recovers unresolved edits, hidden entries, and genuine fact restoration destinations', () => {
    const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage() })
    const field = groupedResumeDocument.valueProposition.paragraphs[0]
    const location = { kind: 'value-proposition', fieldId: field.id } as const
    const session: CandidateSession = { ...candidateSession, tailoredResume: { ...groupedResumeDocument,
      sectionOrder: ['experiences', 'value-proposition', 'skills', 'education', 'languages', 'projects', 'certifications'] },
      resumeEditing: { revision: 'revision-edited', manuallyEdited: true, unsupportedFieldIds: [field.id],
        hiddenFields: [{ field: { ...field, text: '' }, location }], hiddenExperiences: [groupedResumeDocument.experiences[0]] },
      resumeFactLocations: [{ factId: 'source-fact-added', location }],
    }
    persistence.save({ session })

    expect(persistence.restore({ now: sessionStartedAt })).toEqual({ ok: true, value: { notice: null, session } })
  })

  it('round-trips semantic values, stable identities, prose, and grouped provenance', () => {
    const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage() })
    const session = { ...candidateSession, tailoredResume: groupedResumeDocument }
    persistence.save({ session })

    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: null, session },
    })
  })

  it('explicitly discards the previous flat document version', () => {
    const storage = createMemoryStorage({ initialValue: JSON.stringify({ ...candidateSession, version: 5 }) })
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: 'incompatible-session-discarded', session: null },
    })
    expect(storage.getItem(candidateSessionStorageKey)).toBeNull()
  })

  it('stores and restores the current version for 24 hours', () => {
    const storage = createMemoryStorage()
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.save({ session: candidateSession })).toEqual({
      ok: true, value: candidateSession,
    })
    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: null, session: candidateSession },
    })
  })

  it.each([
    ['an incompatible version', { ...candidateSession, version: 999 }],
    ['an invalid lifetime', { ...candidateSession, expiresAt: sessionStartedAt + (48 * 60 * 60 * 1_000) }],
  ])('discards %s', (_caseName, storedSession) => {
    const storage = createMemoryStorage({ initialValue: JSON.stringify(storedSession) })
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true,
      value: { notice: 'incompatible-session-discarded', session: null },
    })
    expect(storage.getItem(candidateSessionStorageKey)).toBeNull()
  })

  it('deletes a stored Candidate Session', () => {
    const storage = createMemoryStorage({ initialValue: JSON.stringify(candidateSession) })
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.delete()).toEqual({ ok: true, value: null })
    expect(storage.getItem(candidateSessionStorageKey)).toBeNull()
  })

  it('restores Processing Consent bound to its complete policy', () => {
    const storage = createMemoryStorage()
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.save({ session: consentedCandidateSession })).toEqual({
      ok: true, value: consentedCandidateSession,
    })
    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: null, session: consentedCandidateSession },
    })
  })

  it('restores the browser-local Source Document, contacts, and structured Source Profile', () => {
    const storage = createMemoryStorage()
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.save({ session: sourceIntakeCandidateSession })).toEqual({
      ok: true, value: sourceIntakeCandidateSession,
    })
    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: null, session: sourceIntakeCandidateSession },
    })
  })

  it('restores the complete explainable Match Analysis', () => {
    const storage = createMemoryStorage()
    const persistence = createBrowserCandidateSessionPersistence({ storage })

    expect(persistence.save({ session: jobMatchCandidateSession })).toEqual({
      ok: true, value: jobMatchCandidateSession,
    })
    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: null, session: jobMatchCandidateSession },
    })
  })

  it('restores a Match Analysis stored before Adjacent Evidence existed', () => {
    const storedAnalysis: Record<string, unknown> = { ...jobMatchCandidateSession.jobMatch.analysis }
    delete storedAnalysis.adjacentEvidence
    const persistence = createBrowserCandidateSessionPersistence({ storage: createMemoryStorage({
      initialValue: JSON.stringify({ ...jobMatchCandidateSession,
        jobMatch: { ...jobMatchCandidateSession.jobMatch, analysis: storedAnalysis } }),
    }) })

    expect(persistence.restore({ now: sessionStartedAt })).toEqual({
      ok: true, value: { notice: null, session: jobMatchCandidateSession },
    })
  })
})

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
