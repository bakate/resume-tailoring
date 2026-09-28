import { createFileRoute } from '@tanstack/react-router'

import { DemoAccessGate } from '../demo-access/demo-access-gate'
import { ResumeTailoringScreen } from '../resume-tailoring/resume-tailoring-screen'

export const Route = createFileRoute('/')({
  component: DemoRoute,
})

function DemoRoute() {
  return (
    <DemoAccessGate>
      <ResumeTailoringScreen />
    </DemoAccessGate>
  )
}
