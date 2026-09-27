import { createFileRoute } from '@tanstack/react-router'
import { createCsrfMiddleware } from '@tanstack/react-start'

import { createTailoredResumePdf } from '../resume-tailoring/tailored-resume-pdf'
import { resumePdfRequestSchema } from '../resume-tailoring/tailored-resume-schemas'

export const Route = createFileRoute('/api/tailored-resume-pdf')({
  server: {
    middleware: [createCsrfMiddleware()],
    handlers: { POST: async ({ request }) => exportTailoredResumePdf({ request }) },
  },
})

async function exportTailoredResumePdf({ request }: Readonly<{ request: Request }>) {
  const parsedRequest = await readRequest({ request })
  if (!parsedRequest.ok) return createInvalidRequestResponse()
  const result = await createTailoredResumePdf(parsedRequest.value)
  if (!result.ok) return Response.json(result, { status: 422, headers: privateHeaders })
  return new Response(Buffer.from(result.value), {
    status: 200,
    headers: {
      ...privateHeaders,
      'Content-Disposition': 'attachment; filename="tailored-resume.pdf"',
      'Content-Type': 'application/pdf',
    },
  })
}

async function readRequest({ request }: Readonly<{ request: Request }>) {
  try {
    const result = resumePdfRequestSchema.safeParse(await request.json() as unknown)
    return result.success ? { ok: true, value: result.data } as const : invalidRequestResult
  } catch {
    return invalidRequestResult
  }
}

function createInvalidRequestResponse() {
  return Response.json(
    { ok: false, error: { type: 'resume-pdf-request-invalid' } },
    { status: 400, headers: privateHeaders },
  )
}

const privateHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
} as const
const invalidRequestResult = { ok: false } as const
