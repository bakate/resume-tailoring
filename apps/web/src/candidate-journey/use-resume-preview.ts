import { useEffect, useMemo, useState } from 'react'
import type { ResumeRenderInput, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'

export type ResumePreviewProps = Readonly<{
  document: TailoredResume
  enabled?: boolean
  paused: boolean
  photo: ReturnType<typeof useResumePhoto>
  renderDocument: (request: ResumeRenderInput) => Promise<ResumeRenderResult>
  unsupportedFieldIds: readonly string[]
  onDownload: () => void
}>

type PreviewInput = Omit<ResumePreviewProps, 'onDownload'> & Readonly<{
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

export function useResumePhoto() {
  const [file, setFile] = useState<File | null>(null)
  const [photo, setPhoto] = useState<Readonly<{ file: File | null; dataUrl: string | null }>>({ file: null, dataUrl: null })
  useEffect(() => {
    let active = true
    void readPhoto({ file }).then((dataUrl) => { if (active) setPhoto({ file, dataUrl }) })
    return () => { active = false }
  }, [file])
  const ready = photo.file === file
  return { file, select: setFile, ready, dataUrl: photo.dataUrl ?? undefined,
    failed: ready && file !== null && photo.dataUrl === null }
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
