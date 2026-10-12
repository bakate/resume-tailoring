import { Outlet, createFileRoute, useMatch } from '@tanstack/react-router'

import { CandidateJourneyLanding, CandidateJourneyShell, CandidateJourneyStatus } from '../candidate-journey/candidate-journey-shell'
import { CandidateJourneyControllerProvider, useCandidateJourneyController } from '../candidate-journey/use-candidate-journey'
import { DemoAccessGate } from '../demo-access/demo-access-gate'
import { readInitialDemoAccess } from '../demo-access/demo-access-initial-state'
import { readServedProcessingPolicy } from '../served-processing-policy'
import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'

/** Both Candidate Journey routes share this layout, so navigating between them keeps one Candidate Journey actor. */
export const Route = createFileRoute('/_candidate-journey')({
  // Demo access and the Processing Policy are decided once per page load; moving between the two routes keeps them.
  loader: async () => {
    const [initialAccess, processingPolicy] = await Promise.all([readInitialDemoAccess(), readServedProcessingPolicy()])
    return { initialAccess, processingPolicy }
  },
  shouldReload: false,
  component: CandidateJourneyLayout,
})

/**
 * The shell and, on `/`, the landing are public and rendered by the server; only the Candidate Journey, and with it
 * every model call, waits behind demo access.
 */
function CandidateJourneyLayout() {
  const { initialAccess, processingPolicy } = Route.useLoaderData()
  const isIntake = useMatch({ from: '/_candidate-journey/', shouldThrow: false }) !== undefined
  return (
    <CandidateJourneyShell>
      {isIntake ? <CandidateJourneyLanding processingPolicy={processingPolicy} /> : null}
      <DemoAccessGate initialAccess={initialAccess}>
        <CandidateJourney processingPolicy={processingPolicy} />
      </DemoAccessGate>
    </CandidateJourneyShell>
  )
}

function CandidateJourney({ processingPolicy }: Readonly<{ processingPolicy: ProcessingPolicy }>) {
  const candidateJourney = useCandidateJourneyController({ processingPolicy })
  return (
    <CandidateJourneyControllerProvider value={candidateJourney}>
      <CandidateJourneyStatus />
      <Outlet />
    </CandidateJourneyControllerProvider>
  )
}
