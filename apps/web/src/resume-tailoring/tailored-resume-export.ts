import type { TailoredResumeDocument } from '@resume-tailoring/application/tailored-resume-document'

import type { ResumeContactItem, ResumeDocumentLocale } from './tailored-resume-html'
import { resumePdfFailureSchema } from './tailored-resume-schemas'

type ExportInputs = Readonly<{
  contactItems: readonly ResumeContactItem[]
  document: TailoredResumeDocument
  locale: ResumeDocumentLocale
  photoDataUrl?: string
}>

export type BrowserResumePdfResult =
  | Readonly<{ ok: true; value: Blob }>
  | Readonly<{
      ok: false
      error: Readonly<{
        type:
          | 'resume-pdf-content-mismatch'
          | 'resume-pdf-fonts-not-embedded'
          | 'resume-pdf-overflow'
          | 'resume-pdf-page-count-invalid'
          | 'resume-pdf-rendering-unavailable'
          | 'resume-pdf-request-invalid'
      }>
    }>

export async function exportTailoredResumePdf({
  inputs,
  request = fetch,
}: Readonly<{
  inputs: ExportInputs
  request?: typeof fetch
}>): Promise<BrowserResumePdfResult> {
  try {
    const response = await request('/api/tailored-resume-pdf', createRequest(inputs))
    if (response.ok && response.headers.get('Content-Type')?.startsWith('application/pdf')) {
      return { ok: true, value: await response.blob() }
    }
    const failure = resumePdfFailureSchema.safeParse(await response.json())
    return failure.success ? failure.data : renderingUnavailableResult
  } catch {
    return renderingUnavailableResult
  }
}

function createRequest(inputs: ExportInputs) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs),
    cache: 'no-store',
  } as const
}

const renderingUnavailableResult = {
  ok: false,
  error: { type: 'resume-pdf-rendering-unavailable' },
} as const satisfies BrowserResumePdfResult
