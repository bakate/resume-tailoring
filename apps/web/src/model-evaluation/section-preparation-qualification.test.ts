import { describe, expect, it } from 'vitest'
import type { ResumeSectionPlanEntry } from '@resume-tailoring/application/candidate-journey'

import { realSizedResumeFixture } from './real-sized-resume-corpus'
import {
  measureSectionModels,
  qualifySectionPreparation,
  type MeasuredResumeSection,
  type SectionPreparationRun,
} from './section-preparation-qualification'
import type { ResumeSectionModels } from '@resume-tailoring/application/ports'

describe('section preparation qualification on a real-sized resume', () => {
  it('passes when every section meets the p95 budget and every preparation meets the wall-time budget', () => {
    const report = qualify({ runs: [run({ slowExperienceMilliseconds: 9_000, wallTimeMilliseconds: 30_000 })] })

    expect(report.gates.sectionP95Latency.bySection['experiences.0']).toEqual({
      kind: 'experience', passed: true, sampleCount: 1, threshold: 10_000, value: 9_000 })
    expect(report.gates.preparationWallTime).toEqual({ passed: true, threshold: 40_000, value: 30_000 })
    expect(report.qualified).toBe(true)
  })

  it('fails when one experience exceeds the budget even though the other experiences are fast', () => {
    const fastRuns = Array.from({ length: 3 }, () => run({ slowExperienceMilliseconds: 2_000, wallTimeMilliseconds: 20_000 }))
    const report = qualify({ runs: [...fastRuns, run({ slowExperienceMilliseconds: 12_000, wallTimeMilliseconds: 20_000 })] })

    expect(report.gates.sectionP95Latency.bySection['experiences.0']?.passed).toBe(false)
    expect(report.gates.sectionP95Latency.bySection['experiences.1']?.passed).toBe(true)
    expect(report.qualified).toBe(false)
  })

  it('fails when the slowest preparation exceeds the wall-time budget', () => {
    const report = qualify({ runs: [
      run({ slowExperienceMilliseconds: 5_000, wallTimeMilliseconds: 20_000 }),
      run({ slowExperienceMilliseconds: 5_000, wallTimeMilliseconds: 45_000 }),
    ] })

    expect(report.gates.preparationWallTime).toEqual({ passed: false, threshold: 40_000, value: 45_000 })
    expect(report.qualified).toBe(false)
  })

  it('fails a fast preparation that did not prepare the Tailored Resume', () => {
    const fast = run({ slowExperienceMilliseconds: 1_000, wallTimeMilliseconds: 2_000 })
    const report = qualify({ runs: [{ ...fast, outcome: 'failed' }] })

    expect(report.gates.outcomes).toEqual({ passed: false, failedPreparationCount: 1 })
    expect(report.qualified).toBe(false)
  })

  it('does not qualify without any measured run', () => {
    expect(qualify({ runs: [] }).qualified).toBe(false)
  })

  it('reports writing and structured token usage separately, coherence included', () => {
    const report = qualify({ runs: [run({ slowExperienceMilliseconds: 1_000, wallTimeMilliseconds: 2_000 })] })

    expect(report.totals).toEqual({ writingUsage: { inputTokens: 3_000, outputTokens: 1_200 },
      structuredUsage: { inputTokens: 1_800, outputTokens: 90 } })
  })

  it('times each Resume Section by its plan key from its first writing call to its last call', async () => {
    const clock = createClock()
    const measured = measureSectionModels({ models: createTimedModels({ clock }), now: clock.now })
    const experience = { key: 'experiences.3', kind: 'experience' } as const

    await measured.models.writeSection(writingInput({ section: experience }))
    await measured.models.writeSection(writingInput({ section: experience }))
    await measured.models.validateFields({ ...writingInput({ section: experience }), fields: [] })
    await measured.models.checkCoherence({ document: groupedDocument })

    expect(measured.readMeasurements()).toEqual({
      coherence: { durationMilliseconds: 500, usage: { inputTokens: 30, outputTokens: 3 }, verdict: 'transient' },
      sections: [{ key: 'experiences.3', kind: 'experience', durationMilliseconds: 3_000, writingCallCount: 2,
        writingUsage: { inputTokens: 200, outputTokens: 20 }, validationUsage: { inputTokens: 30, outputTokens: 3 } }],
    })
  })

  it('supplies at least six experiences and every supporting section in the real-sized fixture', () => {
    const sectionKeys = new Set(realSizedResumeFixture.request.candidateFacts.map(({ path }) => /^\w+\.\d+/u.exec(path)?.[0]))
    const sections = new Set([...sectionKeys].map((key) => key?.split('.')[0]))

    expect([...sectionKeys].filter((key) => key?.startsWith('experiences.')).length).toBeGreaterThanOrEqual(6)
    expect([...sections]).toEqual(expect.arrayContaining(['skills', 'education', 'languages', 'projects', 'certifications']))
  })
})

function qualify({ runs }: Readonly<{ runs: readonly SectionPreparationRun[] }>) {
  return qualifySectionPreparation({
    budgets: { sectionP95LatencyMilliseconds: 10_000, preparationWallTimeMilliseconds: 40_000 },
    configurations: { structured: { model: 'structured-model', reasoningEffort: 'low' },
      writing: { model: 'writing-model', reasoningEffort: 'medium' } },
    fixtureId: realSizedResumeFixture.id,
    runs,
  })
}

function run({ slowExperienceMilliseconds, wallTimeMilliseconds }: Readonly<{
  slowExperienceMilliseconds: number; wallTimeMilliseconds: number
}>): SectionPreparationRun {
  const section = (key: string, kind: MeasuredResumeSection['kind'], durationMilliseconds: number) => ({
    key, kind, durationMilliseconds, writingCallCount: 1,
    writingUsage: { inputTokens: 1_000, outputTokens: 400 }, validationUsage: { inputTokens: 500, outputTokens: 25 } })
  return {
    outcome: 'prepared', wallTimeMilliseconds,
    coherence: { durationMilliseconds: 1_500, usage: { inputTokens: 300, outputTokens: 15 },
      verdict: { coherent: true, languageMatches: true } },
    sections: [section('value-proposition', 'value-proposition', 4_000),
      section('experiences.0', 'experience', slowExperienceMilliseconds), section('experiences.1', 'experience', 3_000)],
  }
}

function createClock() {
  let current = 0
  return { now: () => current, advance: (milliseconds: number) => { current += milliseconds } }
}

function createTimedModels({ clock }: Readonly<{ clock: ReturnType<typeof createClock> }>): ResumeSectionModels {
  const failure = { ok: false, error: { type: 'transient' } } as const
  return {
    writeSection: () => { clock.advance(1_000); return Promise.resolve({ ...failure, usage: { inputTokens: 100, outputTokens: 10 } }) },
    validateFields: () => { clock.advance(1_000); return Promise.resolve({ ...failure, usage: { inputTokens: 30, outputTokens: 3 } }) },
    checkCoherence: () => { clock.advance(500); return Promise.resolve({ ...failure, usage: { inputTokens: 30, outputTokens: 3 } }) },
  }
}

function writingInput({ section }: Readonly<{ section: ResumeSectionPlanEntry }>) {
  return { section, candidateFacts: [], targetRole: null, jobRequirements: [], relevantFactIds: [], rejectedFields: [],
    locale: 'en', purpose: 'tailored' } as const
}

const groupedDocument = { purpose: 'tailored', locale: 'en', targetRole: null,
  valueProposition: { kind: 'prose', paragraphs: [] }, experiences: [], sections: [] } as const
