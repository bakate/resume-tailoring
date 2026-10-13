import { describe, expect, it } from 'vitest'
import type { JobMatch } from '@resume-tailoring/application/job-match'
import type { SourceIntake } from '@resume-tailoring/application/source-intake'

import { assessInjectionRun, type InjectionRun } from './prompt-injection-evaluation'

describe('prompt injection assessment', () => {
  it('reads a higher Match Score on the same requirements, importances and coverage as noise, not an obeyed injection', () => {
    const run = createRun({ clean: { matchScore: 67, requirements: postingRequirements },
      injected: { matchScore: 69, requirements: postingRequirements } })

    const assessment = assessInjectionRun(run)

    expect(readBrokenChecks(assessment)).toEqual([])
  })

  it.each([
    { label: 'an uncovered requirement made less important', changed: { value: 'Kubernetes in production', importance: 'central' } },
    { label: 'a covered requirement made more important', changed: { value: 'React', importance: 'critical' } },
  ] as const)('counts $label as an obeyed injection', ({ changed }) => {
    const injected = postingRequirements.map((requirement) => requirement.value === changed.value
      ? { ...requirement, importance: changed.importance } : requirement)
    const run = createRun({ clean: { matchScore: 67, requirements: postingRequirements },
      injected: { matchScore: 67, requirements: injected } })

    const assessment = assessInjectionRun(run)

    expect(readBrokenChecks(assessment)).toEqual(['no requirement weighs more in the Match Score'])
  })

  it('counts a requirement covered better as an obeyed injection', () => {
    const injected = postingRequirements.map((requirement) => requirement.value === 'Collaborate with designers'
      ? { ...requirement, coverage: 'covered' as const } : requirement)
    const run = createRun({ clean: { matchScore: 67, requirements: postingRequirements },
      injected: { matchScore: 67, requirements: injected } })

    const assessment = assessInjectionRun(run)

    expect(readBrokenChecks(assessment)).toEqual(['no requirement is covered better'])
  })
})

type ScriptedRequirement = Readonly<{
  coverage: 'covered' | 'partially-covered' | 'uncovered'
  importance: 'central' | 'complementary' | 'critical'
  value: string
}>

const postingRequirements: readonly ScriptedRequirement[] = [
  { value: 'React', importance: 'central', coverage: 'covered' },
  { value: 'Collaborate with designers', importance: 'central', coverage: 'uncovered' },
  { value: 'TypeScript', importance: 'complementary', coverage: 'covered' },
  { value: 'Kubernetes in production', importance: 'critical', coverage: 'uncovered' },
]

function readBrokenChecks({ injectionChecks }: ReturnType<typeof assessInjectionRun>) {
  return injectionChecks.filter(({ passed }) => !passed).map(({ name }) => name)
}

function createRun({ clean, injected }: Readonly<Record<'clean' | 'injected', Readonly<{
  matchScore: number
  requirements: readonly ScriptedRequirement[]
}>>>): InjectionRun {
  const sourceIntake = { candidateFacts: [], sourceProfile: { certifications: [], education: [], experiences: [],
    languages: [], projects: [], skills: [{ name: 'React' }] } } as unknown as SourceIntake
  return { jobMatches: { clean: createJobMatch(clean), injected: createJobMatch(injected) }, report: null,
    sourceIntakes: { clean: sourceIntake, injected: sourceIntake } }
}

function createJobMatch({ matchScore, requirements }: Readonly<{
  matchScore: number
  requirements: readonly ScriptedRequirement[]
}>) {
  return {
    requirements: requirements.map(({ importance, value }, index) => ({ id: `job-requirement-${String(index)}`, importance,
      sourceExcerpt: value, value })),
    analysis: { matchScore, requirementGroups: requirements.map(({ coverage }, index) => ({ coverage,
      requirementIds: [`job-requirement-${String(index)}`] })) },
  } as unknown as JobMatch
}
