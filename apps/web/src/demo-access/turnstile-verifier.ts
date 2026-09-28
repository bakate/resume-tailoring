import { z } from 'zod'

const turnstileResponseSchema = z.object({
  hostname: z.string().min(1).optional(),
  success: z.boolean(),
})

export async function verifyTurnstileToken({
  expectedHostname,
  request = fetch,
  secretKey,
  token,
}: Readonly<{
  expectedHostname: string
  request?: typeof fetch
  secretKey: string
  token: string
}>) {
  try {
    const response = await request('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ response: token, secret: secretKey }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return invalidResult
    return parseVerification({ expectedHostname, value: await response.json() })
  } catch {
    return invalidResult
  }
}

function parseVerification({ expectedHostname, value }: Readonly<{
  expectedHostname: string
  value: unknown
}>) {
  const result = turnstileResponseSchema.safeParse(value)
  if (!result.success || !result.data.success) return invalidResult
  return result.data.hostname === expectedHostname ? validResult : invalidResult
}

const validResult = { ok: true, value: undefined } as const
const invalidResult = { ok: false } as const
