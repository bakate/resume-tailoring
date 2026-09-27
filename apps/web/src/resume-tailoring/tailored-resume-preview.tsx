import { prepareTailoredResumeDocument } from '@resume-tailoring/application/tailored-resume-document'
import { useState } from 'react'
import type { ChangeEvent } from 'react'

import type { Localization } from '../localization/localization'
import { exportTailoredResumePdf } from './tailored-resume-export'
import { renderTailoredResumeHtml } from './tailored-resume-html'
import type { ResumeContactItem } from './tailored-resume-html'
import type { CandidateSessionController } from './use-candidate-session'

type PreviewProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>
type PhotoState = Readonly<{ dataUrl: string; name: string }>
type ExportState =
  | Readonly<{ status: 'idle' | 'exporting' | 'downloaded' }>
  | Readonly<{ status: 'failed'; failureType: BrowserResumePdfFailureType }>

export function TailoredResumePreview({ candidateSession, localization }: PreviewProps) {
  const [photo, setPhoto] = useState<PhotoState | null>(null)
  const [photoIncluded, setPhotoIncluded] = useState(false)
  const [photoFailure, setPhotoFailure] = useState(false)
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const preview = preparePreview({ candidateSession, localization, photo, photoIncluded })
  if (preview === null) return <p role="alert">{localization.translate('resumePreview.invalid')}</p>
  return (
    <section className="resume-preview-panel" aria-labelledby="resume-preview-title">
      <ResumePreviewHeader localization={localization} omittedClaimCount={preview.omittedClaimCount} />
      <iframe className="resume-preview-frame" srcDoc={preview.html}
        title={localization.translate('resumePreview.frameTitle')} />
      <PhotoControls {...{
        localization, photo, photoFailure, photoIncluded, setPhoto, setPhotoFailure, setPhotoIncluded,
      }} />
      <ExportControls {...{ exportState, localization }} onExport={() => {
        void exportPreview({ preview, setExportState })
      }} />
    </section>
  )
}

function preparePreview({ candidateSession, localization, photo, photoIncluded }: PreviewProps & Readonly<{
  photo: PhotoState | null
  photoIncluded: boolean
}>) {
  const { view } = candidateSession
  if (view.status !== 'ready' || view.sourceProfile === undefined
    || view.jobPosting === undefined || view.matchAnalysis === undefined
    || view.tailoredResume === undefined) return null
  const document = prepareTailoredResumeDocument({
    claims: view.tailoredResume.claims,
    facts: view.sourceProfile.facts,
    matchAnalysis: view.matchAnalysis,
    requirements: view.jobPosting.requirements,
  })
  if (document === null || document.items.length === 0) return null
  const contactItems = readContactItems({ sourceProfile: view.sourceProfile })
  const photoDataUrl = photoIncluded && photo !== null ? photo.dataUrl : undefined
  return {
    contactItems,
    document,
    html: renderTailoredResumeHtml({ contactItems, document, locale: localization.locale, photoDataUrl }),
    locale: localization.locale,
    omittedClaimCount: document.omittedClaimCount,
    ...(photoDataUrl === undefined ? {} : { photoDataUrl }),
  }
}

function ResumePreviewHeader({ localization, omittedClaimCount }: Readonly<{
  localization: Localization
  omittedClaimCount: number
}>) {
  return (
    <header className="resume-preview-heading">
      <div>
        <h3 id="resume-preview-title">{localization.translate('resumePreview.title')}</h3>
        <p>{localization.translate('resumePreview.description')}</p>
      </div>
      {omittedClaimCount === 0 ? null : (
        <p className="match-warning" role="status">
          {localization.translate('resumePreview.reduced')}
        </p>
      )}
    </header>
  )
}

function PhotoControls({
  localization,
  photo,
  photoFailure,
  photoIncluded,
  setPhoto,
  setPhotoFailure,
  setPhotoIncluded,
}: Readonly<{
  localization: Localization
  photo: PhotoState | null
  photoFailure: boolean
  photoIncluded: boolean
  setPhoto: (photo: PhotoState | null) => void
  setPhotoFailure: (failed: boolean) => void
  setPhotoIncluded: (included: boolean) => void
}>) {
  return (
    <div className="resume-photo-controls">
      <label htmlFor="candidate-photo">{localization.translate('resumePreview.photoLabel')}</label>
      <input id="candidate-photo" accept="image/jpeg,image/png,image/webp" type="file"
        onChange={(event) => void selectPhoto({ event, setPhoto, setPhotoFailure, setPhotoIncluded })} />
      <label className="resume-photo-choice">
        <input checked={photoIncluded} disabled={photo === null} type="checkbox"
          onChange={(event) => { setPhotoIncluded(event.target.checked) }} />
        {localization.translate('resumePreview.photoInclude')}
      </label>
      {photo === null ? null : <p>{photo.name}</p>}
      {photoFailure ? <p className="failure-message" role="alert">
        {localization.translate('resumePreview.photoFailure')}
      </p> : null}
      <p>{localization.translate('resumePreview.photoPrivacy')}</p>
    </div>
  )
}

