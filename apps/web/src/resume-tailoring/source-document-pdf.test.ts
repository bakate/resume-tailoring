import { describe, expect, it } from 'vitest'

import { createBrowserSourceDocumentReader } from './source-document-pdf'

describe('browser Source Document reader', () => {
  it('treats a PDF extension with a generic media type as a supported but unreadable PDF', async () => {
    const reader = createBrowserSourceDocumentReader()

    const result = await reader.read({
      bytes: new Uint8Array([0]),
      mediaType: 'application/octet-stream',
      name: 'resume.pdf',
    })

    expect(result).toEqual({ ok: false, error: { type: 'unreadable-source-document' } })
  })
})
