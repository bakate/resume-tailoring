import {
  prepareValidatedTailoredResumeDocument,
} from '@resume-tailoring/application/tailored-resume-document'
import type {
  TailoredResumeDocument,
  TailoredResumePreparationFailureType,
} from '@resume-tailoring/application/tailored-resume-document'
import type {
  ResumeClaimSemanticValidator,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import puppeteer from 'puppeteer'
import type { Browser, Page } from 'puppeteer'

import type { ResumePdfFailureType, TailoredResumePdfInputs } from './tailored-resume-contract'
import { renderTailoredResumeHtml } from './tailored-resume-html'
import { readTailoredResumeTitle } from './tailored-resume-html'
import type { TailoredResumeRenderInputs } from './tailored-resume-html'
import { hasTailoredResumeOverflow } from './tailored-resume-layout'

export type ResumePdfFailure = Readonly<{ type: ResumePdfFailureType }>

export type ResumePdfResult =
  | Readonly<{ ok: true; value: Uint8Array }>
  | Readonly<{ ok: false; error: ResumePdfFailure }>

type ResumePdfDependencies = Readonly<{
  pdfTextReader?: PdfTextReader
  semanticValidator: ResumeClaimSemanticValidator
  signal?: AbortSignal
}>

type PdfPage = Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>['promise']>['getPage']>>

type PdfTextReader = Readonly<{
  read: (inputs: Readonly<{ pdfPage: PdfPage }>) => Promise<readonly string[]>
}>

const a4WidthPoints = 595.28
const a4HeightPoints = 841.89
const pageSizeTolerancePoints = 1

export async function createTailoredResumePdf({
  inputs,
  pdfTextReader = pdfJsTextReader,
  semanticValidator,
  signal,
}: ResumePdfDependencies & Readonly<{
  inputs: TailoredResumePdfInputs
}>): Promise<ResumePdfResult> {
  if (signal?.aborted === true) return renderingUnavailableResult
  const browserResult = await launchPdfBrowser()
  if (!browserResult.ok) return renderingUnavailableResult
  return renderWithBrowser({
    browser: browserResult.value, inputs, pdfTextReader, semanticValidator, signal,
  })
}

async function launchPdfBrowser() {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
      ...readConfiguredExecutablePath(),
    })
    return { ok: true, value: browser } as const
  } catch {
    return { ok: false } as const
  }
}

function readConfiguredExecutablePath() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
  return executablePath === undefined || executablePath.length === 0 ? {} : { executablePath }
}

async function renderWithBrowser({
  browser, inputs, pdfTextReader = pdfJsTextReader, semanticValidator, signal,
}: Readonly<{
  browser: Browser
  inputs: TailoredResumePdfInputs
}> & ResumePdfDependencies): Promise<ResumePdfResult> {
  const closeAbortedBrowser = () => { void browser.close().catch(ignoreFailure) }
  signal?.addEventListener('abort', closeAbortedBrowser, { once: true })
  try {
    if (signal?.aborted === true) return renderingUnavailableResult
    return await prepareAndRenderPdf({ browser, inputs, pdfTextReader, semanticValidator })
  } catch {
    return renderingUnavailableResult
  } finally {
    signal?.removeEventListener('abort', closeAbortedBrowser)
    await browser.close().catch(ignoreFailure)
  }
}

async function prepareAndRenderPdf({ browser, inputs, pdfTextReader, semanticValidator }: Readonly<{
  browser: Browser
  inputs: TailoredResumePdfInputs
  pdfTextReader: PdfTextReader
  semanticValidator: ResumeClaimSemanticValidator
}>) {
  const page = await browser.newPage()
  await page.emulateMediaType('print')
  const layoutMeasurer = createPuppeteerLayoutMeasurer({ inputs, page })
  const preparation = await prepareValidatedTailoredResumeDocument({
    inputs: inputs.source, layoutMeasurer, semanticValidator,
  })
  if (!preparation.ok) return mapPreparationFailure(preparation.error.type)
  return renderAndValidatePdf({ document: preparation.value, inputs, page, pdfTextReader })
}

function createPuppeteerLayoutMeasurer({ inputs, page }: Readonly<{
  inputs: TailoredResumePdfInputs
  page: Page
}>) {
  return {
    fits: async ({ document }: Readonly<{ document: TailoredResumeDocument }>) => {
      try {
        await renderPage({ document, inputs, page })
        return { ok: true, value: !(await hasPageOverflow({ page })) } as const
      } catch {
        return { ok: false } as const
      }
    },
  }
}

