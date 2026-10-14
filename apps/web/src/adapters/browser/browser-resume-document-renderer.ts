import { unavailableResumeRender, unfittedPageBudget } from '@resume-tailoring/application/candidate-journey'
import type { PageBudgetFit, PageBudgetFitRequest, ResumeLayoutAssessment, ResumeRenderRequest,
  ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { resumeRenderFailureCategories } from '@resume-tailoring/application/privacy-safe-telemetry'
import type { z } from 'zod'
import { pageBudgetFitResponseSchema, resumeRenderResponseSchema } from '../../candidate-journey/resume-render-schema'
import type { PrivacySafeTelemetry, ReadApiFailure, ResumeDocumentRenderer } from '@resume-tailoring/application/ports'
import { networkFailure, readApiFailure, unexpectedResponse } from './api-failure-reader'

type RenderFailureCategory = typeof resumeRenderFailureCategories[number]
type RenderAttempt<TResult> = Readonly<{ ok: true; result: TResult }>
  | Readonly<{ ok: false; category: RenderFailureCategory; apiFailure: ReadApiFailure }>
/** One render route: where it answers, and the assessment its answer carries for the request's revision. */
type RenderRoute<TResult> = Readonly<{
  path: string
  schema: z.ZodType<TResult>
  readAssessment: (result: TResult) => ResumeLayoutAssessment
}>
type RendererDependencies = Readonly<{ request: typeof fetch; telemetry: PrivacySafeTelemetry; timeoutMilliseconds: number }>

export const resumeDocumentWarmUpPath = '/api/resume-document-warm-up'
export const resumeDocumentPath = '/api/resume-document'
export const resumeDocumentFitPath = '/api/resume-document-fit'

const renderRoute: RenderRoute<ResumeRenderResult> = { path: resumeDocumentPath, schema: resumeRenderResponseSchema,
  readAssessment: ({ assessment }) => assessment }
const fitRoute: RenderRoute<PageBudgetFit> = { path: resumeDocumentFitPath, schema: pageBudgetFitResponseSchema,
  readAssessment: ({ render }) => render.assessment }

const transientCategories: ReadonlySet<RenderFailureCategory> = new Set(['timeout', 'server', 'network'])
/**
 * A render on a cold Lambda launches Chromium first, which takes about 25 s with the render; the warm-up launches it
 * earlier. Wait up to 90 s: below Cloudflare's 100 s proxy limit and the Lambda's 120 s timeout, so the browser never
 * gives up on a render the server will finish.
 */
const renderTimeoutMilliseconds = 90_000

export function createBrowserResumeDocumentRenderer({ request = fetch, telemetry, timeoutMilliseconds = renderTimeoutMilliseconds }: Readonly<{
  request?: typeof fetch; telemetry: PrivacySafeTelemetry; timeoutMilliseconds?: number
}>): ResumeDocumentRenderer {
  return {
    render: (input) => renderDocument({ input, dependencies: { request, telemetry, timeoutMilliseconds } }),
    fitToPageBudget: (input) => fitDocument({ input, dependencies: { request, telemetry, timeoutMilliseconds } }),
    warmUp: () => { warmUpServerRenderer({ request, timeoutMilliseconds }) },
  }
}

/**
 * Asks the server to launch its browser while Resume Sections are written. The request has no body, and its route is
 * not the render route, so it counts against no render limit. A failed warm-up only leaves the first render cold.
 */
function warmUpServerRenderer({ request, timeoutMilliseconds }: Readonly<{
  request: typeof fetch; timeoutMilliseconds: number
}>) {
  void request(resumeDocumentWarmUpPath, { method: 'POST', cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMilliseconds) }).catch(() => undefined)
}

async function renderDocument({ input, dependencies }: Readonly<{
  input: ResumeRenderRequest; dependencies: RendererDependencies
}>) {
  const attempt = await attemptWithRetry({ route: renderRoute, body: input, revision: input.draft.revision, dependencies })
  return attempt.ok ? attempt.result : unavailableResumeRender(input, attempt.apiFailure)
}

/**
 * Fits the resume to its Page Budget on the server in one request, which the edge counts as one render. When the
 * server cannot fit it, the resume stays unchanged and unmeasured, and the preview renders it as any other.
 */
async function fitDocument({ input, dependencies }: Readonly<{
  input: PageBudgetFitRequest; dependencies: RendererDependencies
}>): Promise<PageBudgetFit> {
  const attempt = await attemptWithRetry({ route: fitRoute, body: input, revision: input.draft.revision, dependencies })
  return attempt.ok ? attempt.result : unfittedPageBudget({ request: input, apiFailure: attempt.apiFailure })
}

/** Retries a transient failure once, then records the failure that remains. */
async function attemptWithRetry<TResult>({ route, body, revision, dependencies }: Readonly<{
  route: RenderRoute<TResult>; body: unknown; revision: string; dependencies: RendererDependencies
}>): Promise<RenderAttempt<TResult>> {
  const first = await attemptRender({ route, body, revision, dependencies })
  const retried = !first.ok && transientCategories.has(first.category)
  const final = retried ? await attemptRender({ route, body, revision, dependencies }) : first
  if (!final.ok) void dependencies.telemetry.record({ name: 'resume-render-failed', category: final.category, retried })
  return final
}

async function attemptRender<TResult>({ route, body, revision, dependencies }: Readonly<{
  route: RenderRoute<TResult>; body: unknown; revision: string; dependencies: RendererDependencies
}>): Promise<RenderAttempt<TResult>> {
  const { request, timeoutMilliseconds } = dependencies
  let response: Response
  try {
    response = await request(route.path, { method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMilliseconds) })
  } catch (error) {
    return error instanceof DOMException && error.name === 'TimeoutError'
      ? failed('timeout', { type: 'timeout' }) : failed('network', networkFailure)
  }
  if (!response.ok) {
    const apiFailure = await readApiFailure(response)
    return failed(classifyRejectedResponse({ response, apiFailure }), apiFailure)
  }
  const parsed = route.schema.safeParse(await response.json().catch(() => undefined))
  if (!parsed.success) return failed('schema', unexpectedResponse)
  const assessment = route.readAssessment(parsed.data)
  if (assessment.layout.revision !== revision
    || assessment.exportEligibility.revision !== revision) return failed('revision-mismatch', unexpectedResponse)
  return { ok: true, result: parsed.data }
}

/** The server failed to render when it answers provider-unavailable; a bare 5xx comes from the infrastructure. */
function classifyRejectedResponse({ response, apiFailure }: Readonly<{
  response: Response; apiFailure: ReadApiFailure
}>): RenderFailureCategory {
  if (apiFailure.type === 'provider-unavailable') return 'render'
  const { status } = response
  if (status === 504) return 'timeout'
  if (status >= 500 || status === 429) return 'server'
  if (status === 401 || status === 403) return 'access'
  return 'schema'
}

/** The API Failure is kept for the application, which explains it to the Candidate. */
function failed(category: RenderFailureCategory, apiFailure: ReadApiFailure): RenderAttempt<never> {
  return { ok: false, category, apiFailure }
}
