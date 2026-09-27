import type { SourceDocumentReader } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

export function createBrowserSourceDocumentReader(): SourceDocumentReader {
  return { read: readSourceDocument }
}

async function readSourceDocument(document: Parameters<SourceDocumentReader['read']>[0]):
ReturnType<SourceDocumentReader['read']> {
  if (document.mediaType === 'text/plain') return readPastedText({ document })
  if (!isPdf({ document })) return unsupportedResult
  try {
    const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ])
    GlobalWorkerOptions.workerSrc = workerModule.default
    const loadingTask = getDocument({ data: document.bytes.slice() })
    try {
      const pdfDocument = await loadingTask.promise
      const text = await readPdfText({ pdfDocument })
      return text.length === 0 ? unreadableResult : { ok: true, value: text }
    } finally {
      await loadingTask.destroy()
    }
  } catch {
    return unreadableResult
  }
}

function readPastedText({ document }: Readonly<{
  document: Parameters<SourceDocumentReader['read']>[0]
}>) {
  const text = new TextDecoder().decode(document.bytes).trim()
  return text.length === 0 ? unreadableResult : { ok: true, value: text } as const
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

const unreadableResult = {
  ok: false,
  error: { type: 'unreadable-source-document' },
} as const
