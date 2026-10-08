import { describe, expect, it } from 'vitest'

import { readPreparationSteps } from './preparation-steps'

describe('Preparation steps', () => {
  it('shows reading the resume in progress and the two other steps to come', () => {
    expect(readPreparationSteps({ activePhase: 'source-intake' })).toEqual([
      { phase: 'source-intake', state: 'current' },
      { phase: 'job-match', state: 'upcoming' },
      { phase: 'tailored-resume-preparation', state: 'upcoming' },
    ])
  })

  it('marks the steps before the comparison done and the writing to come', () => {
    expect(readPreparationSteps({ activePhase: 'job-match' }).map(({ state }) => state))
      .toEqual(['done', 'current', 'upcoming'])
  })

  it('marks every step before the writing done', () => {
    expect(readPreparationSteps({ activePhase: 'tailored-resume-preparation' }).map(({ state }) => state))
      .toEqual(['done', 'done', 'current'])
  })
})
