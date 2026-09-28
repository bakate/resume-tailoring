import pdfJsPackage from 'pdfjs-dist/package.json'
import { describe, expect, it } from 'vitest'

import { sourceDocumentBrowserSupportPolicy } from './source-document-browser-support'

describe('Source Document browser support policy', () => {
  it('requires an explicit compatibility review when PDF.js changes', () => {
    expect(pdfJsPackage.version).toBe(sourceDocumentBrowserSupportPolicy.validatedPdfJsVersion)
  })
})
