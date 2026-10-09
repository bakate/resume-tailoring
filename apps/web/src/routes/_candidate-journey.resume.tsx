import { createFileRoute } from '@tanstack/react-router'

import { ResumeResultPage } from '../candidate-journey/resume-result-page'

export const Route = createFileRoute('/_candidate-journey/resume')({
  // The Tailored Resume lives only in the Candidate's browser, so this address has nothing for a search engine.
  head: () => ({ meta: [{ name: 'robots', content: 'noindex' }] }),
  component: ResumeResultPage,
})
