import { installPromiseWithResolvers } from './promise-with-resolvers'

installPromiseWithResolvers()
await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs')
