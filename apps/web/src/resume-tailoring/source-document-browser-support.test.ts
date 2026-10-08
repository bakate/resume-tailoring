import { readFile } from 'node:fs/promises'

import pdfJsPackage from 'pdfjs-dist/package.json'
import { describe, expect, it } from 'vitest'

import { sourceDocumentBrowserSupportPolicy } from './source-document-browser-support'

describe('Source Document browser support policy', () => {
  it('requires an explicit compatibility review when PDF.js changes', () => {
    expect(pdfJsPackage.version).toBe(sourceDocumentBrowserSupportPolicy.validatedPdfJsVersion)
  })

  it('pre-bundles every package the PDF worker imports so the first PDF read does not reload dev', async () => {
    const workerSource = await readFile(new URL('source-document-pdf-worker.ts', import.meta.url), 'utf8')

    const workerPackages = [...workerSource.matchAll(/(?:\bfrom|\bimport\(?)\s*['"]([^'"./][^'"]*)['"]/g)].map(([, specifier]) => specifier)

    expect(workerPackages).not.toHaveLength(0)
    expect(new Set(sourceDocumentBrowserSupportPolicy.pdfWorkerPreBundledPackages)).toEqual(new Set(workerPackages))
  })
})
