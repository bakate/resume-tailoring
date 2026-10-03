import { assessResumeExport, unavailableResumeRender } from '@resume-tailoring/application/candidate-journey'
import type { ResumeRenderRequest } from '@resume-tailoring/application/candidate-journey'
import { createRecordingTelemetry } from '@resume-tailoring/application/testing'
import { groupedResumeDocument, resumeContractRevision } from '@resume-tailoring/application/structured-resume-fixtures'
import { describe, expect, it, vi } from 'vitest'

import { createBrowserResumeDocumentRenderer } from './browser-resume-document-renderer'

describe('browser resume document renderer', () => {
  const transientFailures = [
    ['server', () => new Response(null, { status: 503 })],
    ['network', () => { throw new TypeError('Failed to fetch') }],
    ['timeout', 'hang'],
  ] as const

  it.each(transientFailures)('silently retries a transient %s failure once', async (_category, failure) => {
    const { render, telemetry, calls } = rendererAnswering([failure, measuredResponse])

    const result = await render(renderRequest)

    expect(result.assessment.layout.status).toBe('fits')
    expect(calls()).toBe(2)
    expect(telemetry).toEqual([])
  })

  it.each(transientFailures)('records a persistent %s failure after one retry', async (category, failure) => {
    const { render, telemetry, calls } = rendererAnswering([failure, failure, measuredResponse])

    expect(await render(renderRequest)).toEqual(unavailableResumeRender(renderRequest))
    expect(calls()).toBe(2)
    expect(telemetry).toEqual([{ name: 'resume-render-failed', category, retried: true }])
  })

  it.each([
    ['access', () => new Response(null, { status: 401 })],
    ['access', () => new Response(null, { status: 403 })],
    ['schema', () => new Response(null, { status: 400 })],
    ['revision-mismatch', () => Response.json(measuredBody({ revision: 'previous-revision' }))],
    ['render', () => Response.json({ ...unavailableResumeRender(renderRequest), pdf: null })],
  ] as const)('records a deterministic %s failure without retrying', async (category, failure) => {
    const { render, telemetry, calls } = rendererAnswering([failure, measuredResponse])

    expect(await render(renderRequest)).toEqual(unavailableResumeRender(renderRequest))
    expect(calls()).toBe(1)
    expect(telemetry).toEqual([{ name: 'resume-render-failed', category, retried: false }])
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
  return { render: renderer.render, telemetry: telemetry.events, calls: () => request.mock.calls.length }
}
