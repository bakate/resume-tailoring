import './security-headers/zod-without-eval'
import { createRouter } from '@tanstack/react-router'
import { createIsomorphicFn, getGlobalStartContext } from '@tanstack/react-start'

import { GlobalErrorFallback } from './global-error-fallback'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    defaultErrorComponent: GlobalErrorFallback,
    routeTree,
    scrollRestoration: true,
    ssr: { nonce: readRequestNonce() },
  })
}

/** The server stamps the request's CSP nonce on every inline script; the browser reads it back from the page. */
const readRequestNonce = createIsomorphicFn()
  .server(() => getGlobalStartContext()?.nonce)
  .client(() => undefined)

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
