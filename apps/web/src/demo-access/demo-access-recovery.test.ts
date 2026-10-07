import { describe, expect, it } from 'vitest'

import { createAccessRecoveringRequest, createDemoAccessRecovery } from './demo-access-recovery'
import type { DemoAccessRenewal } from './demo-access-recovery'

describe('demo access recovery', () => {
  it('replays a request once the Candidate renews expired access', async () => {
    const { calls, recovery, request } = createHarness({ responses: [expiredAccess(), success()] })
    recovery.handleRenewals(({ settle }) => { settle(true) })

    const response = await request('/api/resume-section-writing', { method: 'POST', body: '{"section":"summary"}' })

    expect(response.status).toBe(200)
    expect(calls).toEqual(['{"section":"summary"}', '{"section":"summary"}'])
  })

  it('returns the expired response when the Candidate does not renew access', async () => {
    const { calls, recovery, request } = createHarness({ responses: [expiredAccess()] })
    recovery.handleRenewals(({ settle }) => { settle(false) })

    const response = await request('/api/resume-section-writing', { method: 'POST', body: '{}' })

    expect(response.status).toBe(401)
    expect(calls).toHaveLength(1)
  })

  it('fails renewal immediately when no gate can run the security check', async () => {
    const { recovery } = createHarness({ responses: [] })

    await expect(recovery.renew()).resolves.toBe(false)
  })

  it('asks for one security check when concurrent requests expire together', async () => {
    const { recovery, request } = createHarness({ responses: [expiredAccess(), expiredAccess(), success(), success()] })
    const renewals: DemoAccessRenewal[] = []
    recovery.handleRenewals((renewal) => { renewals.push(renewal) })

    const responses = Promise.all([request('/api/a', {}), request('/api/b', {})])
    await waitUntil(() => renewals.length > 0)
    renewals[0]?.settle(true)

    expect((await responses).map(({ status }) => status)).toEqual([200, 200])
    expect(renewals).toHaveLength(1)
  })

  it('leaves other unauthorized responses untouched', async () => {
    const { calls, recovery, request } = createHarness({
      responses: [Response.json({ ok: false, error: { type: 'demo-origin-required' } }, { status: 401 })],
    })
    recovery.handleRenewals(({ settle }) => { settle(true) })

    const response = await request('/api/resume-section-writing', {})

    expect(response.status).toBe(401)
    expect(calls).toHaveLength(1)
  })
})

function createHarness({ responses }: Readonly<{ responses: Response[] }>) {
  const calls: unknown[] = []
  const recovery = createDemoAccessRecovery()
  const request = createAccessRecoveringRequest({
    recovery,
    request: (_input, init) => {
      calls.push(init?.body)
      const response = responses.shift()
      return response === undefined ? Promise.reject(new Error('Unexpected request')) : Promise.resolve(response)
    },
  })
  return { calls, recovery, request }
}

function expiredAccess() {
  return Response.json({ ok: false, error: { type: 'demo-access-required' } }, { status: 401 })
}

function success() {
  return Response.json({ ok: true, value: {} })
}

async function waitUntil(condition: () => boolean) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 0))
}
