import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'

import { createCspNonce, withPageSecurityHeaders } from './security-headers/page-security-headers'

/** Every response leaves through here, on the development server and in production alike. */
const pageSecurityMiddleware = createMiddleware().server(async ({ next }) => {
  const nonce = createCspNonce()
  const result = await next({ context: { nonce } })
  return {
    ...result,
    response: withPageSecurityHeaders({ nonce, response: result.response }),
  }
})

// Declaring request middleware replaces Start's default CSRF protection for server functions, so it is restated here.
const csrfMiddleware = createCsrfMiddleware({ filter: (context) => context.handlerType === 'serverFn' })

export const startInstance = createStart(() => ({
  requestMiddleware: [pageSecurityMiddleware, csrfMiddleware],
}))
