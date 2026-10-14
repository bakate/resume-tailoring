import { describe, expect, it } from 'vitest'

import { preparationProgressPhases } from '@resume-tailoring/application/candidate-journey'
import { readPhaseProgress, readPreparationCompletion } from './phase-progress'

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

describe('Preparation completion', () => {
  it('starts empty while the resume is read', () => {
    const start = readPreparationCompletion({ phase: 'source-intake', sections: [], sectionCount: null })

    expect(start).toBe(0)
  })

  it('moves forward with every phase a preparation reaches', () => {
    const completions = preparationProgressPhases.map((phase) =>
      readPreparationCompletion({ phase, sections: [], sectionCount: null }))

    expect(completions).toEqual([...completions].sort((left, right) => left - right))
    expect(new Set(completions).size).toBe(preparationProgressPhases.length)
    expect(completions.at(-1)).toBeLessThan(100)
  })

  it('moves forward with every Resume Section written, short of the coherence check', () => {
    const progress = (written: number) => readPreparationCompletion({
      phase: 'resume-sections', sections: [], sectionCount: { written, total: 8 } })
    const coherence = readPreparationCompletion({ phase: 'coherence', sections: [], sectionCount: { written: 8, total: 8 } })

    expect(progress(0)).toBeLessThan(progress(3))
    expect(progress(3)).toBeLessThan(progress(7))
    expect(progress(8)).toBe(coherence)
  })
})
