import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createDemoAccessCookie } from './demo-access/demo-access-session'
import { Route as AnalyticsRoute } from './routes/api.analytics'
import { Route as ResumeSectionWritingRoute } from './routes/api.resume-section-writing'

const environment = {
  DEMO_ACCESS_MODE: 'enforced',
  DEMO_ORIGIN_SECRET: 'an-origin-secret-with-at-least-32-characters',
  DEMO_PUBLIC_HOSTNAME: 'resume-studio.example.workers.dev',
  DEMO_SESSION_SECRET: 'a-session-secret-with-at-least-32-characters',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  TURNSTILE_SITE_KEY: 'turnstile-site-key',
} as const
const analyticsEvent = { name: 'resume-tailoring-opened' }

describe('API route guards', () => {
  beforeEach(() => {
    Object.entries(environment).forEach(([name, value]) => vi.stubEnv(name, value))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('rejects analytics that bypass the edge', async () => {
    const response = await postTo(AnalyticsRoute, createRequest({ body: analyticsEvent, headers: { cookie: createCookie() } }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'demo-origin-required' } })
  })

  it('rejects analytics without demo access when access is enforced', async () => {
    const response = await postTo(AnalyticsRoute, createRequest({ body: analyticsEvent, headers: originHeaders }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'demo-access-required' } })
  })

  it('records analytics that came through the edge with demo access', async () => {
    const writeEvent = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const request = createRequest({ body: analyticsEvent, headers: { ...originHeaders, cookie: createCookie() } })

    const response = await postTo(AnalyticsRoute, request)

    expect(response.status).toBe(202)
    expect(writeEvent).toHaveBeenCalledOnce()
  })

  it('rejects an oversized model request from its declared length before reading it', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    const request = createRequest({
      body: {},
      headers: { ...originHeaders, cookie: createCookie(), 'content-length': '500001' },
    })

    const response = await postTo(ResumeSectionWritingRoute, request)

    expect(response.status).toBe(413)
    expect(request.bodyUsed).toBe(false)
    await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'input-too-large' } })
  })

  it('rejects an oversized model request without a declared length while reading it', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    const request = createRequest({
      body: { content: 'x'.repeat(500_000) },
      headers: { ...originHeaders, cookie: createCookie() },
    })

    const response = await postTo(ResumeSectionWritingRoute, request)

    expect(request.headers.has('content-length')).toBe(false)
    expect(response.status).toBe(413)
    await expect(response.json()).resolves.toEqual({ ok: false, error: { type: 'input-too-large' } })
  })
})

type ServerRoute = Readonly<{ options: Readonly<{ server?: unknown }> }>
type PostHandler = (context: Readonly<{ request: Request }>) => Promise<Response> | Response

function postTo(route: ServerRoute, request: Request) {
  const { handlers } = route.options.server as Readonly<{ handlers: Readonly<{ POST: PostHandler }> }>
  return Promise.resolve(handlers.POST({ request }))
}

function createRequest({ body, headers }: Readonly<{ body: unknown; headers: Record<string, string> }>) {
  return new Request('https://resume-studio.example/api', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  })
}

function createCookie() {
  return createDemoAccessCookie({
    issuedAtMilliseconds: Date.now(),
    sessionSecret: environment.DEMO_SESSION_SECRET,
  })
}

const originHeaders = { 'x-resume-studio-origin': environment.DEMO_ORIGIN_SECRET }
