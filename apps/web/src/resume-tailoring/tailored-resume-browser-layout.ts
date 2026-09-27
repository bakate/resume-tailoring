import type {
  TailoredResumeDocument,
  TailoredResumeLayoutMeasurer,
} from '@resume-tailoring/application/tailored-resume-document'

import { renderTailoredResumeHtml } from './tailored-resume-html'
import type { TailoredResumeRenderInputs } from './tailored-resume-html'
import { hasTailoredResumeOverflow } from './tailored-resume-layout'

export function createBrowserLayoutMeasurer({
  presentation,
}: Readonly<{
  presentation: Omit<TailoredResumeRenderInputs, 'document'>
}>): TailoredResumeLayoutMeasurer {
  return {
    fits: ({ document: tailoredDocument }) => measureDocument({ presentation, tailoredDocument }),
  }
}

async function measureDocument({ presentation, tailoredDocument }: Readonly<{
  presentation: Omit<TailoredResumeRenderInputs, 'document'>
  tailoredDocument: TailoredResumeDocument
}>) {
  const frame = createMeasurementFrame()
  try {
    document.body.append(frame)
    const frameLoaded = waitForFrame({ frame })
    frame.srcdoc = renderTailoredResumeHtml({ ...presentation, document: tailoredDocument })
    const loaded = await frameLoaded
    if (!loaded) return { ok: false } as const
    const frameDocument = frame.contentDocument
    if (frameDocument === null) return { ok: false } as const
    await frameDocument.fonts.ready
    const resumePage = frameDocument.querySelector<HTMLElement>('.resume-page')
    return { ok: true, value: resumePage !== null && !hasTailoredResumeOverflow(resumePage) } as const
  } catch {
    return { ok: false } as const
  } finally {
    frame.remove()
  }
}

function createMeasurementFrame() {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = [
    'border:0',
    'height:297mm',
    'left:-10000px',
    'position:fixed',
    'visibility:hidden',
    'width:210mm',
  ].join(';')
  return frame
}

function waitForFrame({ frame }: Readonly<{ frame: HTMLIFrameElement }>) {
  return new Promise<boolean>((resolve) => {
    frame.addEventListener('load', () => { resolve(true) }, { once: true })
    frame.addEventListener('error', () => { resolve(false) }, { once: true })
  })
}
