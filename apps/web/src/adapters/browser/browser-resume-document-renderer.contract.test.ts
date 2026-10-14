import { assessResumeExport, unavailableResumeRender } from '@resume-tailoring/application/candidate-journey'
import type { PageBudgetFitRequest, ResumeRenderRequest } from '@resume-tailoring/application/candidate-journey'
import { createRecordingTelemetry } from '@resume-tailoring/application/testing'
import { groupedResumeDocument, resumeContractRevision } from '@resume-tailoring/application/structured-resume-fixtures'
import { describe, expect, it, vi } from 'vitest'

import { failureResponse } from '../../api-failure'
import { createBrowserResumeDocumentRenderer, resumeDocumentFitPath,
  resumeDocumentWarmUpPath } from './browser-resume-document-renderer'

describe('browser resume document renderer', () => {
  const transientFailures = [
    ['server', () => new Response(null, { status: 503 }), { type: 'unexpected-response' }],
    ['network', () => { throw new TypeError('Failed to fetch') }, { type: 'network' }],
    ['timeout', 'hang', { type: 'timeout' }],
  ] as const

  it.each(transientFailures)('silently retries a transient %s failure once', async (_category, failure) => {
    const { render, telemetry, calls } = rendererAnswering([failure, measuredResponse])

    const result = await render(renderRequest)

    expect(result.assessment.layout.status).toBe('fits')
    expect(calls()).toBe(2)
    expect(telemetry).toEqual([])
  })

  it.each(transientFailures)('records a persistent %s failure after one retry', async (category, failure, apiFailure) => {
    const { render, telemetry, calls } = rendererAnswering([failure, failure, measuredResponse])

    expect(await render(renderRequest)).toEqual(unavailableResumeRender(renderRequest, apiFailure))
    expect(calls()).toBe(2)
    expect(telemetry).toEqual([{ name: 'resume-render-failed', category, retried: true }])
  })

  it.each([
    ['access', () => new Response(null, { status: 401 }), { type: 'unexpected-response' }],
    ['access', () => failureResponse({ type: 'demo-origin-required' }), { type: 'demo-origin-required' }],
    ['schema', () => new Response(null, { status: 400 }), { type: 'unexpected-response' }],
    ['revision-mismatch', () => Response.json(measuredBody({ revision: 'previous-revision' })), { type: 'unexpected-response' }],
    ['schema', () => failureResponse({ type: 'input-too-large' }), { type: 'input-too-large' }],
    ['render', () => failureResponse({ type: 'provider-unavailable' }), { type: 'provider-unavailable' }],
  ] as const)('records a deterministic %s failure without retrying', async (category, failure, apiFailure) => {
    const { render, telemetry, calls } = rendererAnswering([failure, measuredResponse])

    expect(await render(renderRequest)).toEqual(unavailableResumeRender(renderRequest, apiFailure))
    expect(calls()).toBe(1)
    expect(telemetry).toEqual([{ name: 'resume-render-failed', category, retried: false }])
  })

  it('fits the Page Budget in one request to its own route, reading the fitted resume and its PDF', async () => {
    const { fitToPageBudget, requests } = rendererAnswering([() => Response.json(fittedBody)])

    const fit = await fitToPageBudget(fitRequest)

    const [path, init] = requests()[0] ?? expect.fail('Expected a fitting request')
    expect(path).toBe(resumeDocumentFitPath)
    expect(JSON.parse(init?.body as string)).toEqual(fitRequest)
    expect(fit).toEqual({ ...fittedBody, render: { ...fittedBody.render, pdf: new TextEncoder().encode('%PDF') } })
  })

  it('leaves the resume unchanged and unmeasured when the server cannot fit it after one retry', async () => {
    const failure = () => failureResponse({ type: 'timeout' })
    const { fitToPageBudget, telemetry, calls } = rendererAnswering([failure, failure])

    const fit = await fitToPageBudget(fitRequest)

    expect(fit).toEqual({ document: fitRequest.draft.document, hiddenFields: [], renderCount: 0,
      render: unavailableResumeRender(renderRequest, { type: 'timeout' }) })
    expect(calls()).toBe(2)
    expect(telemetry).toEqual([{ name: 'resume-render-failed', category: 'timeout', retried: true }])
  })

  it('warms the server renderer up with a request of its own that carries no content', async () => {
    const { warmUp, requests } = rendererAnswering([() => new Response(null, { status: 204 })])

    warmUp()

    await vi.waitFor(() => { expect(requests()).toHaveLength(1) })
    const [path, init] = requests()[0] ?? expect.fail('Expected a warm-up request')
    expect(path).toBe(resumeDocumentWarmUpPath)
    expect(init).toMatchObject({ method: 'POST' })
    expect(init?.body).toBeUndefined()
  })

  it.each([['an unavailable server', () => failureResponse({ type: 'timeout' })],
    ['a network failure', () => { throw new TypeError('Failed to fetch') }]] as const)(
    'ignores a warm-up answered by %s', async (_case, failure) => {
      const { warmUp, telemetry, calls } = rendererAnswering([failure])

      warmUp()

      await vi.waitFor(() => { expect(calls()).toBe(1) })
      expect(telemetry).toEqual([])
    })
})

type Answer = (() => Response) | 'hang'

const renderRequest: ResumeRenderRequest = {
  draft: { document: groupedResumeDocument, revision: resumeContractRevision },
  unsupportedFieldIds: [],
}

function measuredBody({ revision = resumeContractRevision }: Readonly<{ revision?: string }> = {}) {
  const draft = { ...renderRequest.draft, revision }
  return { pdf: btoa('%PDF'),
    assessment: assessResumeExport({ ...renderRequest, draft, layout: { status: 'fits', pageCount: 1, revision } }) }
}

const fitRequest: PageBudgetFitRequest = { draft: renderRequest.draft, restoredFieldIds: [], relevantFactIds: [],
  today: Date.UTC(2026, 9, 14), releasesRestoredContent: false }

const [hiddenProject] = groupedResumeDocument.sections.flatMap((section) => section.section === 'projects' ? section.fields : [])
const fittedBody = { document: { ...groupedResumeDocument, sections: groupedResumeDocument.sections.filter(({ section }) =>
  section !== 'projects') }, renderCount: 3, render: measuredBody(),
hiddenFields: [{ field: hiddenProject, location: { kind: 'section', section: 'projects', fieldId: hiddenProject?.id },
  origin: 'overflow-reduction' }] }

function measuredResponse() {
  return Response.json(measuredBody())
}

function rendererAnswering(answers: readonly Answer[]) {
  const telemetry = createRecordingTelemetry()
  const request = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const answer = answers[request.mock.calls.length - 1]
    if (answer !== 'hang') return answer?.() ?? Promise.reject(new Error('unexpected render request'))
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { reject(init.signal?.reason as Error) })
    })
  })
  const renderer = createBrowserResumeDocumentRenderer({ request, timeoutMilliseconds: 20,
    telemetry })
  return { render: renderer.render, fitToPageBudget: renderer.fitToPageBudget, warmUp: renderer.warmUp, telemetry: telemetry.events,
    calls: () => request.mock.calls.length, requests: () => request.mock.calls }
}
