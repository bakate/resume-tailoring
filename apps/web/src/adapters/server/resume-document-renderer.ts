import { assessResumeExport, fitToPageBudget, unavailableResumeRender,
  unfittedPageBudget } from '@resume-tailoring/application/candidate-journey'
import type { PageBudgetFit, PageBudgetFitRequest, ResumeRenderRequest,
  ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
// The server bundle inlines pdfjs without its worker file, so its fake worker cannot load it by relative path.
// Importing the worker sets globalThis.pdfjsWorker, which pdfjs uses in place of that import.
import 'pdfjs-dist/legacy/build/pdf.worker.mjs'
import puppeteer from 'puppeteer'
import type { Browser, Page } from 'puppeteer'
import { hasA4Dimensions, hasExpectedEmbeddedFonts, hasExpectedPdfTextInReadingOrder } from './resume-pdf-verification'
import { renderTailoredResumeDocument } from '../../candidate-journey/tailored-resume-document'

/**
 * The step a render was at, so a failure says where it stopped without carrying any candidate content. `launch` covers
 * starting the browser and opening the request's own browsing context.
 */
type RenderStage = 'launch' | 'layout' | 'photo' | 'print' | 'fonts' | 'pdf-reading' | 'page-size' | 'reading-order'
type RenderProgress = { stage: RenderStage }
type FailureDimensions = Readonly<{ stage: RenderStage; errorName?: string }>
type RenderMetric = 'unavailable' | 'warm-up-unavailable' | 'browser-launch-milliseconds' | 'page-budget-fit-milliseconds'
  | 'page-budget-fit-layouts'
/** One printed layout, kept so the fitted one is validated and returned without printing it again. */
type PrintedLayout = Readonly<{ pageCount: number; pdf: Uint8Array; expectedText: readonly string[] }>

/** Whether the browser is ready for the next render; a warm-up is never a render and carries no Candidate content. */
export type RenderWarmUp = 'ready' | 'timeout' | 'unavailable'

type BrowserLauncher = (options: Readonly<{ timeoutMilliseconds: number }>) => Promise<Browser>

/** One Chromium, launched on first use and reused by every request of the execution environment. */
export type RenderingBrowser = Readonly<{
  /** Runs the work on a page of its own browsing context, closed afterwards with every cookie, storage and cache entry. */
  withIsolatedPage: <TResult>(work: (page: Page) => Promise<TResult>) => Promise<TResult>
  /** Launches the browser unless one is running, so the next render starts at layout. */
  warmUp: () => Promise<void>
}>

/**
 * Lambda runs Chromium in a Firecracker sandbox with no /dev/shm, no GPU and only /tmp writable, so it forks no zygote
 * and no GPU process. Chromium 155 aborts at launch with --single-process (BAK-180); its renderer process prints the
 * resume under Lambda's limits once HOME is in /tmp.
 */
const chromiumArguments = ['--disable-dev-shm-usage', '--no-sandbox', '--disable-setuid-sandbox', '--no-zygote',
  '--disable-gpu']

/**
 * A cold render, launch included, takes about 25 s on Lambda. A launch gets 45 s; with 15 s for layout and 15 s for
 * printing, a render still ends before the browser's 90 s deadline, as a typed timeout rather than a cut connection.
 */
const browserLaunchTimeoutMilliseconds = 45_000

/** Chromium writes its crash database, configuration and font cache under HOME, which only /tmp can hold on Lambda. */
function chromiumEnvironment() {
  return { ...process.env, HOME: '/tmp', XDG_CONFIG_HOME: '/tmp/.chromium', XDG_CACHE_HOME: '/tmp/.chromium' }
}

export function launchChromium({ timeoutMilliseconds }: Readonly<{ timeoutMilliseconds: number }>) {
  return puppeteer.launch({ headless: true, args: chromiumArguments, env: chromiumEnvironment(),
    timeout: timeoutMilliseconds })
}

/** A launch that outlasted its deadline; puppeteer names its own launch timeout the same way. */
class BrowserLaunchTimeout extends Error {
  override readonly name = 'TimeoutError'
}

export function createRenderingBrowser({ launch = launchChromium,
  launchTimeoutMilliseconds = browserLaunchTimeoutMilliseconds }: Readonly<{
  launch?: BrowserLauncher; launchTimeoutMilliseconds?: number
}> = {}): RenderingBrowser {
  let running: Promise<Browser> | null = null
  const forget = (launching: Promise<Browser>) => { if (running === launching) running = null }

  function startLaunch() {
    const startedAt = performance.now()
    const launching = launchWithin({ launch, timeoutMilliseconds: launchTimeoutMilliseconds })
    running = launching
    void launching.then((browser) => {
      logRenderMetric({ metric: 'browser-launch-milliseconds', value: Math.round(performance.now() - startedAt) })
      browser.once('disconnected', () => { forget(launching) })
    }, () => { forget(launching) })
    return launching
  }

  async function readBrowser() {
    const launching = running ?? startLaunch()
    const browser = await launching
    if (browser.connected) return browser
    // A browser that crashed may not have reported its disconnection yet.
    forget(launching)
    return running ?? startLaunch()
  }

  return {
    async withIsolatedPage(work) {
      const context = await (await readBrowser()).createBrowserContext()
      try {
        return await work(await context.newPage())
      } finally {
        await context.close().catch(() => undefined)
      }
    },
    async warmUp() { await readBrowser() },
  }
}

async function launchWithin({ launch, timeoutMilliseconds }: Readonly<{
  launch: BrowserLauncher; timeoutMilliseconds: number
}>) {
  const launching = launch({ timeoutMilliseconds })
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => { reject(new BrowserLaunchTimeout()) }, timeoutMilliseconds)
  })
  try {
    return await Promise.race([launching, deadline])
  } catch (error) {
    // A browser that starts after its deadline is closed; the next request launches another.
    void launching.then((browser) => browser.close()).catch(() => undefined)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function createResumeDocumentRenderer({ browser }: Readonly<{ browser: RenderingBrowser }>) {
  return {
    render: (request: ResumeRenderRequest) => renderInIsolation({ browser, request }),
    fitToPageBudget: (request: PageBudgetFitRequest) => fitInIsolation({ browser, request }),
    warmUp: () => warmUpBrowser({ browser }),
  }
}

const resumeDocumentRenderer = createResumeDocumentRenderer({ browser: createRenderingBrowser() })

export function renderResumeDocument(request: ResumeRenderRequest): Promise<ResumeRenderResult> {
  return resumeDocumentRenderer.render(request)
}

export function fitResumeDocumentToPageBudget(request: PageBudgetFitRequest): Promise<PageBudgetFit> {
  return resumeDocumentRenderer.fitToPageBudget(request)
}

export function warmUpResumeDocumentRenderer(): Promise<RenderWarmUp> {
  return resumeDocumentRenderer.warmUp()
}

async function renderInIsolation({ browser, request }: Readonly<{
  browser: RenderingBrowser; request: ResumeRenderRequest
}>): Promise<ResumeRenderResult> {
  const progress: RenderProgress = { stage: 'launch' }
  try {
    return await browser.withIsolatedPage((page) => renderDocumentPages({ page, progress, request }))
  } catch (error) {
    return unavailableRender({ request, stage: progress.stage, error })
  }
}

/** Records a failed warm-up like a failed render: its stage and the error's class name, never a message. */
async function warmUpBrowser({ browser }: Readonly<{ browser: RenderingBrowser }>): Promise<RenderWarmUp> {
  try {
    await browser.warmUp()
    return 'ready'
  } catch (error) {
    logRenderMetric({ metric: 'warm-up-unavailable', dimensions: readFailureDimensions({ stage: 'launch', error }) })
    return isLaunchTimeout(error) ? 'timeout' : 'unavailable'
  }
}

/**
 * Fits the resume to its Page Budget on one page of one browsing context: the shared Overflow Reduction steps run here,
 * each layout printed by Chromium as the export prints it, and only the fitted layout is validated as a render is. On the
 * real-sized resume a layout takes a fraction of a second once the browser runs, so the fitting ends well within the
 * browser's 90 s deadline: the measured duration and layout count are logged with each fitting.
 */
async function fitInIsolation({ browser, request }: Readonly<{
  browser: RenderingBrowser; request: PageBudgetFitRequest
}>): Promise<PageBudgetFit> {
  const progress: RenderProgress = { stage: 'launch' }
  const renderRequest = { draft: request.draft, unsupportedFieldIds: [], photoDataUrl: request.photoDataUrl }
  const startedAt = performance.now()
  try {
    return await browser.withIsolatedPage(async (page) => {
      await preparePrintPage({ page, progress })
      // Why the latest layout could not be measured, so an unmeasured resume reports where it stopped.
      const latestFailure: { current: Readonly<{ stage: RenderStage; error?: unknown }> } = { current: { stage: 'layout' } }
      const fitted = await fitToPageBudget({ request, measure: async (draft) => {
        try {
          const printed = await printLayout({ page, progress, request: { ...renderRequest, draft } })
          if (printed === null) { latestFailure.current = { stage: 'photo' }; return null }
          progress.stage = 'pdf-reading'
          return { ...printed, pageCount: await countPdfPages({ pdf: printed.pdf }) }
        } catch (error) {
          latestFailure.current = { stage: progress.stage, error }
          return null
        }
      } })
      logRenderMetric({ metric: 'page-budget-fit-milliseconds', value: Math.round(performance.now() - startedAt) })
      logRenderMetric({ metric: 'page-budget-fit-layouts', value: fitted.measurementCount })
      const fittedRequest = { ...renderRequest, draft: { ...request.draft, document: fitted.document } }
      const render = fitted.measurement === null
        ? unavailableRender({ request: fittedRequest, ...latestFailure.current })
        : await validateRenderedDocument({ ...fitted.measurement, progress, request: fittedRequest })
      return { document: fitted.document, hiddenFields: fitted.hiddenFields, render, renderCount: fitted.measurementCount }
    })
  } catch (error) {
    return { ...unfittedPageBudget({ request }), render: unavailableRender({ request: renderRequest, stage: progress.stage, error }) }
  }
}

async function renderDocumentPages({ page, progress, request }: Readonly<{
  page: Page; progress: RenderProgress; request: ResumeRenderRequest
}>) {
  await preparePrintPage({ page, progress })
  const printed = await printLayout({ page, progress, request })
  if (printed === null) return unavailableRender({ request, stage: 'photo' })
  return validateRenderedDocument({ ...printed, progress, request })
}

/** The page loads nothing but the document's own data URLs, and lays it out for print. */
async function preparePrintPage({ page, progress }: Readonly<{ page: Page; progress: RenderProgress }>) {
  progress.stage = 'layout'
  await page.setRequestInterception(true)
  page.on('request', (resource) => { void (resource.url().startsWith('data:')
    ? resource.continue() : resource.abort()).catch(() => undefined) })
  await page.emulateMediaType('print')
}

/** Prints the document as the export does; null when its photo cannot be shown. */
async function printLayout({ page, progress, request }: Readonly<{
  page: Page; progress: RenderProgress; request: ResumeRenderRequest
}>): Promise<Omit<PrintedLayout, 'pageCount'> | null> {
  progress.stage = 'layout'
  await page.setContent(renderTailoredResumeDocument({ tailoredResume: request.draft.document,
    photoDataUrl: request.photoDataUrl }), { waitUntil: 'load', timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  const imagesLoaded = await page.evaluate(() => Array.from(document.images).every((image) =>
    image.complete && image.naturalWidth > 0))
  if (!imagesLoaded) return null
  const expectedText = await readDocumentText({ page })
  progress.stage = 'print'
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true, timeout: 15_000 })
  return { pdf, expectedText }
}

async function countPdfPages({ pdf }: Readonly<{ pdf: Uint8Array }>) {
  const loading = getDocument({ data: pdf.slice(), useSystemFonts: false })
  try {
    return (await loading.promise).numPages
  } finally {
    await loading.destroy()
  }
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

/**
 * Records only the stage and the error's class name: an error message may quote the rendered document. A launch that
 * outlasted its deadline is a timeout the browser may retry, not an unavailable renderer.
 */
function unavailableRender({ request, stage, error }: Readonly<{
  request: ResumeRenderRequest; stage: RenderStage; error?: unknown
}>): ResumeRenderResult {
  logRenderMetric({ metric: 'unavailable', dimensions: readFailureDimensions({ stage, error }) })
  return unavailableResumeRender(request, stage === 'launch' && isLaunchTimeout(error) ? { type: 'timeout' } : undefined)
}

function readFailureDimensions({ stage, error }: Readonly<{ stage: RenderStage; error?: unknown }>): FailureDimensions {
  return error instanceof Error ? { stage, errorName: error.name } : { stage }
}

function isLaunchTimeout(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError'
}

function logRenderMetric({ metric, value = 1, dimensions }: Readonly<{
  metric: RenderMetric; value?: number; dimensions?: FailureDimensions
}>) {
  console.info(JSON.stringify({ category: 'privacy-safe-resume-render', metric, value,
    ...(dimensions === undefined ? {} : { dimensions }) }))
}
