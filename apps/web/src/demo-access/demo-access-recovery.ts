import { z } from 'zod'

export type DemoAccessRenewal = Readonly<{ settle: (granted: boolean) => void }>

/** Counts granted renewals, so a request can tell whether access was renewed after it was sent. */
export type DemoAccessGeneration = number

export type DemoAccessRecovery = Readonly<{
  readGeneration: () => DemoAccessGeneration
  /**
   * Resolves true once access is renewed after `sentAt`: immediately if a renewal was already granted since then,
   * otherwise after the Candidate passes a new security check. Concurrent callers share one renewal.
   */
  renew: (sentAt: DemoAccessGeneration) => Promise<boolean>
  /** The gate that can run the security check. Stopping abandons a pending renewal; without a gate, renewal fails. */
  handleRenewals: (handler: (renewal: DemoAccessRenewal) => void) => () => void
}>

export function createDemoAccessRecovery(): DemoAccessRecovery {
  let generation: DemoAccessGeneration = 0
  let handler: ((renewal: DemoAccessRenewal) => void) | null = null
  let pending: Readonly<{ promise: Promise<boolean>; settle: (granted: boolean) => void }> | null = null
  const startRenewal = (startHandler: (renewal: DemoAccessRenewal) => void) => {
    let resolveRenewal: (granted: boolean) => void = () => undefined
    const promise = new Promise<boolean>((resolve) => { resolveRenewal = resolve })
    const settle = (granted: boolean) => {
      if (pending?.promise !== promise) return
      pending = null
      if (granted) generation += 1
      resolveRenewal(granted)
    }
    pending = { promise, settle }
    startHandler({ settle })
    return promise
  }
  return {
    readGeneration: () => generation,
    renew: (sentAt) => {
      if (generation > sentAt) return Promise.resolve(true)
      if (pending !== null) return pending.promise
      return handler === null ? Promise.resolve(false) : startRenewal(handler)
    },
    handleRenewals: (nextHandler) => {
      handler = nextHandler
      return () => {
        if (handler !== nextHandler) return
        handler = null
        pending?.settle(false)
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
    const sentAt = recovery.readGeneration()
    const response = await request(input, init)
    if (!await requiresDemoAccess(response)) return response
    return await waitUnlessAborted({ promise: recovery.renew(sentAt), signal: init?.signal }) ? request(input, init) : response
  }
}

/** A caller's timeout keeps running while the Candidate renews access, and ends the wait with the caller's reason. */
function waitUnlessAborted<TValue>({ promise, signal }: Readonly<{
  promise: Promise<TValue>
  signal: AbortSignal | null | undefined
}>): Promise<TValue> {
  if (signal == null) return promise
  if (signal.aborted) return Promise.reject(signal.reason as Error)
  return new Promise((resolve, reject) => {
    const abort = () => { reject(signal.reason as Error) }
    signal.addEventListener('abort', abort, { once: true })
    void promise.then((value) => {
      signal.removeEventListener('abort', abort)
      resolve(value)
    })
  })
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
