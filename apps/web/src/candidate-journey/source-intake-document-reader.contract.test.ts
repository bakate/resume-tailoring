import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'

import { docxMediaType } from '@resume-tailoring/application/source-intake'
import { createBrowserSourceIntakeDocumentReader } from './source-intake-document-reader'

describe('browser Source Intake document reader', () => {
  it('reads pasted professional text', async () => {
    const reader = createBrowserSourceIntakeDocumentReader()

    const result = await reader.read({
      bytes: new TextEncoder().encode('Senior FullStack Developer'),
      mediaType: 'text/plain',
      name: 'pasted-professional-text.txt',
    })

    expect(result).toEqual({
      ok: true,
      value: { pageCount: null, text: 'Senior FullStack Developer' },
    })
  })

  it('extracts DOCX text through the browser-local document adapter', async () => {
    const reader = createBrowserSourceIntakeDocumentReader({
      extractDocxText: () => Promise.resolve('Led a platform migration'),
      readDocxPageCount: () => Promise.resolve(1),
    })

    const result = await reader.read({
      bytes: new Uint8Array([80, 75, 3, 4]),
      mediaType: docxMediaType,
      name: 'resume.docx',
    })

    expect(result).toEqual({
      ok: true,
      value: { pageCount: 1, text: 'Led a platform migration' },
    })
  })

  it('reports a DOCX page count when Word metadata provides it', async () => {
    const bytes = await createDocxArchive({ pageCount: 6 })
    const reader = createBrowserSourceIntakeDocumentReader({
      extractDocxText: () => Promise.resolve('Led a platform migration'),
    })

    const result = await reader.read({
      bytes,
      mediaType: docxMediaType,
      name: 'resume.docx',
    })

    expect(result).toEqual({
      ok: true,
      value: { pageCount: 6, text: 'Led a platform migration' },
    })
  })

  it('reports the page count for a text-based PDF', async () => {
    const reader = createBrowserSourceIntakeDocumentReader({
      readPdfDocument: () => Promise.resolve({
        ok: true,
        value: { pageCount: 2, text: 'TypeScript' },
      }),
    })

    const result = await reader.read({
      bytes: new TextEncoder().encode('%PDF-1.7 /Type /Page /Type /Page'),
      mediaType: 'application/pdf',
      name: 'resume.pdf',
    })

    expect(result).toEqual({ ok: true, value: { pageCount: 2, text: 'TypeScript' } })
  })

  it('distinguishes a scanned PDF from an empty pasted document', async () => {
    const reader = createBrowserSourceIntakeDocumentReader({
      readPdfDocument: () => Promise.resolve({
        ok: false,
        error: { type: 'unreadable-source-document', reason: 'text-empty' },
      }),
    })

    const result = await reader.read({
      bytes: new TextEncoder().encode('%PDF-1.7 /Type /Page'),
      mediaType: 'application/pdf',
      name: 'scan.pdf',
    })

    expect(result).toEqual({ ok: false, error: 'scanned-document' })
  })

  it('rejects a DOCX when its page limit cannot be established', async () => {
    const reader = createBrowserSourceIntakeDocumentReader({
      extractDocxText: () => Promise.resolve('Led a platform migration'),
      readDocxPageCount: () => Promise.resolve(null),
    })

    const result = await reader.read({
      bytes: new Uint8Array([80, 75, 3, 4]),
      mediaType: docxMediaType,
      name: 'resume.docx',
    })

    expect(result).toEqual({ ok: false, error: 'unreadable-document' })
  })

  it('rejects unsupported Source Documents explicitly', async () => {
    const reader = createBrowserSourceIntakeDocumentReader()

    const result = await reader.read({
      bytes: new Uint8Array([1, 2, 3]),
      mediaType: 'application/rtf',
      name: 'resume.rtf',
    })

    expect(result).toEqual({ ok: false, error: 'unsupported-document' })
  })
})

async function createDocxArchive({ pageCount }: Readonly<{ pageCount: number }>) {
  const archive = new JSZip()
  archive.file('docProps/app.xml', `<Properties><Pages>${String(pageCount)}</Pages></Properties>`)
  return archive.generateAsync({ type: 'uint8array' })
}
