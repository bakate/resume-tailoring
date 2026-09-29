import mammoth from 'mammoth'
import JSZip from 'jszip'

import type {
  SourceDocument,
  SourceDocumentReader,
} from '@resume-tailoring/application/source-intake'
import { docxMediaType } from '@resume-tailoring/application/source-intake'
import { createBrowserPdfDocumentReader } from '../resume-tailoring/source-document-pdf'

type PdfDocumentReader = ReturnType<typeof createBrowserPdfDocumentReader>['read']

type SourceIntakeDocumentReaderDependencies = Readonly<{
  extractDocxText?: (bytes: Uint8Array) => Promise<string>
  readDocxPageCount?: (bytes: Uint8Array) => Promise<number | null>
  readPdfDocument?: PdfDocumentReader
}>

export function createBrowserSourceIntakeDocumentReader({
  extractDocxText = extractBrowserDocxText,
  readDocxPageCount = readBrowserDocxPageCount,
  readPdfDocument = createBrowserPdfDocumentReader().read,
}: SourceIntakeDocumentReaderDependencies = {}): SourceDocumentReader {
  return {
    read: (document) => readSourceDocument({
      document, extractDocxText, readDocxPageCount, readPdfDocument,
    }),
  }
}

async function readSourceDocument({
  document,
  extractDocxText,
  readDocxPageCount,
  readPdfDocument,
}: Readonly<{
  document: SourceDocument
  extractDocxText: (bytes: Uint8Array) => Promise<string>
  readDocxPageCount: (bytes: Uint8Array) => Promise<number | null>
  readPdfDocument: PdfDocumentReader
}>) {
  if (isPastedText({ document })) return readPastedText({ document })
  if (isDocx({ document })) return readDocx({
    document, extractDocxText, readDocxPageCount,
  })
  if (isPdf({ document })) return readPdf({ document, readPdfDocument })
  return unsupportedResult
}

function readPastedText({ document }: Readonly<{ document: SourceDocument }>) {
  const text = decodeUtf8({ bytes: document.bytes }).trim()
  return text.length === 0
    ? emptyResult
    : { ok: true, value: { pageCount: null, text } } as const
}

async function readDocx({
  document,
  extractDocxText,
  readDocxPageCount,
}: Readonly<{
  document: SourceDocument
  extractDocxText: (bytes: Uint8Array) => Promise<string>
  readDocxPageCount: (bytes: Uint8Array) => Promise<number | null>
}>) {
  try {
    const [extractedText, pageCount] = await Promise.all([
      extractDocxText(document.bytes),
      readDocxPageCount(document.bytes),
    ])
    const text = extractedText.trim()
    if (pageCount === null) return unreadableResult
    return text.length === 0
      ? emptyResult
      : { ok: true, value: { pageCount, text } } as const
  } catch {
    return invalidResult
  }
}

async function readPdf({
  document,
  readPdfDocument,
}: Readonly<{
  document: SourceDocument
  readPdfDocument: PdfDocumentReader
}>) {
  const result = await readPdfDocument(document)
  if (!result.ok) return mapPdfFailure({ failure: result.error })
  return result
}

async function extractBrowserDocxText(bytes: Uint8Array) {
  const result = await mammoth.extractRawText({ arrayBuffer: bytes.slice().buffer })
  return result.value
}

async function readBrowserDocxPageCount(bytes: Uint8Array) {
  try {
    const archive = await JSZip.loadAsync(bytes.slice().buffer)
    const applicationProperties = archive.file('docProps/app.xml')
    if (applicationProperties === null) return null
    const propertiesXml = await applicationProperties.async('text')
    const pageCount = propertiesXml.match(/<Pages>(\d+)<\/Pages>/u)?.[1]
    return pageCount === undefined ? null : Number(pageCount)
  } catch {
    return null
  }
}

function mapPdfFailure({ failure }: Readonly<{
  failure: Awaited<ReturnType<PdfDocumentReader>> extends infer TResult
    ? TResult extends Readonly<{ ok: false; error: infer TError }> ? TError : never
    : never
}>) {
  if (failure.type === 'unsupported-source-document') return unsupportedResult
  if (failure.type === 'unreadable-source-document') {
    if (failure.reason === 'encrypted-pdf') return encryptedResult
    if (failure.reason === 'text-empty') return scannedResult
    if (failure.reason === 'invalid-pdf') return invalidResult
  }
  return unreadableResult
}

function decodeUtf8({ bytes }: Readonly<{ bytes: Uint8Array }>) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return ''
  }
}

function isPastedText({ document }: Readonly<{ document: SourceDocument }>) {
  return document.mediaType === 'text/plain' || document.name.toLowerCase().endsWith('.txt')
}

function isDocx({ document }: Readonly<{ document: SourceDocument }>) {
  return document.mediaType === docxMediaType || document.name.toLowerCase().endsWith('.docx')
}

function isPdf({ document }: Readonly<{ document: SourceDocument }>) {
  return document.mediaType === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf')
}

const unsupportedResult = { ok: false, error: 'unsupported-document' } as const
const unreadableResult = { ok: false, error: 'unreadable-document' } as const
const encryptedResult = { ok: false, error: 'encrypted-document' } as const
const scannedResult = { ok: false, error: 'scanned-document' } as const
const invalidResult = { ok: false, error: 'invalid-document' } as const
const emptyResult = { ok: false, error: 'empty-document' } as const
