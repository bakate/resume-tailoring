export const sourceDocumentBrowserSupportPolicy = {
  buildTargets: ['chrome125', 'firefox140', 'safari18'],
  matrix: {
    chromium: {
      minimumMajorVersion: 125,
      variants: ['Chrome desktop', 'Chromium desktop', 'Chrome for Android'],
    },
    firefox: {
      minimumMajorVersion: 140,
      variants: ['Firefox desktop', 'Firefox for Android'],
    },
    webkit: {
      minimumMajorVersion: 18,
      variants: ['Safari for macOS', 'Safari for iOS', 'Safari for iPadOS'],
    },
  },
  validatedPdfJsVersion: '6.3.289',
  pdfWorkerPreBundledPackages: ['pdfjs-dist/legacy/build/pdf.worker.min.mjs'],
} as const
