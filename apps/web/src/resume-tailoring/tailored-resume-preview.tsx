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
type PhotoState =
  | Readonly<{ status: 'empty' | 'invalid' }>
  | Readonly<{ status: 'excluded'; dataUrl: string; name: string }>
  | Readonly<{ status: 'included'; dataUrl: string; name: string }>
type ExportState =
  | Readonly<{ status: 'idle' | 'exporting' | 'downloaded' }>
  | Readonly<{ status: 'failed'; failureType: BrowserResumePdfFailureType }>

export function TailoredResumePreview({ candidateSession, localization }: PreviewProps) {
  const [photo, setPhoto] = useState<PhotoState>({ status: 'empty' })
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const preview = preparePreview({ candidateSession, localization, photo })
  if (preview === null) return <p role="alert">{localization.translate('resumePreview.invalid')}</p>
  return (
    <section className="resume-preview-panel" aria-labelledby="resume-preview-title">
      <ResumePreviewHeader localization={localization} omittedClaimCount={preview.omittedClaimCount} />
      <iframe className="resume-preview-frame" srcDoc={preview.html}
        title={localization.translate('resumePreview.frameTitle')} />
      <PhotoControls {...{
        localization, photo, setPhoto,
      }} />
      <ExportControls {...{ exportState, localization }} onExport={() => {
        void exportPreview({ preview, setExportState })
      }} />
    </section>
  )
}

function preparePreview({ candidateSession, localization, photo }: PreviewProps & Readonly<{
  photo: PhotoState
}>) {
  const source = readPreviewSource({ candidateSession })
  if (source === null) return null
  const document = prepareTailoredResumeDocument(source)
  if (document === null || document.items.length === 0) return null
  return createPreview({ document, localization, photo, source })
}

function readPreviewSource({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const { view } = candidateSession
  if (view.status !== 'ready' || view.sourceProfile === undefined
    || view.jobPosting === undefined || view.matchAnalysis === undefined
    || view.tailoredResume === undefined) return null
  return {
    claims: view.tailoredResume.claims, facts: view.sourceProfile.facts,
    matchAnalysis: view.matchAnalysis, requirements: view.jobPosting.requirements,
    sourceProfile: view.sourceProfile,
  }
}

function createPreview({ document, localization, photo, source }: Readonly<{
  document: NonNullable<ReturnType<typeof prepareTailoredResumeDocument>>
  localization: Localization
  photo: PhotoState
  source: NonNullable<ReturnType<typeof readPreviewSource>>
}>) {
  const contactItems = readContactItems({ sourceProfile: source.sourceProfile })
  const photoDataUrl = photo.status === 'included' ? photo.dataUrl : undefined
  const retainedFactIds = new Set(document.items.flatMap(({ factIds }) => factIds))
  const verifiedFacts = source.facts
    .filter(({ id, status }) => status === 'verified' && retainedFactIds.has(id))
    .map(({ id, kind, value }) => ({ id, kind, value }))
  return {
    contactItems,
    document,
    html: renderTailoredResumeHtml({ contactItems, document, locale: localization.locale, photoDataUrl }),
    locale: localization.locale,
    omittedClaimCount: document.omittedClaimCount,
    validatedClaims: source.claims,
    verifiedFacts,
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
  setPhoto,
}: Readonly<{
  localization: Localization
  photo: PhotoState
  setPhoto: (photo: PhotoState) => void
}>) {
  return (
    <div className="resume-photo-controls">
      <PhotoInput {...{ localization, photo, setPhoto }} />
      <PhotoFeedback {...{ localization, photo }} />
      <p>{localization.translate('resumePreview.photoPrivacy')}</p>
    </div>
  )
}

function PhotoInput({ localization, photo, setPhoto }: Readonly<{
  localization: Localization
  photo: PhotoState
  setPhoto: (photo: PhotoState) => void
}>) {
  const hasPhoto = photo.status === 'excluded' || photo.status === 'included'
  return <>
    <label htmlFor="candidate-photo">{localization.translate('resumePreview.photoLabel')}</label>
    <input id="candidate-photo" accept="image/jpeg,image/png,image/webp" type="file"
      onChange={(event) => void selectPhoto({ event, setPhoto })} />
    <label className="resume-photo-choice">
      <input checked={photo.status === 'included'} disabled={!hasPhoto} type="checkbox"
        onChange={(event) => { setPhoto(changePhotoInclusion({
          photo,
          status: event.target.checked ? 'included' : 'excluded',
        })) }} />
      {localization.translate('resumePreview.photoInclude')}
    </label>
  </>
}

function PhotoFeedback({ localization, photo }: Readonly<{
  localization: Localization
  photo: PhotoState
}>) {
  if (photo.status === 'invalid') {
    return <p className="failure-message" role="alert">
      {localization.translate('resumePreview.photoFailure')}
    </p>
  }
  return photo.status === 'excluded' || photo.status === 'included' ? <p>{photo.name}</p> : null
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
      <ExportFeedback {...{ exportState, localization }} />
    </div>
  )
}

function ExportFeedback({ exportState, localization }: Readonly<{
  exportState: ExportState
  localization: Localization
}>) {
  if (exportState.status === 'failed') {
    return <p className="failure-message" role="alert">
      {localization.translate(readPdfFailureMessageKey(exportState.failureType))}
    </p>
  }
  return exportState.status === 'downloaded' ? (
    <p className="export-success" role="status">
      {localization.translate('resumePreview.downloaded')}
    </p>
  ) : null
}

async function selectPhoto({ event, setPhoto }: Readonly<{
  event: ChangeEvent<HTMLInputElement>
  setPhoto: (photo: PhotoState) => void
}>) {
  const [file] = event.target.files ?? []
  if (file === undefined) return
  const result = await readPrivacySafePhoto({ file })
  setPhoto(result.ok ? result.value : { status: 'invalid' })
}

async function readPrivacySafePhoto({ file }: Readonly<{ file: File }>): Promise<
  | Readonly<{ ok: true; value: Extract<PhotoState, { status: 'excluded' }> }>
  | Readonly<{ ok: false }>
> {
  if (!allowedPhotoTypes.has(file.type) || file.size > maximumPhotoBytes) return { ok: false }
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      resolve(typeof reader.result === 'string'
        ? { ok: true, value: { status: 'excluded', dataUrl: reader.result, name: file.name } }
        : { ok: false })
    })
    reader.addEventListener('error', () => { resolve({ ok: false }) })
    reader.readAsDataURL(file)
  })
}

function changePhotoInclusion({ photo, status }: Readonly<{
  photo: PhotoState
  status: 'excluded' | 'included'
}>): PhotoState {
  if (photo.status !== 'excluded' && photo.status !== 'included') return photo
  return { ...photo, status }
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
  if (failureType === 'resume-pdf-provenance-invalid') return 'resumePreview.provenanceFailure'
  if (failureType === 'resume-pdf-validation-unavailable') return 'resumePreview.validationFailure'
  return 'resumePreview.renderFailure'
}

type BrowserResumePdfFailureType = Exclude<
  Awaited<ReturnType<typeof exportTailoredResumePdf>>,
  { readonly ok: true }
>['error']['type']

const allowedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maximumPhotoBytes = 2_000_000
