import { candidateJourneyPhases } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyPhase } from '@resume-tailoring/application/candidate-journey'

export type PreparationStepState = 'done' | 'current' | 'upcoming'
export type PreparationStep = Readonly<{ phase: CandidateJourneyPhase; state: PreparationStepState }>

/** The three steps of a resume preparation, each done, in progress or to come against the phase it has reached. */
export function readPreparationSteps({ activePhase }: Readonly<{ activePhase: CandidateJourneyPhase }>): readonly PreparationStep[] {
  const reached = candidateJourneyPhases.indexOf(activePhase)
  return candidateJourneyPhases.map((phase, index) => ({
    phase, state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }))
}