async function renderAndValidatePdf({ document, inputs, page, pdfTextReader }: Readonly<{
  document: TailoredResumeDocument
  inputs: TailoredResumePdfInputs
  page: Page
  pdfTextReader: PdfTextReader
}>): Promise<ResumePdfResult> {
  const renderInputs = createRenderInputs({ document, inputs })
  await renderPage({ document, inputs, page })
  if (await hasPageOverflow({ page })) return overflowResult
  const pdfBytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true })
  return validatePdf({ inputs: renderInputs, pdfBytes, pdfTextReader })
}

async function renderPage({ document: tailoredDocument, inputs, page }: Readonly<{
  document: TailoredResumeDocument
  inputs: TailoredResumePdfInputs
  page: Page
}>) {
  await page.setContent(renderTailoredResumeHtml(createRenderInputs({
    document: tailoredDocument, inputs,
  })), {
    waitUntil: 'load',
  })
  await page.evaluate(() => document.fonts.ready)
}

function createRenderInputs({ document, inputs }: Readonly<{
  document: TailoredResumeDocument
  inputs: TailoredResumePdfInputs
}>): TailoredResumeRenderInputs {
  return {
    contactItems: inputs.contactItems,
    document,
    locale: inputs.locale,
    targetRole: inputs.targetRole,
    ...(inputs.photoDataUrl === undefined ? {} : { photoDataUrl: inputs.photoDataUrl }),
  }
}

async function hasPageOverflow({ page }: Readonly<{ page: Page }>) {
  return page.$eval('.resume-page', hasTailoredResumeOverflow)
}

function mapPreparationFailure(type: TailoredResumePreparationFailureType): ResumePdfResult {
  if (type === 'tailored-resume-provenance-invalid') return provenanceInvalidResult
  if (type === 'tailored-resume-required-content-overflow') return overflowResult
  if (type === 'tailored-resume-validation-unavailable') return validationUnavailableResult
  return renderingUnavailableResult
}

async function validatePdf({ inputs, pdfBytes, pdfTextReader }: Readonly<{
  inputs: TailoredResumeRenderInputs
  pdfBytes: Uint8Array
  pdfTextReader: PdfTextReader
}>): Promise<ResumePdfResult> {
  if (!hasExpectedEmbeddedFonts({ pdfBytes })) return fontsNotEmbeddedResult
  const loadingTask = getDocument({ data: pdfBytes.slice(), useSystemFonts: false })
  try {
    const pdfDocument = await loadingTask.promise
    const pageValidation = await validatePdfPage({ inputs, pdfDocument, pdfTextReader })
    return pageValidation.ok ? { ok: true, value: pdfBytes } : pageValidation
  } catch {
    return renderingUnavailableResult
  } finally {
    await loadingTask.destroy()
  }
}

function hasExpectedEmbeddedFonts({ pdfBytes }: Readonly<{ pdfBytes: Uint8Array }>) {
  const pdfSource = new TextDecoder('latin1').decode(pdfBytes)
  const embeddedFontCount = [...pdfSource.matchAll(/\/FontFile(?:2|3)?\b/gu)].length
  return embeddedFontCount >= expectedPdfFontNames.length
    && expectedPdfFontNames.every((fontName) => pdfSource.includes(`+${fontName}`))
}

async function validatePdfPage({ inputs, pdfDocument, pdfTextReader }: Readonly<{
  inputs: TailoredResumeRenderInputs
  pdfDocument: Awaited<ReturnType<typeof getDocument>['promise']>
  pdfTextReader: PdfTextReader
}>): Promise<ResumePdfResult | typeof validLayoutResult> {
  if (pdfDocument.numPages !== 1) return invalidPageCountResult
  const pdfPage = await pdfDocument.getPage(1)
  if (!hasA4Dimensions({ view: pdfPage.view })) return invalidPageCountResult
  const extractedTextItems = await pdfTextReader.read({ pdfPage })
  return hasExpectedReadingOrder({ inputs, extractedTextItems })
    ? validLayoutResult
    : contentMismatchResult
}

