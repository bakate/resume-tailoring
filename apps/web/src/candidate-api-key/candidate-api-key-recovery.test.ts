import { describe, expect, it } from 'vitest'

import { createCandidateApiKeyRecovery, createCandidateApiKeyRequest } from './candidate-api-key-recovery'
import type { CandidateApiKeyRequest } from './candidate-api-key-recovery'
import { candidateApiKeyProcessingPolicy, createCandidateApiKeyStore } from './candidate-api-key-store'
import { createDailyQuotaStore } from './daily-quota'

const candidateApiKey = 'sk-proj-CandidateSecret0123456789abcdef'
const preparationPath = '/api/explainable-job-posting-extraction'

describe('Candidate API Key recovery', () => {
  it('signs model-backed requests with the Candidate API Key once one is entered', async () => {
    const { calls, request } = createHarness({ storedKey: candidateApiKey, responses: { [preparationPath]: [success()] } })

    await request(preparationPath, { method: 'POST', body: '{}' })

    expect(calls).toEqual([{ path: preparationPath, body: '{}', candidateApiKey }])
  })

  it('never sends the Candidate API Key with a PDF render or analytics', async () => {
    const { calls, request } = createHarness({ storedKey: candidateApiKey, responses: {
      '/api/resume-document': [success()], '/api/analytics': [success()],
    } })

    await request('/api/resume-document', { method: 'POST', body: '{}' })
    await request('/api/analytics', { method: 'POST', body: '{}' })

    expect(calls.map(({ candidateApiKey: sent }) => sent)).toEqual([null, null])
  })

  it('resumes a preparation refused past the Daily Quota once the Candidate enters a valid key', async () => {
    const { calls, keys, requests, request } = createHarness({ responses: {
      [preparationPath]: [dailyQuotaReached({ scope: 'daily-quota' }), success()],
    } })

    const response = request(preparationPath, { method: 'POST', body: '{"jobPostingContent":"Engineer"}' })
    await waitUntil(() => requests.length > 0)
    keys.save({ apiKey: candidateApiKey, grantedAt: 1 })
    requests[0]?.settle(true)

    expect((await response).status).toBe(200)
    expect(calls).toEqual([
      { path: preparationPath, body: '{"jobPostingContent":"Engineer"}', candidateApiKey: null },
      { path: preparationPath, body: '{"jobPostingContent":"Engineer"}', candidateApiKey },
    ])
  })

  it('tells the wall which limit was reached and when it resets', async () => {
    const { requests, request } = createHarness({ responses: { [preparationPath]: [dailyQuotaReached({ scope: 'overall' })] } })

    void request(preparationPath, { method: 'POST', body: '{}' })
    await waitUntil(() => requests.length > 0)

    expect(requests[0]?.request).toEqual({ reason: 'daily-quota-reached', scope: 'overall', resetAt: '2026-10-08T22:00:00.000Z' })
  })

  it('keeps the refusal when the Candidate chooses to come back tomorrow', async () => {
    const { calls, requests, request } = createHarness({ responses: { [preparationPath]: [dailyQuotaReached({ scope: 'daily-quota' })] } })

    const response = request(preparationPath, { method: 'POST', body: '{}' })
    await waitUntil(() => requests.length > 0)
    requests[0]?.settle(false)

    expect((await response).status).toBe(429)
    expect(calls).toHaveLength(1)
  })

  it('opens one wall when concurrent requests reach the Daily Quota together', async () => {
    const { keys, requests, request } = createHarness({ responses: {
      [preparationPath]: [dailyQuotaReached({ scope: 'daily-quota' }), success()],
      '/api/resume-section-writing': [dailyQuotaReached({ scope: 'model-requests' }), success()],
    } })

    const responses = Promise.all([request(preparationPath, {}), request('/api/resume-section-writing', {})])
    await waitUntil(() => requests.length > 0)
    keys.save({ apiKey: candidateApiKey, grantedAt: 1 })
    requests[0]?.settle(true)

    expect((await responses).map(({ status }) => status)).toEqual([200, 200])
    expect(requests).toHaveLength(1)
  })

  it('never opens the wall for a request that already carried a Candidate API Key', async () => {
    const { requests, request } = createHarness({ storedKey: candidateApiKey, responses: {
      [preparationPath]: [Response.json({ ok: false, error: { type: 'candidate-api-key-invalid' } }, { status: 401 })],
    } })

    const response = await request(preparationPath, {})

    expect(response.status).toBe(401)
    expect(requests).toHaveLength(0)
  })

  it('leaves a provider rate limit to its own wait-and-retry Recovery', async () => {
    const { requests, request } = createHarness({ responses: {
      [preparationPath]: [Response.json({ ok: false, error: { type: 'rate-limited', retryAfterSeconds: 20 } }, { status: 429 })],
    } })

    const response = await request(preparationPath, {})

    expect(response.status).toBe(429)
    expect(requests).toHaveLength(0)
  })

  it('remembers how many Tailored Resumes remain today from the edge headers', async () => {
    const { dailyQuota, request } = createHarness({ responses: { [preparationPath]: [success({ remaining: 2 })] } })

    await request(preparationPath, {})

    expect(dailyQuota.read()).toEqual({ remaining: 2, resetAt: '2026-10-08T22:00:00.000Z' })
  })

  it('fails the wall immediately when nothing can show it', async () => {
    const recovery = createCandidateApiKeyRecovery()

    await expect(recovery.request({ reason: 'enter-key' })).resolves.toBe(false)
  })
})

