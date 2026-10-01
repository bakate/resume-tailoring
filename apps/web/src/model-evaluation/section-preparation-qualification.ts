import type { ResumeDocumentCoherence, ResumeModelUsage, ResumeSectionKind, ResumeSectionModelFailure,
  ResumeSectionModels } from '@resume-tailoring/application/candidate-journey'

import type { CalibratedGate } from './model-qualification'

export type SectionPreparationBudgets = Readonly<{
  sectionP95LatencyMilliseconds: number
  preparationWallTimeMilliseconds: number
}>

export type RoleConfiguration = Readonly<{ model: string; reasoningEffort: string }>

/** One Resume Section of a run, timed from its first writing call to its last call, retries included. */
export type MeasuredResumeSection = Readonly<{
  key: string
  kind: ResumeSectionKind
  durationMilliseconds: number
  writingCallCount: number
  writingUsage: ResumeModelUsage
  validationUsage: ResumeModelUsage
}>

export type SectionPreparationRun = Readonly<{
  outcome: 'prepared' | 'failed'
  wallTimeMilliseconds: number
  sections: readonly MeasuredResumeSection[]
  coherence: Readonly<{ durationMilliseconds: number; usage: ResumeModelUsage; verdict: CoherenceVerdict }> | null
}>

/** The coherence check's content-free answer, or why it gave none. */
export type CoherenceVerdict = ResumeDocumentCoherence | ResumeSectionModelFailure

type SectionLatencyGate = CalibratedGate & Readonly<{ kind: ResumeSectionKind; sampleCount: number }>

export type SectionPreparationReport = Readonly<{
  budgets: SectionPreparationBudgets
  configurations: Readonly<{ structured: RoleConfiguration; writing: RoleConfiguration }>
  fixtureId: string
  gates: Readonly<{
    outcomes: Readonly<{ passed: boolean; failedPreparationCount: number }>
    preparationWallTime: CalibratedGate
    sectionP95Latency: Readonly<{ passed: boolean; bySection: Readonly<Record<string, SectionLatencyGate>> }>
  }>
  qualified: boolean
  runs: readonly SectionPreparationRun[]
  totals: Readonly<{ structuredUsage: ResumeModelUsage; writingUsage: ResumeModelUsage }>
}>

/**
 * Qualifies section-by-section preparation on a real-sized resume (ADR-0016). Each Resume Section of the plan must
 * meet the p95 budget across runs, the slowest run the wall-time budget, and every run must end prepared, which
 * the preparation guard reaches only when every section is validated and the coherence check passed.
 */
export function qualifySectionPreparation({ budgets, configurations, fixtureId, runs }: Readonly<{
  budgets: SectionPreparationBudgets
  configurations: SectionPreparationReport['configurations']
  fixtureId: string
  runs: readonly SectionPreparationRun[]
}>): SectionPreparationReport {
  const sectionP95Latency = createSectionLatencyGates({ budgets, runs })
  const preparationWallTime = createLatencyGate({ threshold: budgets.preparationWallTimeMilliseconds,
    value: Math.max(0, ...runs.map(({ wallTimeMilliseconds }) => wallTimeMilliseconds)) })
  const failedPreparationCount = runs.filter(({ outcome }) => outcome !== 'prepared').length
  const outcomes = { passed: runs.length > 0 && failedPreparationCount === 0, failedPreparationCount }
  const sections = runs.flatMap((run) => run.sections)
  return {
    budgets, configurations, fixtureId, runs,
    gates: { outcomes, preparationWallTime, sectionP95Latency },
    qualified: outcomes.passed && preparationWallTime.passed && sectionP95Latency.passed,
    totals: {
      writingUsage: sumUsage({ usages: sections.map(({ writingUsage }) => writingUsage) }),
      structuredUsage: sumUsage({ usages: [...sections.map(({ validationUsage }) => validationUsage),
        ...runs.flatMap(({ coherence }) => coherence === null ? [] : [coherence.usage])] }),
    },
  }
}

