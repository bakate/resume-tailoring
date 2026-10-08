import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { ResumePhoto, ResumeRenderInput, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { OverflowReductionCounts } from './page-budget-status'

export type ResumePreviewProps = Readonly<{
  document: TailoredResume
  /** The interface language; the document keeps its own resume language. */
  localization: Localization
  enabled?: boolean
  paused: boolean
  photo: ReturnType<typeof useResumePhoto>
  renderDocument: (request: ResumeRenderInput) => Promise<ResumeRenderResult>
  unsupportedFieldIds: readonly string[]
  /**
   * The Page Budget status under the Download button: what Overflow Reduction hid and the way to review it, or while
   * the current assessment reports an overflow, shortening as the primary action.
   */
  pageBudget?: Readonly<{
    overflowReduction: OverflowReductionCounts
    reviewHidden: Readonly<{ disabled: boolean; open: () => void }>
    shortening: Readonly<{ disabled: boolean; shorten: () => void }>
  }>
  onDownload: () => void
  onIdentityChange: (identity: TailoredResume['identity']) => void
  /**
   * The action rail beside the preview: Edit sits next to Download, which a phone keeps in a bottom bar; the secondary
   * actions follow the Match Analysis summary. `children` follow the pages in the document column.
   */
  actions: Readonly<{ edit: ReactNode; secondary: ReactNode }>
  children?: ReactNode
}>

type PreviewInput = Omit<ResumePreviewProps, 'pageBudget' | 'localization' | 'onDownload' | 'onIdentityChange' | 'actions' | 'children'> & Readonly<{
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
 * The photo lives in the Candidate Session, so it survives reloads and navigation and is deleted with the session.
 * A chosen file is only stored once it reads as an accepted image; until then the preview waits.
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
