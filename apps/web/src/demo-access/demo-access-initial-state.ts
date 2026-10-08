import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { createDemoOriginGuardResponse, readDemoAccessDecision } from './demo-access-authorization'

export type InitialDemoAccess =
  | Readonly<{ status: 'granted' }>
  | Readonly<{ status: 'challenge'; siteKey: string }>
  | Readonly<{ status: 'unknown' }>

/**
 * Decides demo access from the request that renders the page, so a Candidate whose access is still valid never sees
 * the security check while the browser asks for it again. Anything this request cannot decide is left to the browser.
 */
export const readInitialDemoAccess = createServerFn({ method: 'GET' }).handler((): InitialDemoAccess => {
  const request = getRequest()
  if (createDemoOriginGuardResponse({ request }) !== null) return unknownAccess
  const decision = readDemoAccessDecision({ cookieHeader: request.headers.get('cookie') ?? '', environment: process.env })
  if (!decision.ok) return unknownAccess
  return decision.value.access === 'granted'
    ? { status: 'granted' }
    : { status: 'challenge', siteKey: decision.value.siteKey }
})

const unknownAccess = { status: 'unknown' } as const
