import type { z } from 'zod'
import { createDemoAccessGuardResponse } from '../demo-access/demo-access-authorization'
import { validateServerEnvironment } from '../env'
import type { ServerEnvironment } from '../env'

export async function processResumeModel<TInput>({ request, schema, processInput }: Readonly<{
  request: Request; schema: z.ZodType<TInput>;
  processInput: (input: TInput, environment: ServerEnvironment) => Promise<unknown>
}>) {
  const access = createDemoAccessGuardResponse({ request })
  if (access !== null) return access
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) return failureResponse(503)
  try {
    const text = await request.text()
    if (text.length > 500_000) return failureResponse(413)
    const parsed = schema.safeParse(JSON.parse(text))
    if (!parsed.success) return failureResponse(400)
    return Response.json(await processInput(parsed.data, environment.value), { headers: privateHeaders })
  } catch { return failureResponse(502) }
}

function failureResponse(status: number) {
  return Response.json({ ok: false, error: { type: 'unavailable' } }, { status, headers: privateHeaders })
}
const privateHeaders = { 'Cache-Control': 'no-store', Pragma: 'no-cache' }
