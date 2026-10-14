import { fitToPageBudgetByRendering } from '@resume-tailoring/application/candidate-journey'
import type { PageBudgetFitRequest } from '@resume-tailoring/application/candidate-journey'
import { prepareResumeSections } from '@resume-tailoring/application/resume-preparation'
import { groupedResumeDocument, resumeContractRevision,
  writeResumeSectionFromFacts } from '@resume-tailoring/application/structured-resume-fixtures'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import { createFakeResumeSectionModels } from '@resume-tailoring/application/testing'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { Browser, Page } from 'puppeteer'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { createRenderingBrowser, createResumeDocumentRenderer, launchChromium,
  renderResumeDocument } from './resume-document-renderer'
import { realSizedResumeFixture } from '../../model-evaluation/real-sized-resume-corpus'

describe('structured resume PDF rendering boundary', () => {
  it('renders the current grouped document as selectable A4 pages with embedded fonts', async () => {
    const result = await renderResumeDocument({
      draft: { document: groupedResumeDocument, revision: resumeContractRevision },
      unsupportedFieldIds: [],
    })

    expect(result.assessment.layout).toEqual({ status: 'fits', revision: resumeContractRevision, pageCount: 1 })
    expect(result.assessment.exportEligibility.status).toBe('eligible')
    expect(result.pdf).not.toBeNull()
    if (result.pdf === null) return
    const loading = getDocument({ data: result.pdf.slice() })
    try {
      const document = await loading.promise
      const page = await document.getPage(1)
      const text = (await page.getTextContent()).items.flatMap((item) => 'str' in item ? item.str : []).join(' ')
      expect(page.view[2]).toBeCloseTo(595.28, 0)
      expect(page.view[3]).toBeCloseTo(841.89, 0)
      expect(text).toMatch(/Alex Morgan.*Frontend Engineer.*Northwind.*2021.*2024.*Contoso.*Front-end.*React.*TypeScript/su)
      expect(new TextDecoder('latin1').decode(result.pdf)).toMatch(/\/FontFile2/u)
    } finally {
      await loading.destroy()
    }
  }, 20_000)
  it('measures two real pages without dropping evidence', async () => {
    const result = await renderResumeDocument(denseRequest({ count: 18 }))

    expect(result.assessment.layout).toMatchObject({ status: 'fits', pageCount: 2 })
    expect(result.pdf).not.toBeNull()
    if (result.pdf === null) return
    const text = await readPdfText(result.pdf)
    expect(text).toContain('Accessible component library')
    expect(text).toContain('Project 18:')
  }, 20_000)

  // Summaries of increasing length slide every experience across the page break at least once.
  it.each([0, 2, 4, 6, 8, 10])('keeps every experience whole on one page after %i summary lines', async (summaryLines) => {
    const request = experienceRequest({ summaryLines })

    const result = await renderResumeDocument(request)

    expect(result.pdf).not.toBeNull()
    if (result.pdf === null) return
    const pages = await readPdfPages(result.pdf)
    const pageOf = (text: string) => pages.findIndex((page) => page.replace(/\s+/gu, '').includes(text.replace(/\s+/gu, '')))
    for (const experience of breakingExperiences) {
      const headingPage = pageOf(experience.role)
      expect(headingPage, experience.role).toBeGreaterThanOrEqual(0)
      for (const text of [experience.organization, experience.dates, experience.context, ...experience.achievements]) {
        expect(pageOf(text), `${experience.role}: ${text}`).toBe(headingPage)
      }
    }
  }, 20_000)

  it('lays an Earlier Experience out on a single line of role, organization and dates', async () => {
    const [relevant, earlier] = groupedResumeDocument.experiences
    const request = { draft: { revision: 'earlier', document: { ...groupedResumeDocument,
      experiences: [relevant, { ...earlier, chronology: 'earlier' as const }] } }, unsupportedFieldIds: [] }

    const result = await renderResumeDocument(request)

    expect(result.pdf).not.toBeNull()
    if (result.pdf === null) return
    const lines = await readPdfLines(result.pdf)
    const line = lines.find((text) => text.includes('Software Developer'))
    expect(line).toMatch(/Software Developer.*Contoso.*2018 – 2021/u)
  }, 20_000)

  it('blocks overflow beyond two pages without changing the draft', async () => {
    const request = denseRequest({ count: 55 })
    const before = JSON.stringify(request.draft)

    const result = await renderResumeDocument(request)

    expect(result.assessment.layout.status).toBe('overflow')
    expect(result.assessment.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['overflow'] })
    expect(result.pdf, 'An overflowing document still renders for preview').not.toBeNull()
    expect(JSON.stringify(request.draft)).toBe(before)
  }, 20_000)

  it('renders the preview while reporting missing contacts and unresolved professional changes', async () => {
    const request = { draft: { revision: 'invalid', document: { ...groupedResumeDocument, identity: null, contactDetails: [] } },
      unsupportedFieldIds: ['summary-billing'] }

    const result = await renderResumeDocument(request)

    expect(result.assessment.exportEligibility).toMatchObject({ status: 'blocked',
      reasons: ['unsupported-content', 'missing-identity', 'missing-contact'] })
    expect(result.pdf, 'A missing name or contact blocks only the download').not.toBeNull()
  }, 20_000)

  it('uses the same quality checks for French prose, a normalized title, and an optional photo', async () => {
    const result = await renderResumeDocument({ draft: { revision: 'french', document: {
      ...groupedResumeDocument, locale: 'fr', purpose: 'normalized',
      valueProposition: { kind: 'prose', paragraphs: [{ id: 'summary',
        text: 'Développement d’interfaces accessibles et d’une bibliothèque réutilisable.',
        factIds: ['source-fact-experiences-0-achievements-0'] }] },
    } }, unsupportedFieldIds: [], photoDataUrl: transparentPhoto })

    expect(result.assessment.exportEligibility.status).toBe('eligible')
    if (result.pdf === null) { expect(result.pdf).not.toBeNull(); return }
    const loading = getDocument({ data: result.pdf.slice() })
    try {
      const pdf = await loading.promise
      const page = await pdf.getPage(1)
      const text = (await page.getTextContent()).items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ')
      expect(text).toMatch(/CV général – non adapté à une offre/u)
      expect(text).toMatch(/Développement d\s*[’ʼ']\s*interfaces accessibles/u)
      expect(text).toContain('Compétences')
      expect(new TextDecoder('latin1').decode(result.pdf)).toContain('/Subtype /Image')
    } finally { await loading.destroy() }
  }, 20_000)

  it.each(unusualCharacters)('exports a document whose text contains %s', async (_case, text) => {
    const result = await renderResumeDocument({ draft: { revision: 'invisible', document: {
      ...groupedResumeDocument, valueProposition: { kind: 'prose', paragraphs: [{ id: 'summary', text,
        factIds: ['source-fact-experiences-0-achievements-0'] }] },
    } }, unsupportedFieldIds: [] })

    expect(result.assessment.layout).toMatchObject({ status: 'fits' })
    expect(result.pdf).not.toBeNull()
  }, 20_000)

  it('reports rendering failure for an unreadable photo and preserves the draft', async () => {
    const request = { draft: { document: groupedResumeDocument, revision: 'photo-failure' },
      unsupportedFieldIds: [], photoDataUrl: 'data:image/png;base64,YnJva2Vu' }

    const result = await renderResumeDocument(request)

    expect(result.assessment.layout).toEqual({ status: 'unavailable', revision: 'photo-failure' })
    expect(result.pdf).toBeNull()
    expect(request.draft.document).toEqual(groupedResumeDocument)
  }, 20_000)

  it('records which rendering stage failed without recording candidate content', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    onTestFinished(() => { log.mockRestore() })

    await renderResumeDocument({ draft: { document: groupedResumeDocument, revision: 'photo-failure' },
      unsupportedFieldIds: [], photoDataUrl: 'data:image/png;base64,YnJva2Vu' })

    const records = log.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)
    expect(records).toContainEqual({ category: 'privacy-safe-resume-render', metric: 'unavailable', value: 1,
      dimensions: { stage: 'photo' } })
    expect(JSON.stringify(log.mock.calls)).not.toContain('Alex Morgan')
  }, 20_000)
})


