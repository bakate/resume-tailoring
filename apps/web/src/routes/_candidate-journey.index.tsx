import { createFileRoute } from '@tanstack/react-router'

import { CandidateIntakePage } from '../candidate-journey/candidate-journey-shell'

export const Route = createFileRoute('/_candidate-journey/')({
  component: CandidateIntakePage,
})
