import { prepareTailoredResumeDocument } from '@resume-tailoring/application/tailored-resume-document'
import type { TailoredResumeDocument } from '@resume-tailoring/application/tailored-resume-document'
import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'

import type { Localization } from '../localization/localization'
import { createBrowserLayoutMeasurer } from './tailored-resume-browser-layout'
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
type PreviewState =
  | Readonly<{ status: 'preparing' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; value: PreparedPreview }>
type PreparedPreview = NonNullable<Awaited<ReturnType<typeof preparePreview>>>
type OutcomeQuestionProps<TAssessment extends string> = Readonly<{
  choices: readonly (readonly [TAssessment, Parameters<Localization['translate']>[0]])[]
  localization: Localization
  onSelect: (assessment: TAssessment) => void
  question: string
  selected: TAssessment | null
}>

export function TailoredResumePreview({ candidateSession, localization }: PreviewProps) {
  const [photo, setPhoto] = useState<PhotoState>({ status: 'empty' })
  const resumeLocale = readTailoredResumeLocale({
    candidateSession,
    fallbackLocale: localization.locale,
  })
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' })
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'preparing' })
  useEffect(() => {
    const abortController = new AbortController()
    setPreviewState({ status: 'preparing' })
    void preparePreview({ locale: resumeLocale, photo, view: candidateSession.view })
      .then((preview) => {
        if (abortController.signal.aborted) return
        setPreviewState(preview === null
          ? { status: 'failed' }
          : { status: 'ready', value: preview })
      })
    return () => { abortController.abort() }
  }, [candidateSession.view, photo, resumeLocale])
  if (previewState.status === 'preparing') {
    return <p role="status">{localization.translate('resumePreview.preparing')}</p>
  }
  if (previewState.status === 'failed') {
    return <p role="alert">{localization.translate('resumePreview.invalid')}</p>
  }
  const preview = previewState.value
  return (
    <section className="resume-preview-panel" aria-labelledby="resume-preview-title">
      <ResumePreviewHeader localization={localization} omittedClaimCount={preview.omittedClaimCount} />
      <iframe className="resume-preview-frame" srcDoc={preview.html}
        title={localization.translate('resumePreview.frameTitle')} />
      <PhotoControls {...{
        localization, photo, setPhoto,
      }} />
      <OutcomeFeedback {...{ candidateSession, localization }} />
      <ExportControls {...{ exportState, localization }} onExport={() => {
        void exportPreview({ candidateSession, preview, setExportState })
      }} />
    </section>
  )
}

function readTailoredResumeLocale({ candidateSession, fallbackLocale }: Readonly<{
  candidateSession: CandidateSessionController
  fallbackLocale: Localization['locale']
}>) {
  if (candidateSession.view.status !== 'ready') return fallbackLocale
  return candidateSession.view.tailoredResume?.locale ?? fallbackLocale
}

function OutcomeFeedback({ candidateSession, localization }: PreviewProps) {
  return (
    <section aria-labelledby="resume-outcome-title" className="resume-outcome-panel">
      <h4 id="resume-outcome-title" tabIndex={-1}>
        {localization.translate('resumePreview.outcomeSection')}
      </h4>
      <div className="resume-outcome-feedback">
        <FidelityQuestion {...{ candidateSession, localization }} />
        <RelevanceQuestion {...{ candidateSession, localization }} />
      </div>
    </section>
  )
}

function FidelityQuestion({ candidateSession, localization }: PreviewProps) {
  const fidelity = readOutcomeFeedback({ candidateSession })?.fidelity ?? null
  return <OutcomeQuestion choices={fidelityChoices}
    question={localization.translate('resumePreview.fidelityQuestion')}
    selected={fidelity} onSelect={(assessment) => {
      void candidateSession.rateTailoredResumeFidelity({ assessment })
    }} localization={localization} />
}

function RelevanceQuestion({ candidateSession, localization }: PreviewProps) {
  const relevance = readOutcomeFeedback({ candidateSession })?.relevance ?? null
  return <OutcomeQuestion choices={relevanceChoices}
    question={localization.translate('resumePreview.relevanceQuestion')}
    selected={relevance} onSelect={(assessment) => {
      void candidateSession.rateTailoredResumeRelevance({ assessment })
    }} localization={localization} />
}

