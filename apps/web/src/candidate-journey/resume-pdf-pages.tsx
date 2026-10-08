import { useEffect, useRef } from 'react'
import type { PDFDocumentLoadingTask, PDFPageProxy } from 'pdfjs-dist'
import { installPromiseWithResolvers } from '../resume-tailoring/promise-with-resolvers'

/**
 * Draws each page of the PDF, then reports how many there are. Collapsed, a narrow screen shows the first page only;
 * expanding moves focus to the second page, as the action that revealed it disappears.
 */
export function ResumePdfPages({ bytes, collapsed, onReady, onFailure, pageLabel }: Readonly<{
  bytes: Uint8Array; collapsed: boolean; onReady: (pageCount: number) => void; onFailure: () => void; pageLabel: string
}>) {
  const container = useRef<HTMLDivElement>(null)
  const wasCollapsed = useRef(collapsed)
  useEffect(() => {
    const expanded = wasCollapsed.current && !collapsed
    wasCollapsed.current = collapsed
    const second = container.current?.children.item(1)
    if (!expanded || !(second instanceof HTMLElement)) return
    second.tabIndex = -1
    second.focus()
  }, [collapsed])
  useEffect(() => {
    const host = container.current
    if (host === null) return
    const controller = new AbortController()
    const isAborted = () => controller.signal.aborted
    let loading: PDFDocumentLoadingTask | undefined
    const render = async () => {
      installPromiseWithResolvers()
      const [pdfReader, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'),
        import('../resume-tailoring/source-document-pdf-worker?worker&url')])
      pdfReader.GlobalWorkerOptions.workerSrc = worker.default
      if (isAborted()) return
      loading = pdfReader.getDocument({ data: bytes.slice() })
      const pdf = await loading.promise
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (isAborted()) return
        const page = await pdf.getPage(pageNumber)
        await renderPreviewPage({ host, page, label: `${pageLabel} ${String(pageNumber)} / ${String(pdf.numPages)}` })
      }
      if (!isAborted()) onReady(pdf.numPages)
    }
    void render().catch(() => { if (!isAborted()) onFailure() })
    return () => { controller.abort(); void loading?.destroy().catch(() => undefined); host.replaceChildren() }
  }, [bytes, onReady, onFailure, pageLabel])
  return <div ref={container} className="resume-pdf-pages" data-collapsed={collapsed || undefined} />
}

async function renderPreviewPage({ host, page, label }: Readonly<{
  host: HTMLDivElement; page: PDFPageProxy; label: string
}>) {
  const figure = document.createElement('figure')
  const caption = document.createElement('figcaption')
  caption.textContent = label
  const canvas = document.createElement('canvas')
  canvas.setAttribute('aria-hidden', 'true')
  const viewport = page.getViewport({ scale: 1.5 })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const text = document.createElement('p')
  text.className = 'resume-page-accessible-text'
  text.textContent = (await page.getTextContent()).items.flatMap((item) => 'str' in item ? [item.str] : []).join(' ')
  await page.render({ canvas, viewport }).promise
  figure.append(caption, canvas, text)
  host.append(figure)
}
