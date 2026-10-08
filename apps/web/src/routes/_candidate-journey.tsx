import { Outlet, createFileRoute } from '@tanstack/react-router'

import { CandidateApiKeyWall } from '../candidate-api-key/candidate-api-key-wall'
import { CandidateJourneyShell } from '../candidate-journey/candidate-journey-shell'
import { CandidateJourneyControllerProvider, useCandidateJourneyController } from '../candidate-journey/use-candidate-journey'
import { DemoAccessGate } from '../demo-access/demo-access-gate'
import { readInitialDemoAccess } from '../demo-access/demo-access-initial-state'
import { useLocalization } from '../localization/localization'

/** Both Candidate Journey routes share this layout, so navigating between them keeps one Candidate Journey actor. */
export const Route = createFileRoute('/_candidate-journey')({
  // Demo access is decided once per page load; moving between the two routes never asks for it again.
  loader: () => readInitialDemoAccess(),
  shouldReload: false,
  component: CandidateJourneyLayout,
})

function CandidateJourneyLayout() {
  const initialAccess = Route.useLoaderData()
  return (
    <DemoAccessGate initialAccess={initialAccess}>
      <CandidateJourney />
    </DemoAccessGate>
  )
}

function CandidateJourney() {
  const candidateJourney = useCandidateJourneyController()
  const localization = useLocalization()
  return (
    <CandidateJourneyControllerProvider value={candidateJourney}>
      <CandidateJourneyShell>
        <Outlet />
      </CandidateJourneyShell>
      {localization.ok ? <CandidateApiKeyWall localization={localization.value} /> : null}
    </CandidateJourneyControllerProvider>
  )
}
