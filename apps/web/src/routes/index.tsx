import { createFileRoute } from '@tanstack/react-router'

import { CandidateJourneyShell } from '../candidate-journey/candidate-journey-shell'
import { DemoAccessGate } from '../demo-access/demo-access-gate'

export const Route = createFileRoute('/')({
  component: DemoRoute,
})

function DemoRoute() {
  return (
    <DemoAccessGate>
      <CandidateJourneyShell />
    </DemoAccessGate>
  )
}