async function readSelectableTextItems({ pdfPage }: Readonly<{
  pdfPage: PdfPage
}>) {
  const textContent = await pdfPage.getTextContent()
  return textContent.items.flatMap((item) => 'str' in item ? [item.str] : [])
}

function hasExpectedReadingOrder({ inputs, extractedTextItems }: Readonly<{
  inputs: TailoredResumeRenderInputs
  extractedTextItems: readonly string[]
}>) {
  const expectedText = [
    readTailoredResumeTitle(inputs),
    ...inputs.contactItems.map(({ value }) => value),
    ...inputs.document.items.map(({ text }) => text),
  ]
  return hasExpectedPdfTextInReadingOrder({ expectedText, extractedTextItems })
}

function hasExpectedPdfTextInReadingOrder({ expectedText, extractedTextItems }: Readonly<{
  expectedText: readonly string[]
  extractedTextItems: readonly string[]
}>) {
  const extractedText = extractedTextItems.map((value) => normalizeText({ value }))
    .join(textItemBoundary)
  let nextPosition = 0
  for (const text of expectedText) {
    const matchEnd = findTextEnd({
      extractedText, expectedText: normalizeText({ value: text }), nextPosition,
    })
    if (matchEnd === null) return false
    nextPosition = matchEnd
  }
  return true
}

function findTextEnd({ extractedText, expectedText, nextPosition }: Readonly<{
  extractedText: string
  expectedText: string
  nextPosition: number
}>) {
  for (let candidatePosition = nextPosition; candidatePosition < extractedText.length;
    candidatePosition += 1) {
    const matchEnd = matchTextAt({ candidatePosition, expectedText, extractedText })
    if (matchEnd !== null) return matchEnd
  }
  return null
}

function matchTextAt({ candidatePosition, expectedText, extractedText }: Readonly<{
  candidatePosition: number
  expectedText: string
  extractedText: string
}>) {
  let extractedPosition = candidatePosition
  let expectedPosition = 0
  while (expectedPosition < expectedText.length && extractedPosition < extractedText.length) {
    if (extractedText[extractedPosition] === textItemBoundary) {
      extractedPosition += 1
      if (expectedText[expectedPosition] === ' ') expectedPosition += 1
      continue
    }
    if (extractedText[extractedPosition] !== expectedText[expectedPosition]) return null
    extractedPosition += 1
    expectedPosition += 1
  }
  return expectedPosition === expectedText.length ? extractedPosition : null
}

function normalizeText({ value }: Readonly<{ value: string }>) {
  return value
    .normalize('NFKC')
    .replace(/[\u02BC\u2018\u2019]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
}

function hasA4Dimensions({ view }: Readonly<{ view: readonly number[] }>) {
  const width = view[2]
  const height = view[3]
  if (width === undefined || height === undefined) return false
  return Math.abs(width - a4WidthPoints) <= pageSizeTolerancePoints
    && Math.abs(height - a4HeightPoints) <= pageSizeTolerancePoints
}

function ignoreFailure() {}

const renderingUnavailableResult = {
  ok: false,
  error: { type: 'resume-pdf-rendering-unavailable' },
} as const satisfies ResumePdfResult
const overflowResult = {
  ok: false,
  error: { type: 'resume-pdf-overflow' },
} as const satisfies ResumePdfResult
const invalidPageCountResult = {
  ok: false,
  error: { type: 'resume-pdf-page-count-invalid' },
} as const satisfies ResumePdfResult
const fontsNotEmbeddedResult = {
  ok: false,
  error: { type: 'resume-pdf-fonts-not-embedded' },
} as const satisfies ResumePdfResult
const contentMismatchResult = {
  ok: false,
  error: { type: 'resume-pdf-content-mismatch' },
} as const satisfies ResumePdfResult
const provenanceInvalidResult = {
  ok: false,
  error: { type: 'resume-pdf-provenance-invalid' },
} as const satisfies ResumePdfResult
const validLayoutResult = { ok: true } as const
const validationUnavailableResult = {
  ok: false,
  error: { type: 'resume-pdf-validation-unavailable' },
} as const satisfies ResumePdfResult
const expectedPdfFontNames = ['Inter', 'Lora'] as const
const pdfJsTextReader = { read: readSelectableTextItems } as const satisfies PdfTextReader
const textItemBoundary = '\u0000'