describe('reused rendering browser', () => {
  it('renders two consecutive documents with one browser, closing each request\'s browsing context', async () => {
    const rendering = createLaunchRecordingRenderer()

    const results = [await rendering.renderer.render(simpleRequest), await rendering.renderer.render(simpleRequest)]

    expect(results.map(({ pdf }) => pdf !== null)).toEqual([true, true])
    expect(rendering.browsers).toHaveLength(1)
    expect(rendering.browsers[0]?.browserContexts(), 'Only the default context is left open').toHaveLength(1)
  }, 30_000)

  it('keeps no cookie, local storage entry or cached resource from one request to the next', async () => {
    const site = await serveStatefulSite()
    const rendering = createLaunchRecordingRenderer()

    const first = await rendering.browser.withIsolatedPage((page) => site.storeStateAndReadIt(page))
    const second = await rendering.browser.withIsolatedPage((page) => site.readState(page))

    expect(first, 'The state is kept, and the resource cached, within one request').toEqual({ cookie: 'candidate=stored',
      storage: 'stored', resourceDownloads: 1 })
    expect(second).toEqual({ cookie: '', storage: null, resourceDownloads: 2 })
    expect(rendering.browsers).toHaveLength(1)
  }, 30_000)

  it.each(['closed', 'crashed'] as const)('relaunches a browser that %s before the next render', async (ending) => {
    const rendering = createLaunchRecordingRenderer()
    await rendering.renderer.render(simpleRequest)
    await endBrowser({ browser: rendering.browsers[0], ending })

    const result = await rendering.renderer.render(simpleRequest)

    expect(result.pdf).not.toBeNull()
    expect(rendering.browsers).toHaveLength(2)
  }, 30_000)

  it('answers a launch slower than its deadline with a timeout, logged at its stage without content', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    onTestFinished(() => { log.mockRestore() })
    const renderer = createResumeDocumentRenderer({ browser: createRenderingBrowser({ launchTimeoutMilliseconds: 50,
      launch: () => new Promise<Browser>(() => undefined) }) })

    const result = await renderer.render(simpleRequest)

    expect(result.assessment.layout).toEqual({ status: 'unavailable', revision: resumeContractRevision })
    expect(result.failure?.cause).toEqual({ type: 'timeout' })
    expect(log.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown)).toContainEqual({
      category: 'privacy-safe-resume-render', metric: 'unavailable', value: 1,
      dimensions: { stage: 'launch', errorName: 'TimeoutError' } })
    expect(JSON.stringify(log.mock.calls)).not.toContain('Alex Morgan')
  })

  it('warms the browser up so the next render reuses it', async () => {
    const rendering = createLaunchRecordingRenderer()

    const warmUp = await rendering.renderer.warmUp()
    const result = await rendering.renderer.render(simpleRequest)

    expect(warmUp).toBe('ready')
    expect(result.pdf).not.toBeNull()
    expect(rendering.browsers).toHaveLength(1)
  }, 30_000)

  it('reports a warm-up whose launch outlasted its deadline as a timeout', async () => {
    const renderer = createResumeDocumentRenderer({ browser: createRenderingBrowser({ launchTimeoutMilliseconds: 50,
      launch: () => new Promise<Browser>(() => undefined) }) })

    const warmUp = await renderer.warmUp()

    expect(warmUp).toBe('timeout')
  })
})

