import { describe, expect, it } from 'vitest'

import { readPhaseProgress } from './phase-progress'

describe('Phase progress', () => {
  it('shows reading the resume in progress and the two other steps to come', () => {
    const progress = readPhaseProgress({ activePhase: 'source-intake' })

    expect(progress).toEqual([
      { phase: 'source-intake', state: 'current' },
      { phase: 'job-match', state: 'upcoming' },
      { phase: 'tailored-resume-preparation', state: 'upcoming' },
    ])
  })

  it('marks the phases before the Job Match done and the writing to come', () => {
    const progress = readPhaseProgress({ activePhase: 'job-match' })

    expect(progress.map(({ state }) => state)).toEqual(['done', 'current', 'upcoming'])
  })

  it('marks every phase before the writing done', () => {
    const progress = readPhaseProgress({ activePhase: 'tailored-resume-preparation' })

    expect(progress.map(({ state }) => state)).toEqual(['done', 'done', 'current'])
  })
})
