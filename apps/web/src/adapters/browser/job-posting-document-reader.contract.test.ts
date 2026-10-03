import { describe, expect, it } from 'vitest'

import { createBrowserJobPostingDocumentReader } from './job-posting-document-reader'

describe('browser Job Posting document reader', () => {
  it('reads a UTF-8 TXT Job Posting', async () => {
    const reader = createBrowserJobPostingDocumentReader()

    const result = await reader.read(createDocument({
      content: 'Staff Engineer\nTypeScript is required.',
      mediaType: 'text/plain',
      name: 'role.txt',
    }))

    expect(result).toEqual({
      ok: true,
      value: { text: 'Staff Engineer\nTypeScript is required.' },
    })
  })

  it('rejects unsupported Job Posting formats', async () => {
    const reader = createBrowserJobPostingDocumentReader()

    const result = await reader.read(createDocument({
      content: 'role',
      mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      name: 'role.docx',
    }))

    expect(result).toEqual({ ok: false, error: 'unsupported-job-posting' })
  })
})

function createDocument({ content, mediaType, name }: Readonly<{
  content: string
  mediaType: string
  name: string
}>) {
  return { bytes: new TextEncoder().encode(content), mediaType, name }
}