describe('Page Budget fitting in one rendering operation', () => {
  it.each([['the real-sized resume', readRealSizedFitRequest], ['an already one-page resume', readOnePageFitRequest]] as const)(
    'reduces %s as the shared Overflow Reduction steps do, rendering each layout in full', async (_case, readRequest) => {
      const rendering = createLaunchRecordingRenderer()
      const request = await readRequest()
      // The shared steps, each layout measured by a complete render of its own, as before one operation fitted.
      const expected = await fitToPageBudgetByRendering({ request, render: rendering.renderer.render })

      const fit = await rendering.renderer.fitToPageBudget(request)

      expect({ document: fit.document, hiddenFields: fit.hiddenFields })
        .toEqual({ document: expected.document, hiddenFields: expected.hiddenFields })
      expect(fit.render.assessment.layout).toEqual(expected.render.assessment.layout)
      expect(fit.render.assessment.exportEligibility.status).toBe('eligible')
      expect(await readPdfText(fit.render.pdf ?? expect.fail('Expected the fitted PDF')))
        .toContain(fit.document.experiences[0]?.role?.text)
      expect(rendering.browsers).toHaveLength(1)
    }, 120_000)

  it('stops without running a step when one page is out of reach, keeping the resume unchanged', async () => {
    const rendering = createLaunchRecordingRenderer()
    // Every project cites a relevant fact, so no step hides one: even every step applied overflows two pages.
    const request = { ...fitRequestFor(denseRequest({ count: 55 }).draft.document),
      relevantFactIds: ['source-fact-projects-0-name-0'] }

    const fit = await rendering.renderer.fitToPageBudget(request)

    expect(fit.renderCount, 'The resume as it is, then with every step applied').toBe(2)
    expect(fit.hiddenFields).toEqual([])
    expect(fit.document).toEqual(request.draft.document)
    expect(fit.render.assessment.layout).toMatchObject({ status: 'overflow' })
    expect(fit.render.pdf).not.toBeNull()
  }, 60_000)

  it('answers an unreadable photo with an unavailable render and the resume unchanged', async () => {
    const rendering = createLaunchRecordingRenderer()
    const request = { ...await readRealSizedFitRequest(), photoDataUrl: 'data:image/png;base64,YnJva2Vu' }

    const fit = await rendering.renderer.fitToPageBudget(request)

    expect(fit.render.assessment.layout).toEqual({ status: 'unavailable', revision: request.draft.revision })
    expect(fit.hiddenFields).toEqual([])
    expect(fit.document).toEqual(request.draft.document)
  }, 60_000)
})

