import { describe, expect, it } from 'vitest'

import { createDailyQuotaObservingRequest, createDailyQuotaStore } from './daily-quota'

const preparationPath = '/api/explainable-job-posting-extraction'

describe('Daily Quota observation', () => {
  it('remembers how many Tailored Resumes remain today from the edge headers', async () => {
    const dailyQuota = createDailyQuotaStore()
    const request = createDailyQuotaObservingRequest({ dailyQuota, request: () => Promise.resolve(success({ remaining: 2 })) })

    await request(preparationPath, {})

    expect(dailyQuota.read()).toEqual({ remaining: 2, resetAt: '2026-10-08T22:00:00.000Z' })
  })

  it('returns the refusal past the Daily Quota as it is, for its Recovery to explain', async () => {
    const dailyQuota = createDailyQuotaStore()
    const refusal = Response.json({ ok: false, error: { type: 'daily-quota-reached', retryAfterSeconds: 3600 } }, {
      status: 429, headers: { 'x-resume-quota-remaining': '0', 'x-resume-quota-reset': '2026-10-08T22:00:00.000Z' },
    })
    const request = createDailyQuotaObservingRequest({ dailyQuota, request: () => Promise.resolve(refusal) })

    const response = await request(preparationPath, {})

    expect(response).toBe(refusal)
    expect(dailyQuota.read()).toEqual({ remaining: 0, resetAt: '2026-10-08T22:00:00.000Z' })
  })
})

function success({ remaining }: Readonly<{ remaining: number }>) {
  return Response.json({ ok: true, value: {} }, { headers: {
    'x-resume-quota-remaining': String(remaining), 'x-resume-quota-reset': '2026-10-08T22:00:00.000Z',
  } })
}
