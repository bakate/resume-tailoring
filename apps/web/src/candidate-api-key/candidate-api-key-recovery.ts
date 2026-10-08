import { z } from 'zod'

import { candidateApiKeyHeaderName } from './candidate-api-key-header'
import { createCandidateApiKeyStore } from './candidate-api-key-store'
import type { CandidateApiKeyStore } from './candidate-api-key-store'
import { createDailyQuotaStore } from './daily-quota'
import type { DailyQuotaStore } from './daily-quota'

/** Which limit refused a preparation: the Candidate's Daily Quota, the global ceiling, or the technical ceiling. */
export type DailyQuotaScope = 'daily-quota' | 'overall' | 'model-requests'

/**
 * Why the Candidate is asked for a Candidate API Key: the Daily Quota refused a request, a key failed and must be
 * changed, or the Candidate chose to enter one.
 */
export type CandidateApiKeyPrompt =
  | Readonly<{ reason: 'daily-quota-reached'; scope: DailyQuotaScope; resetAt: string }>
  | Readonly<{ reason: 'change-key' | 'enter-key' }>

export type CandidateApiKeyRequest = Readonly<{
  request: CandidateApiKeyPrompt
  /** True once a validated key is stored; false when the Candidate comes back tomorrow or cancels. */
  settle: (entered: boolean) => void
}>

export type CandidateApiKeyRecovery = Readonly<{
  /** Resolves once the Candidate enters a key or declines; concurrent callers share one prompt. */
  request: (prompt: CandidateApiKeyPrompt) => Promise<boolean>
  /** The interface that can show the prompt. Stopping abandons a pending one; without it, a prompt fails at once. */
  handleRequests: (handler: (request: CandidateApiKeyRequest) => void) => () => void
}>

export function createCandidateApiKeyRecovery(): CandidateApiKeyRecovery {
  let handler: ((request: CandidateApiKeyRequest) => void) | null = null
  let pending: Readonly<{ promise: Promise<boolean>; settle: (entered: boolean) => void }> | null = null
  const start = (prompt: CandidateApiKeyPrompt, startHandler: (request: CandidateApiKeyRequest) => void) => {
    let resolvePrompt: (entered: boolean) => void = () => undefined
    const promise = new Promise<boolean>((resolve) => { resolvePrompt = resolve })
    const settle = (entered: boolean) => {
      if (pending?.promise !== promise) return
      pending = null
      resolvePrompt(entered)
    }
    pending = { promise, settle }
    startHandler({ request: prompt, settle })
    return promise
  }
  return {
    request: (prompt) => {
      if (pending !== null) return pending.promise
      return handler === null ? Promise.resolve(false) : start(prompt, handler)
    },
    handleRequests: (nextHandler) => {
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
 * Signs model-backed requests with the Candidate API Key of this tab, when there is one. A request the Daily Quota
 * refuses without a key waits for the Candidate to enter one and replays once with it, so the interrupted
 * preparation resumes by itself; a request that already carried a key fails as it is, and its Recovery changes the key.
 */
export function createCandidateApiKeyRequest({ dailyQuota, keys, recovery, request }: Readonly<{
  dailyQuota: DailyQuotaStore
  keys: CandidateApiKeyStore
  recovery: CandidateApiKeyRecovery
  request: typeof fetch
}>): typeof fetch {
  return async (input, init) => {
    if (!modelBackedPaths.has(readPathname(input))) return request(input, init)
    const sentWith = keys.read()
    const response = await request(input, withCandidateApiKey({ apiKey: sentWith?.apiKey, init }))
    dailyQuota.observe(response)
    if (sentWith !== null) return response
    const prompt = await readDailyQuotaPrompt(response)
    if (prompt === null) return response
    const entered = await waitUnlessAborted({ promise: recovery.request(prompt), signal: init?.signal })
    const enteredKey = keys.read()
    return entered && enteredKey !== null
      ? request(input, withCandidateApiKey({ apiKey: enteredKey.apiKey, init }))
      : response
  }
}

function withCandidateApiKey({ apiKey, init }: Readonly<{ apiKey: string | undefined; init: RequestInit | undefined }>) {
  if (apiKey === undefined) return init
  const headers = new Headers(init?.headers)
  headers.set(candidateApiKeyHeaderName, apiKey)
  return { ...init, headers }
}

async function readDailyQuotaPrompt(response: Response): Promise<CandidateApiKeyPrompt | null> {
  if (response.status !== 429) return null
  const scope = dailyQuotaScopeSchema.safeParse(response.headers.get('x-resume-quota-scope'))
  const resetAt = response.headers.get('x-resume-quota-reset')
  if (!scope.success || resetAt === null) return null
  try {
    return dailyQuotaReachedSchema.safeParse(await response.clone().json()).success
      ? { reason: 'daily-quota-reached', scope: scope.data, resetAt }
      : null
  } catch {
    return null
  }
}

/** A caller's timeout keeps running while the Candidate decides, and ends the wait with the caller's reason. */
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

function readPathname(input: Parameters<typeof fetch>[0]) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  return new URL(url, 'https://resume-studio.invalid').pathname
}

/** The routes a Candidate API Key signs; renders and analytics never carry it. */
const modelBackedPaths = new Set([
  '/api/structured-source-profile-extraction',
  '/api/explainable-job-posting-extraction',
  '/api/explainable-match-evidence',
  '/api/resume-claim-validation',
  '/api/resume-claim-writing',
  '/api/resume-section-writing',
  '/api/resume-section-validation',
  '/api/resume-document-coherence',
])
const dailyQuotaScopeSchema = z.enum(['daily-quota', 'overall', 'model-requests'])
const dailyQuotaReachedSchema = z.object({ ok: z.literal(false), error: z.object({ type: z.literal('daily-quota-reached') }) })

/** One of each per page: the Candidate Journey adapters, the wall and the key status must share them. */
export const candidateApiKeyRecovery = createCandidateApiKeyRecovery()
export const candidateApiKeys = createCandidateApiKeyStore({ readStorage: () => sessionStorage })
export const dailyQuota = createDailyQuotaStore()