const simpleRequest = { draft: { document: groupedResumeDocument, revision: resumeContractRevision }, unsupportedFieldIds: [] }

const fittingToday = Date.UTC(2026, 9, 14)

function fitRequestFor(document: TailoredResume): PageBudgetFitRequest {
  return { draft: { document, revision: 'fitting' }, restoredFieldIds: [], relevantFactIds: [], today: fittingToday,
    releasesRestoredContent: false }
}

function readOnePageFitRequest() {
  return Promise.resolve(fitRequestFor(groupedResumeDocument))
}

/** The anonymized real-sized resume, written section by section verbatim from its Candidate Facts. */
async function readRealSizedFitRequest(): Promise<PageBudgetFitRequest> {
  const { request } = realSizedResumeFixture
  const prepared = await prepareResumeSections({ request, revision: 'fitting', now: Date.now, recordTelemetry: () => undefined,
    models: createFakeResumeSectionModels({ writeSection: (input) => Promise.resolve({ ok: true,
      value: writeResumeSectionFromFacts(input) }) }) })
  if (prepared.status !== 'prepared') return expect.fail(`Expected the real-sized resume prepared, got ${prepared.status}`)
  return { ...fitRequestFor({ ...prepared.document, identity: groupedResumeDocument.identity,
    contactDetails: groupedResumeDocument.contactDetails }), relevantFactIds: request.jobMatch.analysis.relevantFactIds }
}

/** A renderer of its own whose launches are kept, so a case can count them and every browser closes after it. */
function createLaunchRecordingRenderer() {
  const browsers: Browser[] = []
  const browser = createRenderingBrowser({ launch: async (options) => {
    const launched = await launchChromium(options)
    browsers.push(launched)
    return launched
  } })
  onTestFinished(async () => { await Promise.all(browsers.map((launched) => launched.close().catch(() => undefined))) })
  return { browser, browsers, renderer: createResumeDocumentRenderer({ browser }) }
}

async function endBrowser({ browser, ending }: Readonly<{ browser: Browser | undefined; ending: 'closed' | 'crashed' }>) {
  if (browser === undefined) return expect.fail('Expected a launched browser')
  const disconnected = new Promise((resolve) => { browser.once('disconnected', resolve) })
  if (ending === 'closed') await browser.close()
  else browser.process()?.kill('SIGKILL')
  await disconnected
}

/**
 * A local site whose page stores a cookie and a local storage entry and loads a resource cacheable for an hour, so a
 * second request shows whether any of it survived the first.
 */