describe('Candidate API Key storage', () => {
  it('keeps the Candidate API Key in this tab only, with consent to its Processing Policy', () => {
    const tab = createMemoryStorage()
    const keys = createCandidateApiKeyStore({ readStorage: () => tab })

    keys.save({ apiKey: candidateApiKey, grantedAt: 1 })

    expect(keys.read()).toEqual({ apiKey: candidateApiKey,
      consent: { grantedAt: 1, policy: candidateApiKeyProcessingPolicy } })
    expect(tab.length).toBe(1)
  })

  it('forgets the Candidate API Key once the Candidate removes it', () => {
    const tab = createMemoryStorage()
    const keys = createCandidateApiKeyStore({ readStorage: () => tab })
    keys.save({ apiKey: candidateApiKey, grantedAt: 1 })

    keys.remove()

    expect(keys.read()).toBeNull()
    expect(tab.length).toBe(0)
  })

  it('ignores a stored key whose consent names another Processing Policy', () => {
    const tab = createMemoryStorage()
    tab.setItem('resume-studio.candidate-api-key', JSON.stringify({ apiKey: candidateApiKey,
      consent: { grantedAt: 1, policy: { ...candidateApiKeyProcessingPolicy, version: '2000-01-01' } } }))

    const keys = createCandidateApiKeyStore({ readStorage: () => tab })

    expect(keys.read()).toBeNull()
  })

  it('keeps nothing when the tab storage is unavailable', () => {
    const keys = createCandidateApiKeyStore({ readStorage: () => { throw new Error('Storage is disabled') } })

    keys.save({ apiKey: candidateApiKey, grantedAt: 1 })

    expect(keys.read()).toBeNull()
  })
})

function createHarness({ responses, storedKey }: Readonly<{
  responses: Record<string, (Response | Promise<Response>)[]>; storedKey?: string
}>) {
  const calls: Readonly<{ path: string; body: unknown; candidateApiKey: string | null }>[] = []
  const requests: CandidateApiKeyRequest[] = []
  const recovery = createCandidateApiKeyRecovery()
  recovery.handleRequests((pending) => { requests.push(pending) })
  const tab = createMemoryStorage()
  const keys = createCandidateApiKeyStore({ readStorage: () => tab })
  if (storedKey !== undefined) keys.save({ apiKey: storedKey, grantedAt: 1 })
  const dailyQuota = createDailyQuotaStore()
  const request = createCandidateApiKeyRequest({
    dailyQuota, keys, recovery,
    request: (input, init) => {
      const path = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      calls.push({ path, body: init?.body, candidateApiKey: new Headers(init?.headers).get('x-candidate-api-key') })
      const response = responses[path]?.shift()
      return response === undefined ? Promise.reject(new Error(`Unexpected request to ${path}`)) : Promise.resolve(response)
    },
  })
  return { calls, dailyQuota, keys, requests, request }
}

function dailyQuotaReached({ scope }: Readonly<{ scope: string }>) {
  return Response.json({ ok: false, error: { type: 'daily-quota-reached', retryAfterSeconds: 3600 } }, {
    status: 429, headers: { 'x-resume-quota-scope': scope, 'x-resume-quota-reset': '2026-10-08T22:00:00.000Z' },
  })
}

function success({ remaining }: Readonly<{ remaining?: number }> = {}) {
  return Response.json({ ok: true, value: {} }, { headers: remaining === undefined ? {} : {
    'x-resume-quota-remaining': String(remaining), 'x-resume-quota-reset': '2026-10-08T22:00:00.000Z',
  } })
}

/** One shared memory behind every read, as a tab's `sessionStorage` is. */
function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => { values.clear() },
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}

async function waitUntil(condition: () => boolean) {
  while (!condition()) await new Promise((resolve) => setTimeout(resolve, 0))
}
