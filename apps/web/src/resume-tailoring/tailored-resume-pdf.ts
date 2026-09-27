import type { TailoredResumeDocument } from '@resume-tailoring/application/tailored-resume-document'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import puppeteer from 'puppeteer'
import type { Browser, Page } from 'puppeteer'

import {
  renderTailoredResumeHtml,
} from './tailored-resume-html'
import type {
  ResumeContactItem,
  ResumeDocumentLocale,
} from './tailored-resume-html'

type PdfInputs = Readonly<{
  contactItems: readonly ResumeContactItem[]
  document: TailoredResumeDocument
  locale: ResumeDocumentLocale
  photoDataUrl?: string
}>

export type ResumePdfFailure = Readonly<{
  type:
    | 'resume-pdf-content-mismatch'
    | 'resume-pdf-fonts-not-embedded'
    | 'resume-pdf-overflow'
    | 'resume-pdf-page-count-invalid'
    | 'resume-pdf-rendering-unavailable'
}>

export type ResumePdfResult =
  | Readonly<{ ok: true; value: Uint8Array }>
  | Readonly<{ ok: false; error: ResumePdfFailure }>

const a4WidthPoints = 595.28
const a4HeightPoints = 841.89
const pageSizeTolerancePoints = 1

export async function createTailoredResumePdf(inputs: PdfInputs): Promise<ResumePdfResult> {
  let browser: Browser | undefined
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
    })
    return await renderAndValidatePdf({ browser, inputs })
  } catch {
    return renderingUnavailableResult
  } finally {
    if (browser !== undefined) await browser.close().catch(ignoreFailure)
  }
}

async function renderAndValidatePdf({ browser, inputs }: Readonly<{
  browser: Browser
  inputs: PdfInputs
}>) {
  const page = await browser.newPage()
  await page.emulateMediaType('print')
  await page.setContent(renderTailoredResumeHtml(inputs), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const layoutValidation = await validatePageLayout({ page })
  if (!layoutValidation.ok) return layoutValidation
  const pdfBytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true })
  return validatePdf({ document: inputs.document, pdfBytes })
}

async function validatePageLayout({ page }: Readonly<{ page: Page }>) {
  const hasOverflow = await page.evaluate(() => {
    const resumePage = document.querySelector<HTMLElement>('.resume-page')
    if (resumePage === null) return true
    const pageBounds = resumePage.getBoundingClientRect()
    if (resumePage.scrollHeight > resumePage.clientHeight + 1) return true
    if (resumePage.scrollWidth > resumePage.clientWidth + 1) return true
    return [...resumePage.querySelectorAll<HTMLElement>('*')].some((element) => {
      const bounds = element.getBoundingClientRect()
      return bounds.bottom > pageBounds.bottom + 1 || bounds.right > pageBounds.right + 1
    })
  })
  return hasOverflow ? overflowResult : validLayoutResult
}

async function validatePdf({ document, pdfBytes }: Readonly<{
  document: TailoredResumeDocument
  pdfBytes: Uint8Array
}>): Promise<ResumePdfResult> {
  const fontValidation = validateEmbeddedFonts({ pdfBytes })
  if (!fontValidation.ok) return fontValidation
  const loadingTask = getDocument({ data: pdfBytes.slice(), useSystemFonts: false })
  try {
    const pdfDocument = await loadingTask.promise
    if (pdfDocument.numPages !== 1) return invalidPageCountResult
    const pdfPage = await pdfDocument.getPage(1)
    if (!hasA4Dimensions({ view: pdfPage.view })) {
      return invalidPageCountResult
    }
    const extractedText = await readSelectableText({ pdfPage })
    return hasEveryClaimInReadingOrder({ document, extractedText })
      ? { ok: true, value: pdfBytes }
      : contentMismatchResult
  } catch {
    return renderingUnavailableResult
  } finally {
    await loadingTask.destroy()
  }
}

function validateEmbeddedFonts({ pdfBytes }: Readonly<{ pdfBytes: Uint8Array }>) {
  const pdfSource = new TextDecoder('latin1').decode(pdfBytes)
  const embeddedFontCount = [...pdfSource.matchAll(/\/FontFile(?:2|3)?\b/gu)].length
  return embeddedFontCount >= 2 ? validFontResult : fontsNotEmbeddedResult
}

async function readSelectableText({ pdfPage }: Readonly<{
  pdfPage: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>['promise']>['getPage']>>
}>) {
  const textContent = await pdfPage.getTextContent()
  return textContent.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ')
}

function hasEveryClaimInReadingOrder({ document, extractedText }: Readonly<{
  document: TailoredResumeDocument
  extractedText: string
}>) {
  const normalizedText = normalizeText(extractedText)
  let previousClaimPosition = -1
  for (const { text } of document.items) {
    const claimPosition = normalizedText.indexOf(normalizeText(text))
    if (claimPosition <= previousClaimPosition) return false
    previousClaimPosition = claimPosition
  }
  return true
}

function hasA4Dimensions({ view }: Readonly<{ view: readonly number[] }>) {
  const width = view[2]
  const height = view[3]
  if (width === undefined || height === undefined) return false
  return Math.abs(width - a4WidthPoints) <= pageSizeTolerancePoints
    && Math.abs(height - a4HeightPoints) <= pageSizeTolerancePoints
}

function normalizeText(value: string) {
  return value.replace(/\s+/gu, ' ').trim()
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
const validLayoutResult = { ok: true } as const
const validFontResult = { ok: true } as const
