import { groupedResumeDocument, resumeContractRevision } from '@resume-tailoring/application/structured-resume-fixtures'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'

import { renderResumeDocument } from './resume-document-renderer'

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

  it('blocks overflow beyond two pages without changing the draft', async () => {
    const request = denseRequest({ count: 55 })
    const before = JSON.stringify(request.draft)

    const result = await renderResumeDocument(request)

    expect(result.assessment.layout.status).toBe('overflow')
    expect(result.assessment.exportEligibility).toMatchObject({ status: 'blocked', reasons: ['overflow'] })
    expect(result.pdf).toBeNull()
    expect(JSON.stringify(request.draft)).toBe(before)
  }, 20_000)

  it('reports missing contacts and unresolved professional changes explicitly', async () => {
    const result = await renderResumeDocument({ draft: { revision: 'invalid',
      document: { ...groupedResumeDocument, identity: null, contactDetails: [] } },
    unsupportedFieldIds: ['summary-billing'] })

    expect(result.assessment.exportEligibility).toMatchObject({ status: 'blocked',
      reasons: ['unsupported-content', 'missing-identity', 'missing-contact'] })
    expect(result.pdf).toBeNull()
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
      expect(text).toMatch(/CV normalisé — non adapté à l\s*[’ʼ']\s*offre/u)
      expect(text).toMatch(/Développement d\s*[’ʼ']\s*interfaces accessibles/u)
      expect(text).toContain('Compétences')
      expect(new TextDecoder('latin1').decode(result.pdf)).toContain('/Subtype /Image')
    } finally { await loading.destroy() }
  }, 20_000)

  it('reports rendering failure for an unreadable photo and preserves the draft', async () => {
    const request = { draft: { document: groupedResumeDocument, revision: 'photo-failure' },
      unsupportedFieldIds: [], photoDataUrl: 'data:image/png;base64,YnJva2Vu' }

    const result = await renderResumeDocument(request)

    expect(result.assessment.layout).toEqual({ status: 'unavailable', revision: 'photo-failure' })
    expect(result.pdf).toBeNull()
    expect(request.draft.document).toEqual(groupedResumeDocument)
  }, 20_000)

})


function denseRequest({ count }: Readonly<{ count: number }>) {
  return { draft: { revision: 'dense', document: { ...groupedResumeDocument,
    sections: [...groupedResumeDocument.sections, { section: 'projects' as const,
      fields: Array.from({ length: count }, (_value, fieldIndex) => ({
        id: `project-${String(fieldIndex)}`, factIds: ['source-fact-projects-0-name-0' as const],
        text: `Project ${String(fieldIndex + 1)}: Built accessible billing screens and a reusable component library with keyboard navigation, clear error messages, and documented interfaces.`,
      })) }] } }, unsupportedFieldIds: [] }
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
