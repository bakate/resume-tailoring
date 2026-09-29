import type {
  JobPostingDocument,
  JobPostingDocumentReader,
} from '@resume-tailoring/application/job-match'
import { createBrowserPdfDocumentReader } from '../resume-tailoring/source-document-pdf'

type PdfDocumentReader = ReturnType<typeof createBrowserPdfDocumentReader>['read']

export function createBrowserJobPostingDocumentReader({
  readPdfDocument = createBrowserPdfDocumentReader().read,
}: Readonly<{ readPdfDocument?: PdfDocumentReader }> = {}): JobPostingDocumentReader {
  return { read: (document) => readJobPostingDocument({ document, readPdfDocument }) }
}

async function readJobPostingDocument({ document, readPdfDocument }: Readonly<{
  document: JobPostingDocument
  readPdfDocument: PdfDocumentReader
}>) {
  if (isTextDocument({ document })) return readTextDocument({ document })
  if (!isPdfDocument({ document })) return unsupportedResult
  const result = await readPdfDocument(document)
  if (!result.ok) return mapPdfFailure({ failure: result.error })
  const text = result.value.text.trim()
  return text.length === 0 ? emptyResult : { ok: true, value: { text } } as const
}

function readTextDocument({ document }: Readonly<{ document: JobPostingDocument }>) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(document.bytes).trim()
    return text.length === 0 ? emptyResult : { ok: true, value: { text } } as const
  } catch {
    return invalidResult
  }
}

function mapPdfFailure({ failure }: Readonly<{
  failure: Awaited<ReturnType<PdfDocumentReader>> extends infer TResult
    ? TResult extends Readonly<{ ok: false; error: infer TError }> ? TError : never
    : never
}>) {
  if (failure.type !== 'unreadable-source-document') return unsupportedResult
  if (failure.reason === 'text-empty') return scannedResult
  if (failure.reason === 'invalid-pdf') return invalidResult
  return unreadableResult
}

function isTextDocument({ document }: Readonly<{ document: JobPostingDocument }>) {
  return document.mediaType === 'text/plain' || document.name.toLowerCase().endsWith('.txt')
}

function isPdfDocument({ document }: Readonly<{ document: JobPostingDocument }>) {
  return document.mediaType === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf')
}

const unsupportedResult = { ok: false, error: 'unsupported-job-posting' } as const
const unreadableResult = { ok: false, error: 'unreadable-job-posting' } as const
const scannedResult = { ok: false, error: 'scanned-job-posting' } as const
const invalidResult = { ok: false, error: 'invalid-job-posting' } as const
const emptyResult = { ok: false, error: 'empty-job-posting' } as const
