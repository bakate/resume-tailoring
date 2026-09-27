import type { ResumePdfFailureType, TailoredResumePdfInputs } from './tailored-resume-contract'
import { resumePdfFailureSchema } from './tailored-resume-schemas'

export type BrowserResumePdfResult =
  | Readonly<{ ok: true; value: Blob }>
  | Readonly<{
      ok: false
      error: Readonly<{ type: ResumePdfFailureType }>
    }>

export async function exportTailoredResumePdf({
  inputs,
  request = fetch,
}: Readonly<{
  inputs: TailoredResumePdfInputs
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

function createRequest(inputs: TailoredResumePdfInputs) {
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
