import type { SourceDocument } from '@resume-tailoring/application/source-intake'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

import { installPromiseWithResolvers } from './promise-with-resolvers'
import { sourceDocumentBrowserSupportPolicy } from './source-document-browser-support'

type SourceDocumentBrowserCapability = 'worker'
type SourceDocumentBrowserEnvironment = Readonly<{
  capabilities: readonly SourceDocumentBrowserCapability[]
  userAgent: string
}>
type SourceDocumentReaderDependencies = Readonly<{
  loadPdfReader?: () => Promise<PdfReaderLoadResult>
  readBrowserEnvironment?: () => SourceDocumentBrowserEnvironment
}>
type PdfReaderModule = Readonly<{
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (parameters: Readonly<{ data: Uint8Array }>) => Pick<
    PDFDocumentLoadingTask,
    'destroy' | 'promise'
  >
}>
type PdfReaderLoadResult =
  | Readonly<{
      ok: true
      value: Readonly<{ pdfReader: PdfReaderModule; workerUrl: string }>
    }>
  | Readonly<{ ok: false; error: { readonly type: 'pdf-reader-load-failure' } }>

export function createBrowserPdfDocumentReader({
  loadPdfReader = loadBrowserPdfReader,
  readBrowserEnvironment = readCurrentBrowserEnvironment,
}: SourceDocumentReaderDependencies = {}) {
  const browserEnvironment = readBrowserEnvironment()
  return {
    read: (document: SourceDocument) => (
      readSourceDocumentDetails({ browserEnvironment, document, loadPdfReader })
    ),
  }
}

function isSupportedBrowser({ userAgent }: Readonly<{ userAgent: string }>) {
  const browserVersion = readBrowserVersion({ userAgent })
  if (browserVersion === null) return userAgent === nonBrowserTestEnvironment.userAgent
  return browserVersion.majorVersion
    >= sourceDocumentBrowserSupportPolicy.matrix[browserVersion.family].minimumMajorVersion
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
    capabilities: typeof Worker === 'function' ? ['worker'] : [],
    userAgent: navigator.userAgent,
  }
}

async function readSourceDocumentDetails({
  browserEnvironment,
  document,
  loadPdfReader,
}: Readonly<{
  browserEnvironment: SourceDocumentBrowserEnvironment
  document: SourceDocument
  loadPdfReader: () => Promise<PdfReaderLoadResult>
}>) {
  if (isText({ document })) return readPastedText({ document })
  if (!isPdf({ document })) return unsupportedResult
  const compatibilityFailure = readCompatibilityFailure({ browserEnvironment })
  if (compatibilityFailure !== null) return compatibilityFailure
  if (!hasPdfHeader({ bytes: document.bytes })) return invalidPdfResult
  installPromiseWithResolvers()
  const pdfReaderResult = await loadPdfReader()
  if (!pdfReaderResult.ok) return incompatiblePdfReaderResult
  const { GlobalWorkerOptions, getDocument } = pdfReaderResult.value.pdfReader
  if (typeof window !== 'undefined') GlobalWorkerOptions.workerSrc = pdfReaderResult.value.workerUrl
  const loadingTaskResult = createPdfLoadingTask({ bytes: document.bytes, getDocument })
  if (!loadingTaskResult.ok) return incompatiblePdfReaderRuntimeResult
  return readPdfLoadingTask({ loadingTask: loadingTaskResult.value })
}

function createPdfLoadingTask({ bytes, getDocument }: Readonly<{
  bytes: Uint8Array
  getDocument: PdfReaderModule['getDocument']
}>) {
  try {
    return { ok: true, value: getDocument({ data: bytes.slice() }) } as const
  } catch {
    return { ok: false, error: { type: 'pdf-reader-runtime-failure' } } as const
  }
}

async function readPdfLoadingTask({ loadingTask }: Readonly<{
  loadingTask: ReturnType<PdfReaderModule['getDocument']>
}>) {
  const pdfDocumentResult = await loadPdfDocument({ loadingTask })
  const readResult = pdfDocumentResult.ok
    ? await extractPdfText({ pdfDocument: pdfDocumentResult.value })
    : pdfDocumentResult
  await destroyPdfLoadingTask({ loadingTask })
  return readResult
}

async function loadPdfDocument({ loadingTask }: Readonly<{
  loadingTask: ReturnType<PdfReaderModule['getDocument']>
}>) {
  try {
    return { ok: true, value: await loadingTask.promise } as const
  } catch (error) {
    return readPdfLoadingFailure({ error })
  }
}

async function extractPdfText({ pdfDocument }: Readonly<{ pdfDocument: PDFDocumentProxy }>) {
  try {
    const text = await readPdfText({ pdfDocument })
    return text.length === 0
      ? textEmptyResult
      : { ok: true, value: { pageCount: pdfDocument.numPages, text } } as const
  } catch {
    return pdfReadFailureResult
  }
}

async function destroyPdfLoadingTask({ loadingTask }: Readonly<{
  loadingTask: ReturnType<PdfReaderModule['getDocument']>
}>) {
  try {
    await loadingTask.destroy()
  } catch {
    return
  }
}

function readCompatibilityFailure({ browserEnvironment }: Readonly<{
  browserEnvironment: SourceDocumentBrowserEnvironment
}>) {
  if (!browserEnvironment.capabilities.includes('worker')) return incompatibleBrowserResult
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
  document: SourceDocument
}>) {
  const text = decodeUtf8({ bytes: document.bytes }).trim()
  return text.length === 0
    ? textEmptyResult
    : { ok: true, value: { pageCount: null, text } } as const
}

function decodeUtf8({ bytes }: Readonly<{ bytes: Uint8Array }>) {
  const encodedBytes = bytes.reduce((encodedText, byte) => (
    `${encodedText}%${byte.toString(16).padStart(2, '0')}`
  ), '')
  try {
    return decodeURIComponent(encodedBytes)
  } catch {
    return ''
  }
}

function readPdfLoadingFailure({ error }: Readonly<{ error: unknown }>) {
  if (hasErrorName({ error, name: 'PasswordException' })) return encryptedPdfResult
  if (hasErrorName({ error, name: 'InvalidPDFException' })) return invalidPdfResult
  return incompatiblePdfReaderRuntimeResult
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
  document: SourceDocument
}>) {
  return document.mediaType === 'application/pdf'
    || document.name.toLowerCase().endsWith('.pdf')
}

function hasPdfHeader({ bytes }: Readonly<{ bytes: Uint8Array }>) {
  return pdfHeader.every((byte, byteIndex) => bytes[byteIndex] === byte)
}

function isText({ document }: Readonly<{
  document: SourceDocument
}>) {
  return document.mediaType === 'text/plain'
    || document.name.toLowerCase().endsWith('.txt')
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

const incompatiblePdfReaderRuntimeResult = {
  ok: false,
  error: {
    type: 'incompatible-source-document-reader',
    reason: 'pdf-reader-runtime-failure',
  },
} as const

const nonBrowserTestEnvironment = {
  capabilities: ['worker'],
  userAgent: 'non-browser-test-environment',
} as const
const pdfHeader = new Uint8Array([37, 80, 68, 70, 45])