function ExportControls({ exportState, localization, onExport }: Readonly<{
  exportState: ExportState
  localization: Localization
  onExport: () => void
}>) {
  return (
    <div className="resume-export-controls">
      <button className="primary-action compact-action" disabled={exportState.status === 'exporting'}
        onClick={onExport} type="button">
        {localization.translate(exportState.status === 'exporting'
          ? 'resumePreview.exporting' : 'resumePreview.download')}
      </button>
      <p>{localization.translate('resumePreview.controlNotice')}</p>
      {exportState.status === 'failed' ? (
        <p className="failure-message" role="alert">
          {localization.translate(readPdfFailureMessageKey(exportState.failureType))}
        </p>
      ) : null}
      {exportState.status === 'downloaded' ? (
        <p className="export-success" role="status">
          {localization.translate('resumePreview.downloaded')}
        </p>
      ) : null}
    </div>
  )
}

async function selectPhoto({ event, setPhoto, setPhotoFailure, setPhotoIncluded }: Readonly<{
  event: ChangeEvent<HTMLInputElement>
  setPhoto: (photo: PhotoState | null) => void
  setPhotoFailure: (failed: boolean) => void
  setPhotoIncluded: (included: boolean) => void
}>) {
  const [file] = event.target.files ?? []
  if (file === undefined) return
  const result = await readPrivacySafePhoto({ file })
  setPhotoFailure(!result.ok)
  setPhoto(result.ok ? result.value : null)
  setPhotoIncluded(false)
}

async function readPrivacySafePhoto({ file }: Readonly<{ file: File }>): Promise<
  | Readonly<{ ok: true; value: PhotoState }>
  | Readonly<{ ok: false }>
> {
  if (!allowedPhotoTypes.has(file.type) || file.size > maximumPhotoBytes) return { ok: false }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string'
        ? { ok: true, value: { dataUrl: reader.result, name: file.name } }
        : { ok: false })
    })
    reader.addEventListener('error', () => { resolve({ ok: false }) })
    reader.readAsDataURL(file)
  })
}

async function exportPreview({ preview, setExportState }: Readonly<{
  preview: NonNullable<ReturnType<typeof preparePreview>>
  setExportState: (state: ExportState) => void
}>) {
  setExportState({ status: 'exporting' })
  const result = await exportTailoredResumePdf({ inputs: preview })
  if (!result.ok) {
    setExportState({ status: 'failed', failureType: result.error.type })
    return
  }
  downloadPdf({ pdf: result.value })
  setExportState({ status: 'downloaded' })
}

function downloadPdf({ pdf }: Readonly<{ pdf: Blob }>) {
  const downloadUrl = URL.createObjectURL(pdf)
  const downloadLink = document.createElement('a')
  downloadLink.href = downloadUrl
  downloadLink.download = 'tailored-resume.pdf'
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => { URL.revokeObjectURL(downloadUrl) }, 0)
}

function readContactItems({ sourceProfile }: Readonly<{
  sourceProfile: Extract<CandidateSessionController['view'], { readonly status: 'ready' }>['sourceProfile']
}>) {
  if (sourceProfile === undefined) return []
  return sourceProfile.detectedSensitiveContent.flatMap(({ kind, value }) =>
    isContactKind(kind) ? [{ kind, value } satisfies ResumeContactItem] : [])
}

function isContactKind(kind: string): kind is ResumeContactItem['kind'] {
  return kind === 'address' || kind === 'email' || kind === 'phone' || kind === 'url'
}

function readPdfFailureMessageKey(failureType: BrowserResumePdfFailureType) {
  if (failureType === 'resume-pdf-overflow') return 'resumePreview.overflowFailure'
  if (failureType === 'resume-pdf-content-mismatch') return 'resumePreview.contentFailure'
  if (failureType === 'resume-pdf-fonts-not-embedded') return 'resumePreview.fontFailure'
  if (failureType === 'resume-pdf-page-count-invalid') return 'resumePreview.pageFailure'
  if (failureType === 'resume-pdf-request-invalid') return 'resumePreview.requestFailure'
  return 'resumePreview.renderFailure'
}

type BrowserResumePdfFailureType = Exclude<
  Awaited<ReturnType<typeof exportTailoredResumePdf>>,
  { readonly ok: true }
>['error']['type']

const allowedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumPhotoBytes = 2_000_000
