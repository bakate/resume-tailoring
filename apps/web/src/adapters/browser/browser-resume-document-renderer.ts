import { unavailableResumeRender } from '@resume-tailoring/application/candidate-journey'
import type { ResumeRenderRequest, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { resumeRenderFailureCategories } from '@resume-tailoring/application/privacy-safe-telemetry'
import { apiFailureSchema } from '../../api-failure'
import { resumeRenderResponseSchema } from '../../candidate-journey/resume-render-schema'
import type { PrivacySafeTelemetry, ResumeDocumentRenderer } from '@resume-tailoring/application/ports'

type RenderFailureCategory = typeof resumeRenderFailureCategories[number]
type RenderAttempt = Readonly<{ ok: true; result: ResumeRenderResult }> | Readonly<{ ok: false; category: RenderFailureCategory }>
type RendererDependencies = Readonly<{ request: typeof fetch; telemetry: PrivacySafeTelemetry; timeoutMilliseconds: number }>

const transientCategories: ReadonlySet<RenderFailureCategory> = new Set(['timeout', 'server', 'network'])
/**
 * A render launches Chromium on the server, which takes about 25 s on a cold Lambda. Wait up to 90 s: below Cloudflare's
 * 100 s proxy limit and the Lambda's 120 s timeout, so the browser never gives up on a render the server will finish.
 */
const renderTimeoutMilliseconds = 90_000

export function createBrowserResumeDocumentRenderer({ request = fetch, telemetry, timeoutMilliseconds = renderTimeoutMilliseconds }: Readonly<{
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
  if (!response.ok) return failed(await classifyRejectedResponse(response))
  const parsed = resumeRenderResponseSchema.safeParse(await response.json().catch(() => undefined))
  if (!parsed.success) return failed('schema')
  const { assessment } = parsed.data
  if (assessment.layout.revision !== input.draft.revision
    || assessment.exportEligibility.revision !== input.draft.revision) return failed('revision-mismatch')
  return { ok: true, result: parsed.data }
}

/** The server failed to render when it answers provider-unavailable; a bare 5xx comes from the infrastructure. */
async function classifyRejectedResponse(response: Response): Promise<RenderFailureCategory> {
  const failure = apiFailureSchema.safeParse(await response.json().catch(() => undefined))
  if (failure.success && failure.data.error.type === 'provider-unavailable') return 'render'
  const { status } = response
  if (status === 504) return 'timeout'
  if (status >= 500 || status === 429) return 'server'
  if (status === 401 || status === 403) return 'access'
  return 'schema'
}

function failed(category: RenderFailureCategory): RenderAttempt {
  return { ok: false, category }
}
