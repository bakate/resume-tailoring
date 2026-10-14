import type { ResumeSectionSnapshot } from '@resume-tailoring/domain/candidate-session'
import type { PreparationPhase } from './combined-intake'
import { readPreparationStepPhase } from './preparation-timing'
import type { RunningPhase } from './preparation-timing'
import type { ResumePreparationStep } from './resume-preparation-machines'

/** The phases a preparation goes through, in order, named as their Preparation Timings are. */
export const preparationProgressPhases = ['source-intake', 'job-posting-extraction', 'match-evidence',
  'resume-sections', 'coherence', 'overflow-reduction'] as const satisfies readonly RunningPhase[]

export type PreparationProgressPhase = typeof preparationProgressPhases[number]

/**
 * The phase a running preparation is in, with its Resume Sections once they are planned. Validated sections stay
 * not final until coherence and Overflow Reduction finish; a section coherence sends back is planned again.
 */
export type PreparationProgress = Readonly<{
  phase: PreparationProgressPhase
  /** Every planned Resume Section, only the validated ones with their content; empty before they are planned. */
  sections: readonly ResumeSectionSnapshot[]
  /** The Resume Sections validated out of those planned; null before they are planned. */
  sectionCount: Readonly<{ written: number; total: number }> | null
}>

/** Where a running preparation is: a step of the combined intake, a step of the resume preparation, or the layout. */
export type PreparationProgressStep = PreparationPhase | ResumePreparationStep | 'fitting-page-budget'

export function readPreparationProgress({ step, sections }: Readonly<{
  step: PreparationProgressStep; sections: readonly ResumeSectionSnapshot[]
}>): PreparationProgress {
  return { phase: step === 'fitting-page-budget' ? 'overflow-reduction' : readPreparationStepPhase(step), sections,
    sectionCount: sections.length === 0 ? null
      : { written: sections.filter(({ status }) => status === 'validated').length, total: sections.length } }
}
