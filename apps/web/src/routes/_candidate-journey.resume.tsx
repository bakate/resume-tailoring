import { createFileRoute } from '@tanstack/react-router'

import { ResumeResultPage } from '../candidate-journey/resume-result-page'

export const Route = createFileRoute('/_candidate-journey/resume')({
  component: ResumeResultPage,
})
