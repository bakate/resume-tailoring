import { Outlet, createFileRoute, useMatch } from '@tanstack/react-router'

import { CandidateApiKeyWall } from '../candidate-api-key/candidate-api-key-wall'
import { CandidateJourneyLanding, CandidateJourneyShell, CandidateJourneyStatus } from '../candidate-journey/candidate-journey-shell'
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

/**
 * The shell and, on `/`, the landing are public and rendered by the server; only the Candidate Journey, and with it
 * every model call, waits behind demo access.
 */
function CandidateJourneyLayout() {
  const initialAccess = Route.useLoaderData()
  const isIntake = useMatch({ from: '/_candidate-journey/', shouldThrow: false }) !== undefined
  return (
    <CandidateJourneyShell>
      {isIntake ? <CandidateJourneyLanding /> : null}
      <DemoAccessGate initialAccess={initialAccess}>
        <CandidateJourney />
      </DemoAccessGate>
    </CandidateJourneyShell>
  )
}

function CandidateJourney() {
  const candidateJourney = useCandidateJourneyController()
  const localization = useLocalization()
  return (
    <CandidateJourneyControllerProvider value={candidateJourney}>
      <CandidateJourneyStatus />
      <Outlet />
      {localization.ok ? <CandidateApiKeyWall localization={localization.value} /> : null}
    </CandidateJourneyControllerProvider>
  )
}
