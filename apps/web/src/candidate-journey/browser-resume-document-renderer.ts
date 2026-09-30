import { unavailableResumeRender } from '@resume-tailoring/application/candidate-journey'
import type { ResumeDocumentRenderer, ResumeRenderRequest } from '@resume-tailoring/application/candidate-journey'
import { resumeRenderResponseSchema } from './resume-render-schema'

export function createBrowserResumeDocumentRenderer({ request = fetch }: Readonly<{
  request?: typeof fetch
}> = {}): ResumeDocumentRenderer {
  return { render: (input) => renderDocument({ input, request }) }
}

async function renderDocument({ input, request }: Readonly<{
  input: ResumeRenderRequest; request: typeof fetch
}>) {
  try {
    const response = await request('/api/resume-document', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    if (!response.ok) return unavailableResumeRender(input)
    const parsed = resumeRenderResponseSchema.safeParse(await response.json() as unknown)
    if (!parsed.success) return unavailableResumeRender(input)
    const { assessment, pdf } = parsed.data
    if (assessment.layout.revision !== input.draft.revision
      || assessment.exportEligibility.revision !== input.draft.revision) return unavailableResumeRender(input)
    return { assessment, pdf: pdf === null ? null : Uint8Array.from(atob(pdf), (value) => value.charCodeAt(0)) }
  } catch {
    return unavailableResumeRender(input)
  }
}
