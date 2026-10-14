import { candidateJourneyPhases, preparationProgressPhases } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyPhase, PreparationProgress, PreparationProgressPhase } from '@resume-tailoring/application/candidate-journey'

export type PhaseProgressState = 'done' | 'current' | 'upcoming'
export type PhaseProgress = Readonly<{ phase: CandidateJourneyPhase; state: PhaseProgressState }>

/** Each Candidate Journey phase done, in progress or to come against the phase a preparation has reached. */
export function readPhaseProgress({ activePhase }: Readonly<{ activePhase: CandidateJourneyPhase }>): readonly PhaseProgress[] {
  const reached = candidateJourneyPhases.indexOf(activePhase)
  return candidateJourneyPhases.map((phase, index) => ({
    phase, state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }))
}

// The share of a preparation each phase usually takes, out of 100: writing the Resume Sections takes the longest.
const phaseWeights = {
  'source-intake': 10, 'job-posting-extraction': 10, 'match-evidence': 15,
  'resume-sections': 45, coherence: 10, 'overflow-reduction': 10,
} as const satisfies Record<PreparationProgressPhase, number>

/**
 * How much of a preparation is done, out of 100: the phases already passed, plus the Resume Sections written while
 * they are being written. It never reaches 100 while the preparation runs, since the last phase is still under way.
 */
export function readPreparationCompletion({ phase, sectionCount }: PreparationProgress) {
  const reached = preparationProgressPhases.indexOf(phase)
  const passed = preparationProgressPhases.slice(0, reached).reduce((total, passedPhase) => total + phaseWeights[passedPhase], 0)
  const written = phase === 'resume-sections' && sectionCount !== null && sectionCount.total > 0
    ? phaseWeights[phase] * sectionCount.written / sectionCount.total : 0
  return Math.round(passed + written)
}
