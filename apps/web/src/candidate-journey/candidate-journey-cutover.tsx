import { ResumeTailoringScreen } from '../resume-tailoring/resume-tailoring-screen'
import { CandidateJourneyShell } from './candidate-journey-shell'

type CandidateJourneyRelease = 'legacy' | 'three-phase'

export function CandidateJourneyCutover() {
  const release = readCandidateJourneyRelease()
  return release === 'legacy' ? <ResumeTailoringScreen /> : <CandidateJourneyShell />
}

function readCandidateJourneyRelease(): CandidateJourneyRelease {
  return import.meta.env.VITE_CANDIDATE_JOURNEY_RELEASE === 'legacy'
    ? 'legacy'
    : 'three-phase'
}
