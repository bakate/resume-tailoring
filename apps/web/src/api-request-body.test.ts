import { describe, expect, it } from 'vitest'

import { readJsonRequestBody } from './api-request-body'

describe('bounded JSON request body', () => {
  it('reads a body within its limit', async () => {
    const request = createRequest({ body: JSON.stringify({ name: 'Candidate' }) })

    await expect(readJsonRequestBody({ request, maxBytes: 64 })).resolves.toEqual({
      ok: true,
      value: { name: 'Candidate' },
    })
  })

  it('rejects a declared oversized body without reading it', async () => {
    const request = createRequest({ body: JSON.stringify('x'.repeat(63)), headers: { 'content-length': '65' } })

    await expect(readJsonRequestBody({ request, maxBytes: 64 })).resolves.toEqual({
      ok: false,
      type: 'input-too-large',
    })
    expect(request.bodyUsed).toBe(false)
  })

  it('stops reading an undeclared body once it passes its limit', async () => {
    let pulledChunks = 0
    const body = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        pulledChunks += 1
        controller.enqueue(new Uint8Array(40))
      },
    })
    const request = createRequest({ body })

    await expect(readJsonRequestBody({ request, maxBytes: 64 })).resolves.toEqual({
      ok: false,
      type: 'input-too-large',
    })
    expect(pulledChunks).toBeLessThan(5)
  })

  it('counts bytes rather than characters', async () => {
    const request = createRequest({ body: JSON.stringify('é'.repeat(40)) })

    await expect(readJsonRequestBody({ request, maxBytes: 64 })).resolves.toEqual({
      ok: false,
      type: 'input-too-large',
    })
  })

  it('treats a body that is not JSON as invalid input', async () => {
    const request = createRequest({ body: 'not json' })

    await expect(readJsonRequestBody({ request, maxBytes: 64 })).resolves.toEqual({
      ok: false,
      type: 'invalid-input',
    })
  })
})

function createRequest({ body, headers = {} }: Readonly<{
  body: BodyInit
  headers?: Record<string, string>
}>) {
  return new Request('https://resume-studio.example/api/analytics', {
    body,
    duplex: 'half',
    headers,
    method: 'POST',
  } as RequestInit)
}
