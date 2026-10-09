import { describe, expect, it } from 'vitest'

import {
  candidateSessionDurationMilliseconds,
  hasValidCandidateSessionLifetime,
  isCandidateSessionExpired,
  readPreparationInputs,
  readPublishedInputs,
} from '../src/candidate-session'
import type { JobMatch } from '../src/job-match'
import type { SourceIntake } from '../src/source-intake'

const startedAt = 1_000

describe('Candidate Session lifetime', () => {
  it.each([
    { lifetime: 'exactly 24 hours', expiresAt: startedAt + candidateSessionDurationMilliseconds, valid: true },
    { lifetime: '48 hours', expiresAt: startedAt + 2 * candidateSessionDurationMilliseconds, valid: false },
    { lifetime: 'one millisecond short of 24 hours', expiresAt: startedAt + candidateSessionDurationMilliseconds - 1, valid: false },
  ])('accepts a lifetime of $lifetime only when it is the Candidate Session duration', ({ expiresAt, valid }) => {
    const session = { startedAt, expiresAt }

    const accepted = hasValidCandidateSessionLifetime({ session })

    expect(accepted).toBe(valid)
  })

  it.each([
    { moment: 'before its expiry instant', now: startedAt + candidateSessionDurationMilliseconds - 1, expired: false },
    { moment: 'at its expiry instant', now: startedAt + candidateSessionDurationMilliseconds, expired: true },
    { moment: 'after its expiry instant', now: startedAt + candidateSessionDurationMilliseconds + 1, expired: true },
  ])('treats a Candidate Session $moment as expired: $expired', ({ now, expired }) => {
    const session = { expiresAt: startedAt + candidateSessionDurationMilliseconds }

    const result = isCandidateSessionExpired({ session, now })

    expect(result).toBe(expired)
  })
})

const publishedSourceIntake = { label: 'published Source Intake' } as unknown as SourceIntake
const publishedJobMatch = { label: 'published Job Match' } as unknown as JobMatch
const correctedSourceIntake = { label: 'corrected Source Intake' } as unknown as SourceIntake
const preparedJobMatch = { label: 'Job Match in preparation' } as unknown as JobMatch
const published = { sourceIntake: publishedSourceIntake, jobMatch: publishedJobMatch }

describe('Candidate Session inputs', () => {
  it.each([
    { state: 'no preparation exists', session: published, expected: published },
    { state: 'a new preparation started while a Tailored Resume is already published',
      session: { ...published, preparation: { sourceIntake: correctedSourceIntake, jobMatch: preparedJobMatch } },
      expected: { sourceIntake: correctedSourceIntake, jobMatch: preparedJobMatch } },
    { state: 'a preparation without a Job Match yet, which keeps the published one',
      session: { ...published, preparation: { sourceIntake: correctedSourceIntake, jobMatch: null } },
      expected: { sourceIntake: correctedSourceIntake, jobMatch: publishedJobMatch } },
    { state: 'a settled preparation, which keeps no copy of the published inputs',
      session: { ...published, preparation: { sourceIntake: null, jobMatch: null } }, expected: published },
  ])('reads the inputs of the Tailored Resume Preparation for $state', ({ session, expected }) => {
    const inputs = readPreparationInputs({ session })

    expect(inputs).toEqual(expected)
  })

  it.each([
    { state: 'no preparation exists', session: published, expected: published },
    { state: 'a new preparation started while a Tailored Resume is already published',
      session: { ...published, preparation: { sourceIntake: correctedSourceIntake, jobMatch: preparedJobMatch } },
      expected: published },
    { state: 'a settled preparation', session: { ...published, preparation: { sourceIntake: null, jobMatch: null } },
      expected: published },
    { state: 'a first preparation, before any Tailored Resume is published',
      session: { sourceIntake: null, jobMatch: null, preparation: { sourceIntake: correctedSourceIntake, jobMatch: preparedJobMatch } },
      expected: { sourceIntake: null, jobMatch: null } },
  ])('reads the published inputs for $state', ({ session, expected }) => {
    const inputs = readPublishedInputs({ session })

    expect(inputs).toEqual(expected)
  })
})
