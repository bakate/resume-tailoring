import { createFileRoute } from '@tanstack/react-router'

import { CandidateJourneyCutover } from '../candidate-journey/candidate-journey-cutover'
import { DemoAccessGate } from '../demo-access/demo-access-gate'

export const Route = createFileRoute('/')({
  component: DemoRoute,
})

function DemoRoute() {
  return (
    <DemoAccessGate>
      <CandidateJourneyCutover />
    </DemoAccessGate>
  )
}
