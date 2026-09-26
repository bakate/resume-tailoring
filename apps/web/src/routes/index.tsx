import { createFileRoute } from '@tanstack/react-router'

import { ResumeTailoringScreen } from '../resume-tailoring/resume-tailoring-screen'

export const Route = createFileRoute('/')({
  component: ResumeTailoringScreen,
})