function readOutcomeFeedback({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  return candidateSession.view.status === 'ready'
    ? candidateSession.view.outcomeFeedback : undefined
}

function OutcomeQuestion<TAssessment extends string>({
  choices,
  localization,
  onSelect,
  question,
  selected,
}: OutcomeQuestionProps<TAssessment>) {
  return (
    <fieldset>
      <legend>{question}</legend>
      {choices.map(([assessment, label]) => (
        <button aria-pressed={selected === assessment}
          disabled={selected !== null} key={assessment}
          onClick={() => { onSelect(assessment) }} type="button">
          {localization.translate(label)}
        </button>
      ))}
    </fieldset>
  )
}

async function preparePreview({ locale, photo, view }: Readonly<{
  locale: Localization['locale']
  photo: PhotoState
  view: CandidateSessionController['view']
}>) {
  const previewSource = readPreviewSource({ view })
  if (previewSource === null) return null
  const photoDataUrl = photo.status === 'included' ? photo.dataUrl : undefined
  const presentation = createPresentation({ locale, photoDataUrl, previewSource })
  const layoutMeasurer = createBrowserLayoutMeasurer({ presentation })
  const result = await prepareTailoredResumeDocument({
    inputs: previewSource.source, layoutMeasurer,
  })
  if (!result.ok || result.value.items.length === 0) return null
  return createPreview({ document: result.value, presentation, previewSource })
}

function readPreviewSource({ view }: Readonly<{ view: CandidateSessionController['view'] }>) {
  if (view.status !== 'ready' || view.sourceProfile === undefined
    || view.jobPosting === undefined || view.matchAnalysis === undefined
    || view.tailoredResume === undefined) return null
  return {
    contactItems: readContactItems({ sourceProfile: view.sourceProfile }),
    jobPostingContent: view.jobPosting.outgoingContent,
    targetRole: view.jobPosting.targetRole ?? null,
    source: {
      claims: view.tailoredResume.claims,
      evidence: view.matchAnalysis.evidence,
      requirements: view.jobPosting.requirements.map(({ classification, id }) => ({
        classification, id,
      })),
      verifiedFacts: view.sourceProfile.facts
        .filter(({ status }) => status === 'verified')
        .map(({ id, kind, value }) => ({ id, kind, value })),
    },
  }
}

function createPresentation({ locale, photoDataUrl, previewSource }: Readonly<{
  locale: Localization['locale']
  photoDataUrl?: string
  previewSource: NonNullable<ReturnType<typeof readPreviewSource>>
}>) {
  return {
    contactItems: previewSource.contactItems,
    locale,
    targetRole: previewSource.targetRole,
    ...(photoDataUrl === undefined ? {} : { photoDataUrl }),
  }
}

function createPreview({ document, presentation, previewSource }: Readonly<{
  document: TailoredResumeDocument
  presentation: ReturnType<typeof createPresentation>
  previewSource: NonNullable<ReturnType<typeof readPreviewSource>>
}>) {
  return {
    exportInputs: {
      ...presentation,
      jobPostingContent: previewSource.jobPostingContent,
      source: previewSource.source,
    },
    html: renderTailoredResumeHtml({ ...presentation, document }),
    omittedClaimCount: document.omittedClaimCount,
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
    <section aria-labelledby="resume-photo-title" className="resume-photo-controls">
      <h4 id="resume-photo-title" tabIndex={-1}>
        {localization.translate('resumePreview.photoSection')}
      </h4>
      <PhotoInput {...{ localization, photo, setPhoto }} />
      <PhotoFeedback {...{ localization, photo }} />
      <p>{localization.translate('resumePreview.photoPrivacy')}</p>
    </section>
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
    <section aria-labelledby="resume-export-title" className="resume-export-controls">
      <h4 id="resume-export-title" tabIndex={-1}>
        {localization.translate('resumePreview.exportSection')}
      </h4>
      <button className="primary-action compact-action" disabled={exportState.status === 'exporting'}
        onClick={onExport} type="button">
        {localization.translate(exportState.status === 'exporting'
          ? 'resumePreview.exporting' : 'resumePreview.download')}
      </button>
      <p>{localization.translate('resumePreview.controlNotice')}</p>
      <ExportFeedback {...{ exportState, localization }} />
    </section>
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

async function exportPreview({ candidateSession, preview, setExportState }: Readonly<{
  candidateSession: CandidateSessionController
  preview: PreparedPreview
  setExportState: (state: ExportState) => void
}>) {
  setExportState({ status: 'exporting' })
  const result = await exportTailoredResumePdf({ inputs: preview.exportInputs })
  if (!result.ok) {
    setExportState({ status: 'failed', failureType: result.error.type })
    return
  }
  downloadPdf({ pdf: result.value })
  await candidateSession.recordTailoredResumeDownload()
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
const fidelityChoices = [
  ['faithful', 'resumePreview.fidelityFaithful'],
  ['needs-correction', 'resumePreview.fidelityCorrection'],
] as const
const relevanceChoices = [
  ['relevant', 'resumePreview.relevanceRelevant'],
  ['needs-improvement', 'resumePreview.relevanceImprovement'],
] as const
