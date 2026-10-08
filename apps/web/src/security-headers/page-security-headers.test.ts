import { describe, expect, it } from 'vitest'

import { createCspNonce, withPageSecurityHeaders } from './page-security-headers'

const nonce = 'cmFuZG9tLW5vbmNlLXZhbHVl'

describe('page security headers', () => {
  it('serves a page under a strict policy bound to the request nonce', () => {
    const response = withPageSecurityHeaders({ nonce, response: htmlPage() })

    expect(readPolicy(response)).toEqual({
      'base-uri': ["'none'"],
      'connect-src': ["'self'"],
      'default-src': ["'self'"],
      'font-src': ["'self'", 'data:'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'frame-src': ["'self'", 'https://challenges.cloudflare.com', 'blob:'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'object-src': ["'none'"],
      'script-src': ["'self'", `'nonce-${nonce}'`, 'https://challenges.cloudflare.com'],
      'style-src': ["'self'", "'unsafe-inline'"],
      'worker-src': ["'self'", 'blob:'],
    })
  })

  it('sends the baseline security headers with every response', () => {
    const response = withPageSecurityHeaders({ nonce, response: Response.json({ ok: true }) })

    expect(response.headers.get('content-security-policy')).not.toBeNull()
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()')
  })

  it('keeps the status and body of the page it secures', async () => {
    const response = withPageSecurityHeaders({ nonce, response: htmlPage({ status: 404 }) })

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await response.text()).toBe('<!doctype html><title>Page</title>')
  })

  it('secures a response whose headers cannot be changed', () => {
    const response = withPageSecurityHeaders({
      nonce,
      response: Response.redirect('https://resume.example/', 307),
    })

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://resume.example/')
    expect(response.headers.get('content-security-policy')).toContain(`'nonce-${nonce}'`)
  })

  it('creates a fresh unguessable nonce for each request', () => {
    const nonces = Array.from({ length: 50 }, () => createCspNonce())

    expect(new Set(nonces).size).toBe(nonces.length)
    for (const value of nonces) {
      expect(value).toMatch(/^[A-Za-z0-9+/]{22}==$/)
    }
  })
})

function htmlPage({ status = 200 }: Readonly<{ status?: number }> = {}) {
  return new Response('<!doctype html><title>Page</title>', {
    headers: { 'content-type': 'text/html; charset=utf-8' },
    status,
  })
}

function readPolicy(response: Response) {
  const header = response.headers.get('content-security-policy')
  if (header === null) throw new Error('The response has no Content-Security-Policy header.')
  return Object.fromEntries(header.split(';').map((directive) => {
    const [name = '', ...sources] = directive.trim().split(/\s+/)
    return [name, sources]
  }))
}
