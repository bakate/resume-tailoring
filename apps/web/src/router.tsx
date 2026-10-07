import { createRouter } from '@tanstack/react-router'

import { GlobalErrorFallback } from './global-error-fallback'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    defaultErrorComponent: GlobalErrorFallback,
    routeTree,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
