/**
 * Reads a JSON request body without ever holding more than `maxBytes` of it. A declared `Content-Length` above the
 * limit is rejected before reading; a body without one is counted while it streams and abandoned past the limit.
 * A body that fails to arrive or is not JSON is invalid input.
 */
export async function readJsonRequestBody({ request, maxBytes }: Readonly<{ request: Request; maxBytes: number }>) {
  if (Number(request.headers.get('content-length')) > maxBytes) return inputTooLargeResult
  try {
    const bytes = await readBoundedBytes({ body: request.body, maxBytes })
    if (bytes === null) return inputTooLargeResult
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown } as const
  } catch {
    return invalidInputResult
  }
}

/** The request body ceilings, in bytes, all well under the 6 MB Lambda payload limit. */
export const apiRequestBodyLimits = {
  analytics: 16_384,
  demoAccess: 8_192,
  modelRequest: 1_000_000,
  resumeDocument: 3_000_000,
  resumeModel: 500_000,
} as const

async function readBoundedBytes({ body, maxBytes }: Readonly<{
  body: ReadableStream<Uint8Array> | null
  maxBytes: number
}>) {
  if (body === null) return new Uint8Array()
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    length += chunk.value.byteLength
    if (length > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(length)
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset)
    return offset + chunk.byteLength
  }, 0)
  return bytes
}

const inputTooLargeResult = { ok: false, type: 'input-too-large' } as const
const invalidInputResult = { ok: false, type: 'invalid-input' } as const
