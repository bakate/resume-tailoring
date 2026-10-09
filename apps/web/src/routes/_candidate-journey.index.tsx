import { createFileRoute } from '@tanstack/react-router'

import { CandidateIntakePage } from '../candidate-journey/candidate-journey-shell'
import { homeCanonicalLink } from '../search-metadata'

export const Route = createFileRoute('/_candidate-journey/')({
  head: () => ({ links: [homeCanonicalLink] }),
  component: CandidateIntakePage,
})