async function serveStatefulSite() {
  let resourceDownloads = 0
  const server = createServer((request, response) => {
    if (request.url === '/cached.js') {
      resourceDownloads += 1
      response.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'public, max-age=3600' })
      response.end('window.cachedResourceLoaded = true')
      return
    }
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('<!doctype html><script src="/cached.js"></script>')
  })
  await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  onTestFinished(() => new Promise<void>((resolve) => { server.close(() => { resolve() }) }))
  const origin = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`
  const readState = async (page: Page) => {
    await page.goto(`${origin}/probe`, { waitUntil: 'load' })
    const stored = await page.evaluate(() => ({ cookie: document.cookie, storage: localStorage.getItem('candidate') }))
    return { ...stored, resourceDownloads }
  }
  return {
    readState,
    async storeStateAndReadIt(page: Page) {
      await page.goto(`${origin}/store`, { waitUntil: 'load' })
      await page.evaluate(() => {
        document.cookie = 'candidate=stored; max-age=3600'
        localStorage.setItem('candidate', 'stored')
      })
      return readState(page)
    },
  }
}


/** Text extracted from a PDF Source Document often carries invisible characters that a PDF never prints. */
const unusualCharacters = [['a soft hyphen', 'acces\u00adsible'], ['a zero-width space', 'billing\u200bscreens'],
  ['bullets and symbols', '● Built ✓ screens ★ → ≥ 90 %']] as const

function denseRequest({ count }: Readonly<{ count: number }>) {
  return { draft: { revision: 'dense', document: { ...groupedResumeDocument,
    sections: [...groupedResumeDocument.sections, { section: 'projects' as const,
      fields: Array.from({ length: count }, (_value, fieldIndex) => ({
        id: `project-${String(fieldIndex)}`, factIds: ['source-fact-projects-0-name-0' as const],
        text: `Project ${String(fieldIndex + 1)}: Built accessible billing screens and a reusable component library with keyboard navigation, clear error messages, and documented interfaces.`,
      })) }] } }, unsupportedFieldIds: [] }
}

const breakingExperiences = Array.from({ length: 7 }, (_value, index) => ({
  role: `Platform Engineer ${String(index + 1)}`, organization: `Organization ${String(index + 1)}`,
  dates: `${String(2010 + index)} – ${String(2011 + index)}`,
  context: `Context of experience ${String(index + 1)}: a product team building accessible billing screens.`,
  achievements: Array.from({ length: 4 }, (_achievement, item) =>
    `Achievement ${String(item + 1)} of experience ${String(index + 1)}: delivered accessible features with keyboard support, clear error messages and documented interfaces for other teams.`),
}))

/** Seven experiences with a context and four achievements each, after a summary of the requested length. */
function experienceRequest({ summaryLines }: Readonly<{ summaryLines: number }>) {
  const factIds = ['source-fact-experiences-0-achievements-0' as const]
  const field = (id: string, text: string) => ({ id, text, factIds })
  return { draft: { revision: `breaking-${String(summaryLines)}`, document: { ...groupedResumeDocument,
    valueProposition: { kind: 'prose' as const, paragraphs: Array.from({ length: summaryLines }, (_value, line) =>
      field(`summary-${String(line)}`, 'Built accessible interfaces with product, design and support partners across several teams.')) },
    experiences: breakingExperiences.map((experience, index) => ({ id: `experiences.${String(index)}`, chronology: 'relevant' as const,
      role: field(`role-${String(index)}`, experience.role), organization: field(`organization-${String(index)}`, experience.organization),
      startDate: field(`start-${String(index)}`, experience.dates.split(' – ')[0] ?? ''),
      endDate: field(`end-${String(index)}`, experience.dates.split(' – ')[1] ?? ''), location: null,
      context: field(`context-${String(index)}`, experience.context),
      achievements: experience.achievements.map((achievement, item) => field(`achievement-${String(index)}-${String(item)}`, achievement)),
    })) } }, unsupportedFieldIds: [] }
}

async function readPdfPages(bytes: Uint8Array): Promise<readonly string[]> {
  const loading = getDocument({ data: bytes.slice() })
  try {
    const document = await loading.promise
    const pages = await Promise.all(Array.from({ length: document.numPages },
      (_value, pageIndex) => document.getPage(pageIndex + 1)))
    const content = await Promise.all(pages.map((page) => page.getTextContent()))
    return content.map(({ items }) => items.flatMap((item) => 'str' in item ? [item.str] : []).join(' '))
  } finally { await loading.destroy() }
}

/** The text of the first page grouped by baseline, top to bottom, so items laid out on one line read together. */
async function readPdfLines(bytes: Uint8Array): Promise<readonly string[]> {
  const loading = getDocument({ data: bytes.slice() })
  try {
    const page = await (await loading.promise).getPage(1)
    const lines = new Map<number, string[]>()
    for (const item of (await page.getTextContent()).items) {
      if (!('str' in item) || item.str.trim().length === 0) continue
      const baseline = Math.round(Number(item.transform[5]))
      lines.set(baseline, [...(lines.get(baseline) ?? []), item.str])
    }
    return [...lines.entries()].sort(([top], [bottom]) => bottom - top).map(([, items]) => items.join(' '))
  } finally { await loading.destroy() }
}

const transparentPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN9sAAAAASUVORK5CYII='

async function readPdfText(bytes: Uint8Array): Promise<string> {
  const loading = getDocument({ data: bytes.slice() })
  try {
    const document = await loading.promise
    const pages = await Promise.all(Array.from({ length: document.numPages },
      (_value, pageIndex) => document.getPage(pageIndex + 1)))
    const content = await Promise.all(pages.map((page) => page.getTextContent()))
    return content.flatMap(({ items }) => items.flatMap((item) => 'str' in item ? [item.str] : [])).join(' ')
  } finally { await loading.destroy() }
}