/**
 * Wraps the section models of one run to time each Resume Section by its plan key and split usage by role.
 * The production telemetry only carries the section kind, which would pool the experiences together.
 */
export function measureSectionModels({ models, now }: Readonly<{ models: ResumeSectionModels; now: () => number }>) {
  const sections = new Map<string, MeasuredResumeSection>()
  const sectionStarts = new Map<string, number>()
  let coherence: SectionPreparationRun['coherence'] = null
  const measure = async <TResult extends Readonly<{ usage?: ResumeModelUsage }>>({ call, key, kind, role }: Readonly<{
    call: () => Promise<TResult>; key: string; kind: ResumeSectionKind; role: 'writing' | 'validation'
  }>) => {
    if (!sectionStarts.has(key)) sectionStarts.set(key, now())
    const result = await call()
    const previous = sections.get(key) ?? { key, kind, durationMilliseconds: 0, writingCallCount: 0,
      writingUsage: noUsage, validationUsage: noUsage }
    sections.set(key, { ...previous, durationMilliseconds: Math.round(now() - (sectionStarts.get(key) ?? 0)),
      writingCallCount: previous.writingCallCount + (role === 'writing' ? 1 : 0),
      writingUsage: role === 'writing' ? sumUsage({ usages: [previous.writingUsage, result.usage ?? noUsage] }) : previous.writingUsage,
      validationUsage: role === 'validation' ? sumUsage({ usages: [previous.validationUsage, result.usage ?? noUsage] })
        : previous.validationUsage })
    return result
  }
  return {
    models: {
      writeSection: (input) => measure({ call: () => models.writeSection(input), key: input.section.key,
        kind: input.section.kind, role: 'writing' }),
      validateFields: (input) => measure({ call: () => models.validateFields(input), key: input.section.key,
        kind: input.section.kind, role: 'validation' }),
      checkCoherence: async (input) => {
        const startedAt = now()
        const result = await models.checkCoherence(input)
        coherence = { durationMilliseconds: Math.round(now() - startedAt), usage: result.usage ?? noUsage,
          verdict: result.ok ? { coherent: result.value.coherent, languageMatches: result.value.languageMatches } : result.error.type }
        return result
      },
    } satisfies ResumeSectionModels,
    readMeasurements: () => ({ coherence, sections: [...sections.values()] }),
  }
}

function createSectionLatencyGates({ budgets, runs }: Readonly<{
  budgets: SectionPreparationBudgets; runs: readonly SectionPreparationRun[]
}>): SectionPreparationReport['gates']['sectionP95Latency'] {
  const samples = Map.groupBy(runs.flatMap(({ sections }) => sections), ({ key }) => key)
  const bySection = Object.fromEntries([...samples].map(([key, sections]) => [key, {
    ...createLatencyGate({ threshold: budgets.sectionP95LatencyMilliseconds,
      value: calculateP95({ values: sections.map(({ durationMilliseconds }) => durationMilliseconds) }) }),
    kind: sections[0]?.kind ?? 'value-proposition', sampleCount: sections.length,
  }]))
  return { bySection, passed: samples.size > 0 && Object.values(bySection).every(({ passed }) => passed) }
}

function createLatencyGate({ threshold, value }: Readonly<{ threshold: number; value: number }>): CalibratedGate {
  return { passed: value <= threshold, threshold, value }
}

// With fewer than twenty samples per section the p95 is the slowest sample, the conservative reading.
function calculateP95({ values }: Readonly<{ values: readonly number[] }>) {
  const ordered = [...values].sort((left, right) => left - right)
  return ordered[Math.ceil(ordered.length * 0.95) - 1] ?? 0
}

function sumUsage({ usages }: Readonly<{ usages: readonly ResumeModelUsage[] }>): ResumeModelUsage {
  return usages.reduce((total, usage) => ({ inputTokens: total.inputTokens + usage.inputTokens,
    outputTokens: total.outputTokens + usage.outputTokens }), noUsage)
}

const noUsage: ResumeModelUsage = { inputTokens: 0, outputTokens: 0 }
