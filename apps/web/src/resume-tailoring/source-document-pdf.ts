import type { SourceDocumentReader } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type * as PdfReaderExports from 'pdfjs-dist/legacy/build/pdf.mjs'

import { installPromiseWithResolvers } from './promise-with-resolvers'

type SourceDocumentBrowserCapability = 'text-decoder' | 'worker'
type SourceDocumentBrowserEnvironment = Readonly<{
  capabilities: readonly SourceDocumentBrowserCapability[]
  userAgent: string
}>
type SourceDocumentReaderDependencies = Readonly<{
  loadPdfReader?: () => Promise<PdfReaderLoadResult>
  readBrowserEnvironment?: () => SourceDocumentBrowserEnvironment
}>
type PdfReaderModule = typeof PdfReaderExports
type PdfReaderLoadResult =
  | Readonly<{
      ok: true
      value: Readonly<{ pdfReader: PdfReaderModule; workerUrl: string }>
    }>
  | Readonly<{ ok: false; error: { readonly type: 'pdf-reader-load-failure' } }>

export const sourceDocumentBrowserSupportMatrix = {
  chromium: {
    minimumMajorVersion: 125,
    variants: ['Chrome desktop', 'Chromium desktop', 'Chrome for Android'],
  },
  firefox: {
    minimumMajorVersion: 140,
    variants: ['Firefox desktop', 'Firefox for Android'],
  },
  webkit: {
    minimumMajorVersion: 18,
    variants: ['Safari for macOS', 'Safari for iOS', 'Safari for iPadOS'],
  },
} as const

export function createBrowserSourceDocumentReader({
  loadPdfReader = loadBrowserPdfReader,
  readBrowserEnvironment = readCurrentBrowserEnvironment,
}: SourceDocumentReaderDependencies = {}): SourceDocumentReader {
  const browserEnvironment = readBrowserEnvironment()
  return {
    read: (document) => readSourceDocument({ browserEnvironment, document, loadPdfReader }),
  }
}

function isSupportedBrowser({ userAgent }: Readonly<{ userAgent: string }>) {
  const browserVersion = readBrowserVersion({ userAgent })
  if (browserVersion === null) return userAgent === nonBrowserTestEnvironment.userAgent
  return browserVersion.majorVersion
    >= sourceDocumentBrowserSupportMatrix[browserVersion.family].minimumMajorVersion
}

function readBrowserVersion({ userAgent }: Readonly<{ userAgent: string }>){
  const iosVersion = userAgent.match(/(?:iPhone|iPad|iPod).*OS (\d+)[_.]/)
  if (iosVersion?.[1] !== undefined) {
    return { family: 'webkit', majorVersion: Number(iosVersion[1]) } as const
  }
  const chromiumVersion = userAgent.match(/(?:Chrome|Chromium)\/(\d+)/)
  if (chromiumVersion?.[1] !== undefined) {
    return { family: 'chromium', majorVersion: Number(chromiumVersion[1]) } as const
  }
  const firefoxVersion = userAgent.match(/Firefox\/(\d+)/)
  if (firefoxVersion?.[1] !== undefined) {
    return { family: 'firefox', majorVersion: Number(firefoxVersion[1]) } as const
  }
  const safariVersion = userAgent.match(/Version\/(\d+).*Safari\//)
  return safariVersion?.[1] === undefined
    ? null
    : { family: 'webkit', majorVersion: Number(safariVersion[1]) } as const
}

function readCurrentBrowserEnvironment(): SourceDocumentBrowserEnvironment {
  if (typeof window === 'undefined') return nonBrowserTestEnvironment
  return {
    capabilities: [
      ...(typeof TextDecoder === 'function' ? ['text-decoder'] as const : []),
      ...(typeof Worker === 'function' ? ['worker'] as const : []),
    ],
    userAgent: navigator.userAgent,
  }
}

async function readSourceDocument({
  browserEnvironment,
  document,
  loadPdfReader,
}: Readonly<{
  browserEnvironment: SourceDocumentBrowserEnvironment
  document: Parameters<SourceDocumentReader['read']>[0]
  loadPdfReader: () => Promise<PdfReaderLoadResult>
}>): ReturnType<SourceDocumentReader['read']> {
  if (document.mediaType === 'text/plain') return readPastedText({ document })
  if (!isPdf({ document })) return unsupportedResult
  const compatibilityFailure = readCompatibilityFailure({ browserEnvironment })
  if (compatibilityFailure !== null) return compatibilityFailure
  installPromiseWithResolvers()
  const pdfReaderResult = await loadPdfReader()
  if (!pdfReaderResult.ok) return incompatiblePdfReaderResult
  const { GlobalWorkerOptions, getDocument } = pdfReaderResult.value.pdfReader
  if (typeof window !== 'undefined') GlobalWorkerOptions.workerSrc = pdfReaderResult.value.workerUrl
  const loadingTask = getDocument({ data: document.bytes.slice() })
  try {
    try {
      const pdfDocument = await loadingTask.promise
      const text = await readPdfText({ pdfDocument })
      return text.length === 0 ? textEmptyResult : { ok: true, value: text }
    } finally {
      await loadingTask.destroy()
    }
  } catch (error) {
    return readPdfDocumentFailure({ error })
  }
}

function readCompatibilityFailure({ browserEnvironment }: Readonly<{
  browserEnvironment: SourceDocumentBrowserEnvironment
}>) {
  if (!browserEnvironment.capabilities.includes('worker')) return incompatibleBrowserResult
  if (!browserEnvironment.capabilities.includes('text-decoder')) return missingTextDecoderResult
  return isSupportedBrowser({ userAgent: browserEnvironment.userAgent })
    ? null
    : unsupportedBrowserVersionResult
}

async function loadBrowserPdfReader(): Promise<PdfReaderLoadResult> {
  try {
    const [pdfReader, workerModule] = await Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('./source-document-pdf-worker?worker&url'),
    ])
    return { ok: true, value: { pdfReader, workerUrl: workerModule.default } }
  } catch {
    return { ok: false, error: { type: 'pdf-reader-load-failure' } }
  }
}

