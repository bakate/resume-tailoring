import { z } from 'zod'

const disabledEnvironmentSchema = z.object({
  DEMO_ACCESS_MODE: z.literal('disabled').default('disabled'),
})

const enforcedEnvironmentSchema = z.object({
  DEMO_ACCESS_MODE: z.literal('enforced'),
  DEMO_ORIGIN_SECRET: z.string().min(32),
  DEMO_PUBLIC_HOSTNAME: z.string().min(1),
  DEMO_SESSION_SECRET: z.string().min(32),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  TURNSTILE_SITE_KEY: z.string().min(1),
})

const demoAccessEnvironmentSchema = z.union([
  enforcedEnvironmentSchema,
  disabledEnvironmentSchema,
])

export type DemoAccessEnvironment =
  | Readonly<{ mode: 'disabled' }>
  | Readonly<{
    mode: 'enforced'
    originSecret: string
    publicHostname: string
    sessionSecret: string
    turnstileSecretKey: string
    turnstileSiteKey: string
  }>

export function validateDemoAccessEnvironment({ environment }: Readonly<{
  environment: Record<string, unknown>
}>) {
  const result = demoAccessEnvironmentSchema.safeParse(environment)
  if (!result.success) {
    return { ok: false, error: { type: 'invalid-demo-access-environment' } } as const
  }
  if (result.data.DEMO_ACCESS_MODE === 'disabled') {
    return { ok: true, value: { mode: 'disabled' } } as const
  }
  return {
    ok: true,
    value: {
      mode: 'enforced',
      originSecret: result.data.DEMO_ORIGIN_SECRET,
      publicHostname: result.data.DEMO_PUBLIC_HOSTNAME,
      sessionSecret: result.data.DEMO_SESSION_SECRET,
      turnstileSecretKey: result.data.TURNSTILE_SECRET_KEY,
      turnstileSiteKey: result.data.TURNSTILE_SITE_KEY,
    },
  } as const
}
