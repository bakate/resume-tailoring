import type {
  JobPostingTargetRole,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type {
  TailoredResumeDocumentInputs,
} from '@resume-tailoring/application/tailored-resume-document'

import type { ResumeDocumentLocale, ResumeContactItem } from './tailored-resume-html'

export const resumePdfFailureTypes = [
  'resume-pdf-content-mismatch',
  'resume-pdf-fonts-not-embedded',
  'resume-pdf-overflow',
  'resume-pdf-page-count-invalid',
  'resume-pdf-provenance-invalid',
  'resume-pdf-rendering-unavailable',
  'resume-pdf-request-invalid',
  'resume-pdf-validation-unavailable',
] as const

export type ResumePdfFailureType = typeof resumePdfFailureTypes[number]

export type TailoredResumePdfInputs = Readonly<{
  contactItems: readonly ResumeContactItem[]
  jobPostingContent: string
  locale: ResumeDocumentLocale
  photoDataUrl?: string
  targetRole: JobPostingTargetRole | null
  source: TailoredResumeDocumentInputs
}>
