import type { ResumeDraft, ResumeExportBlocker, ResumeLayoutAssessment, ResumeLayoutOutcome } from './structured-resume-contract'

export type ResumeRenderRequest = Readonly<{
  draft: ResumeDraft
  unsupportedFieldIds: readonly string[]
  photoDataUrl?: string
}>

export type ResumeRenderInput = Omit<ResumeRenderRequest, 'draft'> & Readonly<{ document: ResumeDraft['document'] }>

export type ResumeRenderResult = Readonly<{
  assessment: ResumeLayoutAssessment
  pdf: Uint8Array | null
}>

export function assessResumeExport({ draft, layout, unsupportedFieldIds }: ResumeRenderRequest & Readonly<{
  layout: ResumeLayoutOutcome
}>): ResumeLayoutAssessment {
  const reasons = readExportBlockers({ draft, layout, unsupportedFieldIds })
  const exportEligibility = reasons.length === 0 && layout.status === 'fits'
    ? { status: 'eligible', revision: draft.revision, pageCount: layout.pageCount } as const
    : { status: 'blocked', revision: draft.revision, reasons } as const
  return { layout, exportEligibility }
}

function readExportBlockers({ draft, layout, unsupportedFieldIds }: ResumeRenderRequest & Readonly<{
  layout: ResumeLayoutOutcome
}>) {
  const reasons: ResumeExportBlocker[] = []
  if (unsupportedFieldIds.length > 0) reasons.push('unsupported-content')
  if (!draft.document.identity?.value.trim()) reasons.push('missing-identity')
  if (!draft.document.contactDetails.some(({ kind, value }) =>
    (kind === 'email' || kind === 'phone') && value.trim().length > 0)) reasons.push('missing-contact')
  if (layout.revision !== draft.revision) reasons.push('stale-layout')
  if (layout.status === 'overflow') reasons.push('overflow')
  if (layout.status === 'unavailable') reasons.push('layout-unavailable')
  return reasons
}

export function unavailableResumeRender(request: ResumeRenderRequest): ResumeRenderResult {
  return { assessment: assessResumeExport({ ...request,
    layout: { status: 'unavailable', revision: request.draft.revision } }), pdf: null }
}
