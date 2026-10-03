import { useEffect, useMemo, useRef, useState } from 'react'
import type { ResumePhoto, ResumeRenderInput, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'

export type ResumePreviewProps = Readonly<{
  document: TailoredResume
  enabled?: boolean
  paused: boolean
  photo: ReturnType<typeof useResumePhoto>
  renderDocument: (request: ResumeRenderInput) => Promise<ResumeRenderResult>
  unsupportedFieldIds: readonly string[]
  /** Offered as the primary action only while the current assessment reports an overflow. */
  condensation?: Readonly<{ label: string; disabled: boolean; propose: () => void }>
  onDownload: () => void
  onIdentityChange: (identity: TailoredResume['identity']) => void
}>

type PreviewInput = Omit<ResumePreviewProps, 'condensation' | 'onDownload' | 'onIdentityChange'> & Readonly<{
  attempt: number
}>

export function useRenderedResume({ document, renderDocument, unsupportedFieldIds, attempt, photo, enabled: requested = true, paused }: PreviewInput) {
  const photoDataUrl = photo.ready ? photo.dataUrl : undefined
  const renderKey = JSON.stringify({ document, unsupportedFieldIds, photoDataUrl, attempt })
  const request = useMemo<ResumeRenderInput>(() => ({ document, unsupportedFieldIds, photoDataUrl }), [renderKey])
  const [rendered, setRendered] = useState<Readonly<{ renderKey: string; result: ResumeRenderResult }> | null>(null)
  const enabled = requested && photo.ready && !photo.failed
  const renderDue = enabled && !paused && rendered?.renderKey !== renderKey
  useEffect(() => {
    if (!renderDue) return
    let active = true
    const timer = window.setTimeout(() => { void renderDocument(request).then((result) => {
      if (active) setRendered({ renderKey, result })
    }) }, 300)
    return () => { active = false; window.clearTimeout(timer) }
  }, [request, renderKey, renderDocument, renderDue])
  const current = paused || (enabled && rendered?.renderKey === renderKey) ? rendered?.result ?? null : null
  return { request, current }
}

/**
 * The photo lives in the Candidate Session, so it survives reloads and navigation and is deleted with the session
 * (ADR-0002). A chosen file is only stored once it reads as an accepted image; until then the preview waits.
 */
export function useResumePhoto({ photo, onChange }: Readonly<{
  photo: ResumePhoto | null; onChange: (photo: ResumePhoto | null) => void
}>) {
  const [selection, setSelection] = useState<Readonly<{ status: 'reading' | 'failed'; name: string }> | null>(null)
  const latest = useRef(0)
  const select = (file: File | null) => {
    const attempt = latest.current + 1
    latest.current = attempt
    if (file === null) { setSelection(null); onChange(null); return }
    setSelection({ status: 'reading', name: file.name })
    void readPhoto({ file }).then((dataUrl) => {
      if (latest.current !== attempt) return
      if (dataUrl === null) { setSelection({ status: 'failed', name: file.name }); return }
      setSelection(null)
      onChange({ dataUrl, name: file.name })
    })
  }
  return { name: selection?.name ?? photo?.name ?? null, select, ready: selection?.status !== 'reading',
    dataUrl: photo?.dataUrl, failed: selection?.status === 'failed' }
}

async function readPhoto({ file }: Readonly<{ file: File | null }>): Promise<string | null> {
  if (file === null || file.size > 1_000_000 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return null
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => { resolve(typeof reader.result === 'string' ? reader.result : null) }
    reader.onerror = () => { resolve(null) }
    reader.readAsDataURL(file)
  })
}
