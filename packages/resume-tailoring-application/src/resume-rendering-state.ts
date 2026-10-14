import { assessResumeExport, unavailableResumeRender } from './resume-export'
import type { ResumeRenderInput, ResumeRenderRequest, ResumeRenderResult } from './resume-export'
import type { TailoredResume } from './tailored-resume'

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

/** The render the Page Budget fitting returned, which the preview shows for the same document and photo. */
export type FittedResumeRendering = Readonly<{ document: TailoredResume; photoDataUrl?: string; result: ResumeRenderResult }>

/** Whether the preview asks for the document and photo the fitting rendered, with a PDF it can show. */
export function matchesFittedRendering({ input, fitted }: Readonly<{
  input: ResumeRenderInput; fitted: FittedResumeRendering | null
}>): boolean {
  return fitted !== null && fitted.result.pdf !== null && fitted.result.assessment.layout.status !== 'unavailable'
    && JSON.stringify({ document: fitted.document, photoDataUrl: fitted.photoDataUrl })
      === JSON.stringify({ document: input.document, photoDataUrl: input.photoDataUrl })
}

/** The fitted render as the result of a rendering of the same content, assessed for its revision and unsupported fields. */
export function reuseFittedRendering({ rendering, fitted }: Readonly<{
  rendering: ResumeRenderingState; fitted: FittedResumeRendering
}>): ResumeRenderResult {
  const { request } = rendering
  const layout = { ...fitted.result.assessment.layout, revision: request.draft.revision }
  return validateResumeRendering({ request, result: { assessment: assessResumeExport({ ...request, layout }),
    pdf: fitted.result.pdf } })
}

export function validateResumeRendering({ request, result }: Readonly<{
  request: ResumeRenderRequest; result: ResumeRenderResult
}>): ResumeRenderResult {
  if (result.assessment.exportEligibility.revision !== request.draft.revision
    || result.assessment.layout.revision !== request.draft.revision) return staleResumeRendering({ request })
  if (result.assessment.layout.status === 'unavailable') return result.failure === undefined
    ? unavailableResumeRender(request) : { ...unavailableResumeRender(request), failure: result.failure }
  // The rendered PDF stays displayable; only the export assessment decides whether it can be downloaded.
  const assessment = assessResumeExport({ ...request, layout: result.assessment.layout })
  if (assessment.exportEligibility.status === 'eligible' && result.pdf === null) return unavailableResumeRender(request)
  return { assessment, pdf: result.pdf }
}

export function staleResumeRendering({ request }: Readonly<{ request: ResumeRenderRequest }>): ResumeRenderResult {
  return { assessment: { layout: { status: 'unavailable', revision: request.draft.revision },
    exportEligibility: { status: 'blocked', revision: request.draft.revision, reasons: ['stale-layout'] } }, pdf: null }
}
