import { assessResumeExport, unavailableResumeRender } from '@resume-tailoring/application/candidate-journey'
import type { ResumeRenderRequest, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
// The server bundle inlines pdfjs without its worker file, so its fake worker cannot load it by relative path.
// Importing the worker sets globalThis.pdfjsWorker, which pdfjs uses in place of that import.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import puppeteer from 'puppeteer'
import type { Browser, Page } from 'puppeteer'
import { hasA4Dimensions, hasExpectedEmbeddedFonts, hasExpectedPdfTextInReadingOrder } from './resume-pdf-verification'
import { renderTailoredResumeDocument } from '../../candidate-journey/tailored-resume-document'

/** The step a render was at, so a failure says where it stopped without carrying any candidate content. */
type RenderStage = 'launch' | 'layout' | 'photo' | 'print' | 'fonts' | 'pdf-reading' | 'page-size' | 'reading-order'
type RenderProgress = { stage: RenderStage }

export async function renderResumeDocument(request: ResumeRenderRequest): Promise<ResumeRenderResult> {
  let browser: Browser | undefined
  const progress: RenderProgress = { stage: 'launch' }
  try {
    browser = await puppeteer.launch({ headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox'] })
    return await renderDocumentPages({ browser, progress, request })
  } catch (error) {
    return unavailableRender({ request, stage: progress.stage, error })
  } finally {
    await browser?.close().catch(() => undefined)
  }
}

async function renderDocumentPages({ browser, progress, request }: Readonly<{
  browser: Browser; progress: RenderProgress; request: ResumeRenderRequest
}>) {
  progress.stage = 'layout'
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  page.on('request', (resource) => { void (resource.url().startsWith('data:')
    ? resource.continue() : resource.abort()).catch(() => undefined) })
  await page.emulateMediaType('print')
  await page.setContent(renderTailoredResumeDocument({ tailoredResume: request.draft.document,
    photoDataUrl: request.photoDataUrl }), { waitUntil: 'load', timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  const imagesLoaded = await page.evaluate(() => Array.from(document.images).every((image) =>
    image.complete && image.naturalWidth > 0))
  if (!imagesLoaded) return unavailableRender({ request, stage: 'photo' })
  const expectedText = await readDocumentText({ page })
  progress.stage = 'print'
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, timeout: 15_000 })
  return validateRenderedDocument({ expectedText, pdf, progress, request })
}

async function readDocumentText({ page }: Readonly<{ page: Page }>) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const values: string[] = []
    while (walker.nextNode() !== null) {
      const value = walker.currentNode.textContent?.trim()
      if (value) values.push(value)
    }
    return values
  })
}

async function validateRenderedDocument({ expectedText, pdf, progress, request }: Readonly<{
  expectedText: readonly string[]; pdf: Uint8Array; progress: RenderProgress; request: ResumeRenderRequest
}>): Promise<ResumeRenderResult> {
  if (!hasExpectedEmbeddedFonts({ pdfBytes: pdf })) return unavailableRender({ request, stage: 'fonts' })
  progress.stage = 'pdf-reading'
  const loading = getDocument({ data: pdf.slice(), useSystemFonts: false })
  try {
    const document = await loading.promise
    const pages = await Promise.all(Array.from({ length: document.numPages },
      (_value, pageIndex) => document.getPage(pageIndex + 1)))
    const text = await Promise.all(pages.map(async (page) => (await page.getTextContent()).items
      .flatMap((item) => 'str' in item ? [item.str] : [])))
    if (pages.some((page) => !hasA4Dimensions({ view: page.view }))) return unavailableRender({ request, stage: 'page-size' })
    if (!hasExpectedPdfTextInReadingOrder({ expectedText, extractedTextItems: text.flat() })) {
      return unavailableRender({ request, stage: 'reading-order' })
    }
    return measuredDocument({ pageCount: document.numPages, pdf, request })
  } finally {
    await loading.destroy()
  }
}

function measuredDocument({ pageCount, pdf, request }: Readonly<{
  pageCount: number; pdf: Uint8Array; request: ResumeRenderRequest
}>): ResumeRenderResult {
  const revision = request.draft.revision
  const layout = pageCount === 1 || pageCount === 2
    ? { status: 'fits', pageCount, revision } as const
    : { status: 'overflow', pageCount, revision } as const
  return { assessment: assessResumeExport({ ...request, layout }), pdf }
}

/** Records only the stage and the error's class name: an error message may quote the rendered document. */
function unavailableRender({ request, stage, error }: Readonly<{
  request: ResumeRenderRequest; stage: RenderStage; error?: unknown
}>): ResumeRenderResult {
  const dimensions = error instanceof Error ? { stage, errorName: error.name } : { stage }
  console.info(JSON.stringify({ category: 'privacy-safe-resume-render', metric: 'unavailable', value: 1, dimensions }))
  return unavailableResumeRender(request)
}
