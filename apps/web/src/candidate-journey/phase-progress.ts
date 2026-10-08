import { candidateJourneyPhases } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyPhase } from '@resume-tailoring/application/candidate-journey'

export type PhaseProgressState = 'done' | 'current' | 'upcoming'
export type PhaseProgress = Readonly<{ phase: CandidateJourneyPhase; state: PhaseProgressState }>

/** Each Candidate Journey phase done, in progress or to come against the phase a preparation has reached. */
export function readPhaseProgress({ activePhase }: Readonly<{ activePhase: CandidateJourneyPhase }>): readonly PhaseProgress[] {
  const reached = candidateJourneyPhases.indexOf(activePhase)
  return candidateJourneyPhases.map((phase, index) => ({
    phase, state: index < reached ? 'done' : index === reached ? 'current' : 'upcoming',
  }))
}
