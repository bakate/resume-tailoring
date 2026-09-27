import { createHmac, timingSafeEqual } from 'node:crypto'

const cookieName = 'resume-demo-access'
const sessionDurationSeconds = 30 * 60

export function createDemoAccessCookie({
  issuedAtMilliseconds,
  sessionSecret,
}: Readonly<{
  issuedAtMilliseconds: number
  sessionSecret: string
}>) {
  const expiresAtSeconds = Math.floor(issuedAtMilliseconds / 1_000) + sessionDurationSeconds
  const value = createSignedValue({ expiresAtSeconds, sessionSecret })
  return [
    `${cookieName}=${value}`,
    `Max-Age=${String(sessionDurationSeconds)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ].join('; ')
}

export function hasValidDemoAccess({
  cookieHeader,
  nowMilliseconds,
  sessionSecret,
}: Readonly<{
  cookieHeader: string
  nowMilliseconds: number
  sessionSecret: string
}>) {
  const value = readCookieValue({ cookieHeader })
  if (value === undefined) return false
  return verifySignedValue({ nowMilliseconds, sessionSecret, value })
}

function readCookieValue({ cookieHeader }: Readonly<{ cookieHeader: string }>) {
  for (const entry of cookieHeader.split(';')) {
    const [name, ...valueParts] = entry.trim().split('=')
    if (name === cookieName) return valueParts.join('=')
  }
  return undefined
}

function createSignedValue({ expiresAtSeconds, sessionSecret }: Readonly<{
  expiresAtSeconds: number
  sessionSecret: string
}>) {
  const payload = String(expiresAtSeconds)
  return `${payload}.${signPayload({ payload, sessionSecret })}`
}

function verifySignedValue({
  nowMilliseconds,
  sessionSecret,
  value,
}: Readonly<{
  nowMilliseconds: number
  sessionSecret: string
  value: string
}>) {
  const [payload, signature, ...unexpectedParts] = value.split('.')
  if (payload === undefined || signature === undefined || unexpectedParts.length > 0) return false
  const expiresAtSeconds = Number(payload)
  if (!Number.isSafeInteger(expiresAtSeconds)) return false
  if (expiresAtSeconds <= Math.floor(nowMilliseconds / 1_000)) return false
  return hasExpectedSignature({ payload, sessionSecret, signature })
}

function hasExpectedSignature({ payload, sessionSecret, signature }: Readonly<{
  payload: string
  sessionSecret: string
  signature: string
}>) {
  const expected = Buffer.from(signPayload({ payload, sessionSecret }))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

function signPayload({ payload, sessionSecret }: Readonly<{
  payload: string
  sessionSecret: string
}>) {
  return createHmac('sha256', sessionSecret).update(payload).digest('base64url')
}
