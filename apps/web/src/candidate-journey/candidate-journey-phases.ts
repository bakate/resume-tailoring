import { candidateJourneyPhases as candidateJourneyPhaseIds } from '@resume-tailoring/application/candidate-journey'
import type { CandidateJourneyPhase } from '@resume-tailoring/application/candidate-journey'

const candidateJourneyPhaseCopy = {
  'source-intake': {
    descriptionKey: 'candidateJourney.sourceIntakeDescription',
    titleKey: 'candidateJourney.sourceIntake',
  },
  'job-match': {
    descriptionKey: 'candidateJourney.jobMatchDescription',
    titleKey: 'candidateJourney.jobMatch',
  },
  'tailored-resume-preparation': {
    descriptionKey: 'candidateJourney.tailoredResumePreparationDescription',
    titleKey: 'candidateJourney.tailoredResumePreparation',
  },
} as const satisfies Record<CandidateJourneyPhase, Readonly<{
  descriptionKey: string
  titleKey: string
}>>

export const candidateJourneyPhases = candidateJourneyPhaseIds.map((id) => ({
  ...candidateJourneyPhaseCopy[id],
  id,
}))

export type { CandidateJourneyPhase }
