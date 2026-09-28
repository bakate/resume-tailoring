import { describe, expect, it } from 'vitest'

import { createBrowserSourceDocumentReader } from './source-document-pdf'

describe('browser Source Document reader', () => {
  it('reports browser incompatibility when PDF reading capabilities are unavailable', async () => {
    const reader = createBrowserSourceDocumentReader({
      readBrowserEnvironment: () => ({
        capabilities: [],
        userAgent: supportedChromeUserAgent,
      }),
    })

    const result = await reader.read({
      bytes: new Uint8Array([37, 80, 68, 70]),
      mediaType: 'application/pdf',
      name: 'resume.pdf',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'incompatible-source-document-reader',
        reason: 'missing-worker-capability',
      },
    })
  })

  it('keeps pasted text available when PDF reading capabilities are unavailable', async () => {
    const reader = createBrowserSourceDocumentReader({
      readBrowserEnvironment: () => ({
        capabilities: [],
        userAgent: supportedChromeUserAgent,
      }),
    })

    const result = await reader.read({
      bytes: new TextEncoder().encode('Senior FullStack Developer'),
      mediaType: 'text/plain',
      name: 'pasted-professional-text.txt',
    })

    expect(result).toEqual({ ok: true, value: 'Senior FullStack Developer' })
  })

  it('keeps pasted text available without the native TextDecoder API', async () => {
    const textDecoderDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'TextDecoder')
    Reflect.deleteProperty(globalThis, 'TextDecoder')
    const reader = createBrowserSourceDocumentReader({
      readBrowserEnvironment: () => ({
        capabilities: ['worker'],
        userAgent: supportedChromeUserAgent,
      }),
    })

    try {
      const result = await reader.read({
        bytes: new Uint8Array([83, 101, 110, 105, 111, 114]),
        mediaType: 'text/plain',
        name: 'pasted-professional-text.txt',
      })

      expect(result).toEqual({ ok: true, value: 'Senior' })
    } finally {
      restoreGlobalProperty({ descriptor: textDecoderDescriptor, property: 'TextDecoder' })
    }
  })

  it('reports browser incompatibility when WebKit is older than the supported matrix', async () => {
    const reader = createBrowserSourceDocumentReader({
      readBrowserEnvironment: () => ({
        capabilities: ['worker'],
        userAgent: unsupportedIosWebKitUserAgent,
      }),
    })

    const result = await reader.read({
      bytes: new Uint8Array([37, 80, 68, 70]),
      mediaType: 'application/pdf',
      name: 'resume.pdf',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'incompatible-source-document-reader',
        reason: 'unsupported-browser-version',
      },
    })
  })

  it('reads a selectable-text PDF without native Promise.withResolvers support', async () => {
    const withResolversDescriptor = Object.getOwnPropertyDescriptor(Promise, 'withResolvers')
    Reflect.deleteProperty(Promise, 'withResolvers')
    const reader = createBrowserSourceDocumentReader({
      readBrowserEnvironment: () => ({
        capabilities: ['worker'],
        userAgent: supportedChromeUserAgent,
      }),
    })

    try {
      const result = await reader.read({
        bytes: createTextPdf({ text: 'Senior FullStack Developer using React at Acme' }),
        mediaType: 'application/pdf',
        name: 'resume.pdf',
      })

      expect(result).toEqual({
        ok: true,
        value: 'Senior FullStack Developer using React at Acme',
      })
    } finally {
      restoreWithResolvers({ descriptor: withResolversDescriptor })
    }
  })

  it('reports a PDF reader runtime failure as browser incompatibility', async () => {
    const reader = createBrowserSourceDocumentReader({
      loadPdfReader: () => Promise.resolve({
        ok: false,
        error: { type: 'pdf-reader-load-failure' },
      }),
      readBrowserEnvironment: () => ({
        capabilities: ['worker'],
        userAgent: supportedChromeUserAgent,
      }),
    })

    const result = await reader.read({
      bytes: createTextPdf({ text: 'Senior FullStack Developer' }),
      mediaType: 'application/pdf',
      name: 'resume.pdf',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'incompatible-source-document-reader',
        reason: 'pdf-reader-load-failure',
      },
    })
  })

  it('contains a synchronous PDF runtime failure as browser incompatibility', async () => {
    const reader = createBrowserSourceDocumentReader({
      loadPdfReader: () => Promise.resolve({
        ok: true,
        value: {
          pdfReader: {
            GlobalWorkerOptions: { workerSrc: '' },
            getDocument: () => { throw new TypeError('Missing browser API') },
          },
          workerUrl: '/pdf-worker.js',
        },
      }),
      readBrowserEnvironment: () => ({
        capabilities: ['worker'],
        userAgent: supportedChromeUserAgent,
      }),
    })

    const result = await reader.read({
      bytes: createTextPdf({ text: 'Senior FullStack Developer' }),
      mediaType: 'application/pdf',
      name: 'resume.pdf',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'incompatible-source-document-reader',
        reason: 'pdf-reader-runtime-failure',
      },
    })
  })

  it('contains an asynchronous PDF runtime failure as browser incompatibility', async () => {
    const reader = createBrowserSourceDocumentReader({
      loadPdfReader: () => Promise.resolve({
        ok: true,
        value: {
          pdfReader: {
            GlobalWorkerOptions: { workerSrc: '' },
            getDocument: () => ({
              destroy: () => Promise.resolve(),
              promise: Promise.reject(new Error('Worker initialization failed')),
            }),
          },
          workerUrl: '/pdf-worker.js',
        },
      }),
      readBrowserEnvironment: () => ({
        capabilities: ['worker'],
        userAgent: supportedChromeUserAgent,
      }),
    })

    const result = await reader.read({
      bytes: createTextPdf({ text: 'Senior FullStack Developer' }),
      mediaType: 'application/pdf',
      name: 'resume.pdf',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        type: 'incompatible-source-document-reader',
        reason: 'pdf-reader-runtime-failure',
      },
    })
  })

  it('preserves encrypted PDFs as a document-specific failure', async () => {
    const encryptedPdfError = new Error('Password required')
    encryptedPdfError.name = 'PasswordException'
    const reader = createReaderWithLoadingFailure({ error: encryptedPdfError })

    const result = await reader.read(createPdfSourceDocument())

    expect(result).toEqual({
      ok: false,
      error: { type: 'unreadable-source-document', reason: 'encrypted-pdf' },
    })
  })

  it('preserves text-empty PDFs as a document-specific failure', async () => {
    const reader = createBrowserSourceDocumentReader({
      readBrowserEnvironment: readSupportedBrowserEnvironment,
    })

    const result = await reader.read({
      ...createPdfSourceDocument(),
      bytes: createTextPdf({ text: '' }),
    })

    expect(result).toEqual({
      ok: false,
      error: { type: 'unreadable-source-document', reason: 'text-empty' },
    })
  })

  it('treats a PDF extension with a generic media type as a supported but unreadable PDF', async () => {
    const reader = createBrowserSourceDocumentReader()

    const result = await reader.read({
      bytes: new Uint8Array([0]),
      mediaType: 'application/octet-stream',
      name: 'resume.pdf',
    })

    expect(result).toEqual({
      ok: false,
      error: { type: 'unreadable-source-document', reason: 'invalid-pdf' },
    })
  })
})

