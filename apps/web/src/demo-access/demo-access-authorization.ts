import { failureResponse } from '../api-failure'
import { validateDemoAccessEnvironment } from './demo-access-environment'
import { hasValidDemoAccess } from './demo-access-session'

export function readDemoAccessDecision({
  cookieHeader,
  environment,
  nowMilliseconds = Date.now(),
}: Readonly<{
  cookieHeader: string
  environment: Record<string, unknown>
  nowMilliseconds?: number
}>) {
  const environmentResult = validateDemoAccessEnvironment({ environment })
  if (!environmentResult.ok) return unavailableResult
  if (environmentResult.value.mode === 'disabled') return disabledAccessResult
  const hasAccess = hasValidDemoAccess({
    cookieHeader,
    nowMilliseconds,
    sessionSecret: environmentResult.value.sessionSecret,
  })
  return hasAccess
    ? enforcedAccessResult
    : createChallengeResult({ siteKey: environmentResult.value.turnstileSiteKey })
}

export function createDemoAccessGuardResponse({
  environment = process.env,
  request,
}: Readonly<{
  environment?: Record<string, unknown>
  request: Request
}>) {
  const originResponse = createDemoOriginGuardResponse({ environment, request })
  if (originResponse !== null) return originResponse
  const decision = readDemoAccessDecision({
    cookieHeader: request.headers.get('cookie') ?? '',
    environment,
  })
  if (!decision.ok) return failureResponse({ type: decision.error.type })
  if (decision.value.access === 'granted') return null
  return failureResponse({ type: 'demo-access-required' })
}

export function createDemoOriginGuardResponse({
  environment = process.env,
  request,
}: Readonly<{
  environment?: Record<string, unknown>
  request: Request
}>) {
  const environmentResult = validateDemoAccessEnvironment({ environment })
  if (!environmentResult.ok) return failureResponse({ type: 'demo-access-unavailable' })
  if (environmentResult.value.mode === 'disabled') return null
  return request.headers.get(originHeaderName) === environmentResult.value.originSecret
    ? null
    : failureResponse({ type: 'demo-origin-required' })
}

function createChallengeResult({ siteKey }: Readonly<{ siteKey: string }>) {
  return { ok: true, value: { access: 'challenge-required', siteKey } } as const
}

const disabledAccessResult = {
  ok: true,
  value: { access: 'granted', mode: 'disabled' },
} as const
const enforcedAccessResult = {
  ok: true,
  value: { access: 'granted', mode: 'enforced' },
} as const
const unavailableResult = {
  ok: false,
  error: { type: 'demo-access-unavailable' },
} as const
const originHeaderName = 'x-resume-studio-origin'
