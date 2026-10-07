import { z } from 'zod'

export type DemoAccessRenewal = Readonly<{ settle: (granted: boolean) => void }>

export type DemoAccessRecovery = Readonly<{
  /** Resolves true once the Candidate has passed a new security check. Concurrent callers share one renewal. */
  renew: () => Promise<boolean>
  /** The gate that can run the security check; without one, renewal fails immediately. */
  handleRenewals: (handler: (renewal: DemoAccessRenewal) => void) => () => void
}>

export function createDemoAccessRecovery(): DemoAccessRecovery {
  let handler: ((renewal: DemoAccessRenewal) => void) | null = null
  let pendingRenewal: Promise<boolean> | null = null
  return {
    renew: () => {
      if (handler === null) return Promise.resolve(false)
      const startRenewal = handler
      pendingRenewal ??= new Promise<boolean>((resolve) => {
        let isSettled = false
        startRenewal({ settle: (granted) => {
          if (isSettled) return
          isSettled = true
          pendingRenewal = null
          resolve(granted)
        } })
      })
      return pendingRenewal
    },
    handleRenewals: (nextHandler) => {
      handler = nextHandler
      return () => {
        if (handler === nextHandler) handler = null
      }
    },
  }
}

/**
 * The demo access cookie expires while the Candidate keeps working. Instead of surfacing every expired request as a
 * service failure, this request waits for the Candidate to renew access and replays the request once.
 */
export function createAccessRecoveringRequest({ recovery, request }: Readonly<{
  recovery: DemoAccessRecovery
  request: typeof fetch
}>): typeof fetch {
  return async (input, init) => {
    const response = await request(input, init)
    if (!await requiresDemoAccess(response)) return response
    return await recovery.renew() ? request(input, init) : response
  }
}

async function requiresDemoAccess(response: Response) {
  if (response.status !== 401) return false
  try {
    return demoAccessRequiredSchema.safeParse(await response.clone().json()).success
  } catch {
    return false
  }
}

const demoAccessRequiredSchema = z.object({ ok: z.literal(false), error: z.object({ type: z.literal('demo-access-required') }) })

/** One recovery per page: the Candidate Journey adapters and the demo access gate must share it. */
export const demoAccessRecovery = createDemoAccessRecovery()
