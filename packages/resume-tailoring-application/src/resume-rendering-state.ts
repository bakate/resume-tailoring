import { assessResumeExport, unavailableResumeRender } from './resume-export'
import type { ResumeRenderInput, ResumeRenderRequest, ResumeRenderResult } from './resume-export'

export type ResumeRenderingState = Readonly<{
  request: ResumeRenderRequest
  sequence: number
  result: ResumeRenderResult | null
}>

export function prepareResumeRendering({ input, previous, revision, sequence }: Readonly<{
  input: ResumeRenderInput; previous: ResumeRenderingState | null; revision: string; sequence: number
}>): ResumeRenderingState {
  const { document, ...options } = input
  const sameContent = previous !== null && JSON.stringify({ document: previous.request.draft.document,
    unsupportedFieldIds: previous.request.unsupportedFieldIds, photoDataUrl: previous.request.photoDataUrl }) === JSON.stringify(input)
  return { request: { ...options, draft: { document, revision: sameContent ? previous.request.draft.revision : revision } },
    sequence, result: null }
}

export function validateResumeRendering({ request, result }: Readonly<{
  request: ResumeRenderRequest; result: ResumeRenderResult
}>): ResumeRenderResult {
  const assessment = assessResumeExport({ ...request, layout: result.assessment.layout })
  if (assessment.exportEligibility.status === 'blocked') return { assessment, pdf: null }
  if (result.assessment.exportEligibility.revision !== request.draft.revision) return staleResumeRendering({ request })
  if (result.assessment.exportEligibility.status === 'blocked') return { ...result, pdf: null }
  if (result.pdf === null) return unavailableResumeRender(request)
  return { assessment, pdf: result.pdf }
}

export function staleResumeRendering({ request }: Readonly<{ request: ResumeRenderRequest }>): ResumeRenderResult {
  return { assessment: { layout: { status: 'unavailable', revision: request.draft.revision },
    exportEligibility: { status: 'blocked', revision: request.draft.revision, reasons: ['stale-layout'] } }, pdf: null }
}
