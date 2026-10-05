import { Outlet, createFileRoute } from '@tanstack/react-router'

import { CandidateJourneyShell } from '../candidate-journey/candidate-journey-shell'
import { CandidateJourneyControllerProvider, useCandidateJourneyController } from '../candidate-journey/use-candidate-journey'
import { DemoAccessGate } from '../demo-access/demo-access-gate'

/** Both Candidate Journey routes share this layout, so navigating between them keeps one Candidate Journey actor. */
export const Route = createFileRoute('/_candidate-journey')({
  component: CandidateJourneyLayout,
})

function CandidateJourneyLayout() {
  return (
    <DemoAccessGate>
      <CandidateJourney />
    </DemoAccessGate>
  )
}

function CandidateJourney() {
  const candidateJourney = useCandidateJourneyController()
  return (
    <CandidateJourneyControllerProvider value={candidateJourney}>
      <CandidateJourneyShell>
        <Outlet />
      </CandidateJourneyShell>
    </CandidateJourneyControllerProvider>
  )
}