function readPastedText({ document }: Readonly<{
  document: Parameters<SourceDocumentReader['read']>[0]
}>) {
  const text = new TextDecoder().decode(document.bytes).trim()
  return text.length === 0 ? textEmptyResult : { ok: true, value: text } as const
}

function readPdfDocumentFailure({ error }: Readonly<{ error: unknown }>) {
  if (hasErrorName({ error, name: 'PasswordException' })) return encryptedPdfResult
  if (hasErrorName({ error, name: 'InvalidPDFException' })) return invalidPdfResult
  return pdfReadFailureResult
}

function hasErrorName({ error, name }: Readonly<{ error: unknown; name: string }>) {
  return error instanceof Error && error.name === name
}

async function readPdfText({ pdfDocument }: Readonly<{ pdfDocument: PDFDocumentProxy }>) {
  const pageTexts = await Promise.all(createPageNumbers({ pageCount: pdfDocument.numPages })
    .map(async (pageNumber) => readPdfPage({ page: await pdfDocument.getPage(pageNumber) })))
  return pageTexts.join('\n').trim()
}

async function readPdfPage({ page }: Readonly<{ page: PDFPageProxy }>) {
  const textContent = await page.getTextContent()
  return textContent.items
    .filter((item) => 'str' in item)
    .map((item) => `${item.str}${item.hasEOL ? '\n' : ' '}`)
    .join('')
    .trim()
}

function isPdf({ document }: Readonly<{
  document: Parameters<SourceDocumentReader['read']>[0]
}>) {
  return document.mediaType === 'application/pdf'
    || document.name.toLowerCase().endsWith('.pdf')
}

function createPageNumbers({ pageCount }: Readonly<{ pageCount: number }>) {
  return Array.from({ length: pageCount }, (_unusedValue, pageIndex) => pageIndex + 1)
}

const unsupportedResult = {
  ok: false,
  error: { type: 'unsupported-source-document' },
} as const

const textEmptyResult = {
  ok: false,
  error: { type: 'unreadable-source-document', reason: 'text-empty' },
} as const

const invalidPdfResult = {
  ok: false,
  error: { type: 'unreadable-source-document', reason: 'invalid-pdf' },
} as const

const encryptedPdfResult = {
  ok: false,
  error: { type: 'unreadable-source-document', reason: 'encrypted-pdf' },
} as const

const pdfReadFailureResult = {
  ok: false,
  error: { type: 'unreadable-source-document', reason: 'pdf-read-failure' },
} as const

const incompatibleBrowserResult = {
  ok: false,
  error: {
    type: 'incompatible-source-document-reader',
    reason: 'missing-worker-capability',
  },
} as const

const missingTextDecoderResult = {
  ok: false,
  error: {
    type: 'incompatible-source-document-reader',
    reason: 'missing-text-decoder-capability',
  },
} as const

const unsupportedBrowserVersionResult = {
  ok: false,
  error: {
    type: 'incompatible-source-document-reader',
    reason: 'unsupported-browser-version',
  },
} as const

const incompatiblePdfReaderResult = {
  ok: false,
  error: {
    type: 'incompatible-source-document-reader',
    reason: 'pdf-reader-load-failure',
  },
} as const

const nonBrowserTestEnvironment = {
  capabilities: ['text-decoder', 'worker'],
  userAgent: 'non-browser-test-environment',
} as const