const supportedChromeUserAgent = 'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36'
const unsupportedIosWebKitUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_7 like Mac OS X) AppleWebKit/605.1.15 Version/17.7 Mobile/15E148 Safari/604.1'

function createReaderWithLoadingFailure({ error }: Readonly<{ error: Error }>) {
  return createBrowserSourceDocumentReader({
    loadPdfReader: () => Promise.resolve({
      ok: true,
      value: {
        pdfReader: {
          GlobalWorkerOptions: { workerSrc: '' },
          getDocument: () => ({
            destroy: () => Promise.resolve(),
            promise: Promise.reject(error),
          }),
        },
        workerUrl: '/pdf-worker.js',
      },
    }),
    readBrowserEnvironment: readSupportedBrowserEnvironment,
  })
}

function createPdfSourceDocument() {
  return {
    bytes: createTextPdf({ text: 'Senior FullStack Developer' }),
    mediaType: 'application/pdf',
    name: 'resume.pdf',
  } as const
}

function readSupportedBrowserEnvironment() {
  return { capabilities: ['worker'], userAgent: supportedChromeUserAgent } as const
}

function createTextPdf({ text }: Readonly<{ text: string }>) {
  const escapedText = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
  const content = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`
  const document = appendPdfObjects({ objects: createPdfObjects({ content }) })
  const crossReferenceOffset = document.pdf.length
  const entries = document.offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  const trailer = `xref\n0 6\n0000000000 65535 f \n${entries}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(crossReferenceOffset)}\n%%EOF`
  return new TextEncoder().encode(`${document.pdf}${trailer}`)
}

function createPdfObjects({ content }: Readonly<{ content: string }>) {
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
}

function appendPdfObjects({ objects }: Readonly<{ objects: readonly string[] }>) {
  return objects.reduce((document, object, objectIndex) => ({
    offsets: [...document.offsets, document.pdf.length],
    pdf: `${document.pdf}${String(objectIndex + 1)} 0 obj\n${object}\nendobj\n`,
  }), { offsets: [] as readonly number[], pdf: '%PDF-1.4\n' })
}

function restoreWithResolvers({ descriptor }: Readonly<{
  descriptor: PropertyDescriptor | undefined
}>) {
  if (descriptor === undefined) {
    Reflect.deleteProperty(Promise, 'withResolvers')
    return
  }
  Object.defineProperty(Promise, 'withResolvers', descriptor)
}

function restoreGlobalProperty({ descriptor, property }: Readonly<{
  descriptor: PropertyDescriptor | undefined
  property: 'TextDecoder'
}>) {
  if (descriptor === undefined) return
  Object.defineProperty(globalThis, property, descriptor)
}
