import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'
import { z } from 'zod'

import { failureResponse } from '../api-failure'
import {
  createDemoOriginGuardResponse,
  readDemoAccessDecision,
} from '../demo-access/demo-access-authorization'
import { validateDemoAccessEnvironment } from '../demo-access/demo-access-environment'
import { createDemoAccessCookie } from '../demo-access/demo-access-session'
import { verifyTurnstileToken } from '../demo-access/turnstile-verifier'

const challengeRequestSchema = z.object({ token: z.string().min(1).max(2_048) }).strict()

export const Route = createFileRoute('/api/demo-access')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: {
      GET: ({ request }) => readAccess({ request }),
      POST: async ({ request }) => establishAccess({ request }),
    },
  },
})

function readAccess({ request }: Readonly<{ request: Request }>) {
  const originResponse = createDemoOriginGuardResponse({ request })
  if (originResponse !== null) return originResponse
  const decision = readDemoAccessDecision({
    cookieHeader: request.headers.get('cookie') ?? '',
    environment: process.env,
  })
  if (!decision.ok) return failureResponse({ type: decision.error.type })
  return decision.value.access === 'granted'
    ? Response.json({ ok: true, value: { access: 'granted' } }, { headers: privateHeaders })
    : Response.json({ ok: true, value: decision.value }, { status: 401, headers: privateHeaders })
}

async function establishAccess({ request }: Readonly<{ request: Request }>) {
  const originResponse = createDemoOriginGuardResponse({ request })
  if (originResponse !== null) return originResponse
  const environmentResult = validateDemoAccessEnvironment({ environment: process.env })
  if (!environmentResult.ok) return failureResponse({ type: 'demo-access-unavailable' })
  if (environmentResult.value.mode === 'disabled') return createAccessResponse()
  const tokenResult = await readChallengeToken({ request })
  if (!tokenResult.ok) return failureResponse({ type: 'invalid-input' })
  const verification = await verifyTurnstileToken({
    expectedHostname: environmentResult.value.publicHostname,
    secretKey: environmentResult.value.turnstileSecretKey,
    token: tokenResult.value,
  })
  return verification.ok
    ? createAccessResponse({ sessionSecret: environmentResult.value.sessionSecret })
    // A rejected challenge leaves access required: the Candidate passes a new challenge.
    : failureResponse({ type: 'demo-access-required' })
}

async function readChallengeToken({ request }: Readonly<{ request: Request }>) {
  try {
    const result = challengeRequestSchema.safeParse(await request.json() as unknown)
    return result.success ? { ok: true, value: result.data.token } as const : invalidTokenResult
  } catch {
    return invalidTokenResult
  }
}

function createAccessResponse({ sessionSecret }: Readonly<{ sessionSecret?: string }> = {}) {
  const headers = new Headers(privateHeaders)
  if (sessionSecret !== undefined) {
    headers.set('Set-Cookie', createDemoAccessCookie({
      issuedAtMilliseconds: Date.now(),
      sessionSecret,
    }))
  }
  return Response.json({ ok: true, value: { access: 'granted' } }, { headers })
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
const invalidTokenResult = { ok: false } as const
