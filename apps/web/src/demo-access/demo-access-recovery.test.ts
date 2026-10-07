import { describe, expect, it } from 'vitest'

import { createAccessRecoveringRequest, createDemoAccessRecovery } from './demo-access-recovery'
import type { DemoAccessRenewal } from './demo-access-recovery'

describe('demo access recovery', () => {
  it('replays a request once the Candidate renews expired access', async () => {
    const { calls, renewals, request } = createHarness({ responses: { '/api/a': [expiredAccess(), success()] } })

    const response = request('/api/a', { method: 'POST', body: '{"section":"summary"}' })
    await waitUntil(() => renewals.length > 0)
    renewals[0]?.settle(true)

    expect((await response).status).toBe(200)
    expect(calls).toEqual([['/api/a', '{"section":"summary"}'], ['/api/a', '{"section":"summary"}']])
  })

  it('returns the expired response when the Candidate does not renew access', async () => {
    const { calls, renewals, request } = createHarness({ responses: { '/api/a': [expiredAccess()] } })

    const response = request('/api/a', {})
    await waitUntil(() => renewals.length > 0)
    renewals[0]?.settle(false)

    expect((await response).status).toBe(401)
    expect(calls).toHaveLength(1)
  })

  it('fails renewal immediately when no gate can run the security check', async () => {
    const recovery = createDemoAccessRecovery()

    await expect(recovery.renew(recovery.readGeneration())).resolves.toBe(false)
  })

  it('asks for one security check when concurrent requests expire together', async () => {
    const { renewals, request } = createHarness({ responses: {
      '/api/a': [expiredAccess(), success()], '/api/b': [expiredAccess(), success()],
    } })

    const responses = Promise.all([request('/api/a', {}), request('/api/b', {})])
    await waitUntil(() => renewals.length > 0)
    renewals[0]?.settle(true)

    expect((await responses).map(({ status }) => status)).toEqual([200, 200])
    expect(renewals).toHaveLength(1)
  })

  it('replays a request that expired before a granted renewal without a second security check', async () => {
    const lateResponse = createDeferred<Response>()
    const { renewals, request } = createHarness({ responses: {
      '/api/early': [expiredAccess(), success()], '/api/late': [lateResponse.promise, success()],
    } })

    const late = request('/api/late', {})
    const early = request('/api/early', {})
    await waitUntil(() => renewals.length > 0)
    renewals[0]?.settle(true)
    await early
    lateResponse.resolve(expiredAccess())

    expect((await late).status).toBe(200)
    expect(renewals).toHaveLength(1)
  })

  it('stops waiting for renewal when the caller aborts the request', async () => {
    const { renewals, request } = createHarness({ responses: { '/api/a': [expiredAccess()] } })
    const controller = new AbortController()

    const response = request('/api/a', { signal: controller.signal })
    await waitUntil(() => renewals.length > 0)
    controller.abort(new DOMException('The render took too long', 'TimeoutError'))

    await expect(response).rejects.toMatchObject({ name: 'TimeoutError' })
  })

  it('abandons a pending renewal when the gate stops handling renewals', async () => {
    const { calls, renewals, request, stopHandling } = createHarness({ responses: { '/api/a': [expiredAccess()] } })

    const response = request('/api/a', {})
    await waitUntil(() => renewals.length > 0)
    stopHandling()

    expect((await response).status).toBe(401)
    expect(calls).toHaveLength(1)
  })

  it('leaves other unauthorized responses untouched', async () => {
    const { calls, renewals, request } = createHarness({ responses: {
      '/api/a': [Response.json({ ok: false, error: { type: 'demo-origin-required' } }, { status: 401 })],
    } })

    const response = await request('/api/a', {})

    expect(response.status).toBe(401)
    expect(calls).toHaveLength(1)
    expect(renewals).toHaveLength(0)
  })
})

function createHarness({ responses }: Readonly<{ responses: Record<string, (Response | Promise<Response>)[]> }>) {
  const calls: unknown[][] = []
  const renewals: DemoAccessRenewal[] = []
  const recovery = createDemoAccessRecovery()
  const stopHandling = recovery.handleRenewals((renewal) => { renewals.push(renewal) })
  const request = createAccessRecoveringRequest({
    recovery,
    request: (input, init) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push([path, init?.body])
      const response = responses[path]?.shift()
      return response === undefined ? Promise.reject(new Error(`Unexpected request to ${path}`)) : Promise.resolve(response)
    },
  })
  return { calls, renewals, request, stopHandling }
}

function expiredAccess() {
  return Response.json({ ok: false, error: { type: 'demo-access-required' } }, { status: 401 })
}

function success() {
  return Response.json({ ok: true, value: {} })
}

function createDeferred<TValue>() {
  let resolve: (value: TValue) => void = () => undefined
  const promise = new Promise<TValue>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

async function waitUntil(condition: () => boolean) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 0))
}
