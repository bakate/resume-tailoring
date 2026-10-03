import { unavailableResumeRender } from '@resume-tailoring/application/candidate-journey'
import type { ResumeDocumentRenderer, ResumeRenderRequest, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { PrivacySafeTelemetry, resumeRenderFailureCategories } from '@resume-tailoring/application/privacy-safe-telemetry'
import { resumeRenderResponseSchema } from './resume-render-schema'

type RenderFailureCategory = typeof resumeRenderFailureCategories[number]
type RenderAttempt = Readonly<{ ok: true; result: ResumeRenderResult }> | Readonly<{ ok: false; category: RenderFailureCategory }>
type RendererDependencies = Readonly<{ request: typeof fetch; telemetry: PrivacySafeTelemetry; timeoutMilliseconds: number }>

const transientCategories: ReadonlySet<RenderFailureCategory> = new Set(['timeout', 'server', 'network'])

export function createBrowserResumeDocumentRenderer({ request = fetch, telemetry, timeoutMilliseconds = 25_000 }: Readonly<{
  request?: typeof fetch; telemetry: PrivacySafeTelemetry; timeoutMilliseconds?: number
}>): ResumeDocumentRenderer {
  return { render: (input) => renderDocument({ input, dependencies: { request, telemetry, timeoutMilliseconds } }) }
}

async function renderDocument({ input, dependencies }: Readonly<{
  input: ResumeRenderRequest; dependencies: RendererDependencies
}>) {
  const first = await attemptRender({ input, dependencies })
  const retried = !first.ok && transientCategories.has(first.category)
  const final = retried ? await attemptRender({ input, dependencies }) : first
  if (final.ok) return final.result
  void dependencies.telemetry.record({ name: 'resume-render-failed', category: final.category, retried })
  return unavailableResumeRender(input)
}

async function attemptRender({ input, dependencies }: Readonly<{
  input: ResumeRenderRequest; dependencies: RendererDependencies
}>): Promise<RenderAttempt> {
  const { request, timeoutMilliseconds } = dependencies
  let response: Response
  try {
    response = await request('/api/resume-document', { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
      signal: AbortSignal.timeout(timeoutMilliseconds) })
  } catch (error) {
    return failed(error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network')
  }
  if (!response.ok) return failed(classifyRejectedResponse(response.status))
  const parsed = resumeRenderResponseSchema.safeParse(await response.json().catch(() => undefined))
  if (!parsed.success) return failed('schema')
  const { assessment } = parsed.data
  if (assessment.layout.revision !== input.draft.revision
    || assessment.exportEligibility.revision !== input.draft.revision) return failed('revision-mismatch')
  if (assessment.layout.status === 'unavailable') return failed('render')
  return { ok: true, result: parsed.data }
}

function classifyRejectedResponse(status: number): RenderFailureCategory {
  if (status === 504) return 'timeout'
  if (status >= 500 || status === 429) return 'server'
  if (status === 401 || status === 403) return 'access'
  return 'schema'
}

function failed(category: RenderFailureCategory): RenderAttempt {
  return { ok: false, category }
}
