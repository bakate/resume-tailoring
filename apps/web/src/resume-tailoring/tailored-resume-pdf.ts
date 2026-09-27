import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import puppeteer from 'puppeteer'
import type { Browser, Page } from 'puppeteer'

import {
  hasVerifiedResumeClaimProvenance,
} from './tailored-resume-contract'
import type {
  ResumePdfFailureType,
  TailoredResumePdfDependencies,
  TailoredResumePdfInputs,
} from './tailored-resume-contract'
import {
  renderTailoredResumeHtml,
} from './tailored-resume-html'

export type ResumePdfFailure = Readonly<{ type: ResumePdfFailureType }>

export type ResumePdfResult =
  | Readonly<{ ok: true; value: Uint8Array }>
  | Readonly<{ ok: false; error: ResumePdfFailure }>

const a4WidthPoints = 595.28
const a4HeightPoints = 841.89
const pageSizeTolerancePoints = 1

export async function createTailoredResumePdf({
  inputs,
  semanticValidator,
}: TailoredResumePdfDependencies & Readonly<{
  inputs: TailoredResumePdfInputs
}>): Promise<ResumePdfResult> {
  if (!hasVerifiedResumeClaimProvenance(inputs)) return provenanceInvalidResult
  let browser: Browser | undefined
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'],
    })
    return await renderAndValidatePdf({ browser, inputs, semanticValidator })
  } catch {
    return renderingUnavailableResult
  } finally {
    if (browser !== undefined) await browser.close().catch(ignoreFailure)
  }
}

async function validateSemanticProvenance({
  inputs, semanticValidator,
}: TailoredResumePdfDependencies & Readonly<{ inputs: TailoredResumePdfInputs }>) {
  const retainedClaimIds = new Set(inputs.document.items.map(({ claimId }) => claimId))
  const retainedClaims = inputs.validatedClaims.filter(({ id }) => retainedClaimIds.has(id))
  try {
    for (const claim of retainedClaims) {
      const result = await semanticValidator.validate({
        claim,
        verifiedFacts: readClaimFacts({ claim, verifiedFacts: inputs.verifiedFacts }),
      })
      if (!result.ok) return validationUnavailableResult
      if (!result.value.supported) return provenanceInvalidResult
    }
    return validLayoutResult
  } catch {
    return validationUnavailableResult
  }
}

function readClaimFacts({ claim, verifiedFacts }: Readonly<{
  claim: TailoredResumePdfInputs['validatedClaims'][number]
  verifiedFacts: TailoredResumePdfInputs['verifiedFacts']
}>) {
  const claimFactIds = new Set(claim.segments.flatMap(({ factIds }) => factIds))
  return verifiedFacts.filter(({ id }) => claimFactIds.has(id))
}

async function renderAndValidatePdf({ browser, inputs, semanticValidator }: Readonly<{
  browser: Browser
  inputs: TailoredResumePdfInputs
}> & TailoredResumePdfDependencies) {
  const page = await browser.newPage()
  await page.emulateMediaType('print')
  await page.setContent(renderTailoredResumeHtml(inputs), { waitUntil: 'load' })
  await page.evaluate(() => document.fonts.ready)
  const layoutValidation = await validatePageLayout({ page })
  if (!layoutValidation.ok) return layoutValidation
  const semanticValidation = await validateSemanticProvenance({ inputs, semanticValidator })
  if (!semanticValidation.ok) return semanticValidation
  const pdfBytes = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true })
  return validatePdf({ inputs, pdfBytes })
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

async function validatePdf({ inputs, pdfBytes }: Readonly<{
  inputs: TailoredResumePdfInputs
  pdfBytes: Uint8Array
}>): Promise<ResumePdfResult> {
  if (!hasExpectedEmbeddedFonts({ pdfBytes })) return fontsNotEmbeddedResult
  const loadingTask = getDocument({ data: pdfBytes.slice(), useSystemFonts: false })
  try {
    const pdfDocument = await loadingTask.promise
    const pageValidation = await validatePdfPage({ inputs, pdfDocument })
    return pageValidation.ok
      ? { ok: true, value: pdfBytes }
      : pageValidation
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

async function validatePdfPage({ inputs, pdfDocument }: Readonly<{
  inputs: TailoredResumePdfInputs
  pdfDocument: Awaited<ReturnType<typeof getDocument>['promise']>
}>): Promise<ResumePdfResult | typeof validLayoutResult> {
  if (pdfDocument.numPages !== 1) return invalidPageCountResult
  const pdfPage = await pdfDocument.getPage(1)
  if (!hasA4Dimensions({ view: pdfPage.view })) return invalidPageCountResult
  const extractedText = await readSelectableText({ pdfPage })
  return hasExpectedReadingOrder({ inputs, extractedText })
    ? validLayoutResult
    : contentMismatchResult
}

async function readSelectableText({ pdfPage }: Readonly<{
  pdfPage: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>['promise']>['getPage']>>
}>) {
  const textContent = await pdfPage.getTextContent()
  return textContent.items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ')
}

function hasExpectedReadingOrder({ inputs, extractedText }: Readonly<{
  inputs: TailoredResumePdfInputs
  extractedText: string
}>) {
  const normalizedText = normalizeText(extractedText)
  const expectedText = [
    inputs.locale === 'fr' ? 'CV adapté' : 'Tailored Resume',
    ...inputs.contactItems.map(({ value }) => value),
    ...inputs.document.items.map(({ text }) => text),
  ]
  let previousPosition = -1
  for (const text of expectedText) {
    const position = normalizedText.indexOf(normalizeText(text), previousPosition + 1)
    if (position <= previousPosition) return false
    previousPosition = position
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
