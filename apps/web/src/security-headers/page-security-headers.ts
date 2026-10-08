const turnstileOrigin = 'https://challenges.cloudflare.com'

/**
 * Serves a response under the page Content-Security-Policy, so a script injected into our origin can neither load from
 * nor send the Candidate Session to another host. Inline scripts run only when they carry the request nonce.
 *
 * Styles stay `'unsafe-inline'`: Mantine writes style attributes, and the Tailored Resume preview's `srcdoc` iframe
 * inherits this policy for its own inline stylesheet. A style alone cannot reach another host while `connect-src`,
 * `img-src` and `font-src` keep every request on our origin.
 */
export function withPageSecurityHeaders({ nonce, response }: Readonly<{
  nonce: string
  response: Response
}>): Response {
  const headers = new Headers(response.headers)
  headers.set('content-security-policy', createContentSecurityPolicy({ nonce }))
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('referrer-policy', 'no-referrer')
  headers.set('x-content-type-options', 'nosniff')
  return new Response(response.body, { headers, status: response.status, statusText: response.statusText })
}

/** 128 random bits, encoded for a `'nonce-…'` source. */
export function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes))
}

function createContentSecurityPolicy({ nonce }: Readonly<{ nonce: string }>) {
  const directives: Readonly<Record<string, ReadonlyArray<string>>> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, turnstileOrigin],
    // `'self'` also covers the development server's same-origin hot reload socket.
    'connect-src': ["'self'"],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'frame-src': ["'self'", turnstileOrigin, 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(' ')}`).join('; ')
}
