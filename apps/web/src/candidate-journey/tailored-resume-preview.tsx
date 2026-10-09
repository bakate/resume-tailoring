import { Avatar, Button, FileButton, Group, List, Stack, Text, TextInput } from '@mantine/core'
import { IconDownload, IconEye } from '@tabler/icons-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { isCopiedFromSource } from '@resume-tailoring/application/candidate-journey'
import type { ResumeExportBlocker, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import { FailureExplanation, RecoveryAction } from './failure-recovery'
import { renderTailoredResumeDocument } from './tailored-resume-document'
import { ResumePdfPages } from './resume-pdf-pages'
import { CopiedNotice } from './copied-notice'
import { fitsKeys, readPageBudgetStatus } from './page-budget-status'
import type { PageBudgetStatus } from './page-budget-status'
import { StatusMessage } from './status-message'
import { describeOverflowReduction } from '../localization/overflow-reduction-summary'
import { useRenderedResume } from './use-resume-preview'
import type { ResumePreviewProps } from './use-resume-preview'
import './resume-preview.css'

type CandidateNameDraft = ReturnType<typeof useCandidateNameDraft>

export function TailoredResumePreview(props: ResumePreviewProps) {
  const { localization, photo } = props
  const [attempt, setAttempt] = useState(0)
  const { current } = useRenderedResume({ ...props, attempt, photo })
  const name = useCandidateNameDraft({ identity: props.document.identity, onCommit: props.onIdentityChange })
  const onRetry = () => { setAttempt((value) => value + 1) }
  const { pages, status, download, missingName } = useResumeReviewParts({ ...props, current, onRetry })
  // One layout for every preview state: a render never remounts the rail, so focus and the open disclosures stay put.
  const editing = props.editor !== undefined && props.editor !== null
  return <section aria-label={localization.translate('resumePreview.title')} className="resume-review-layout" data-editing={editing || undefined}>
    <div className="resume-review-document">{pages}{props.children}</div>
    <div className="resume-review-rail">
      {/* The status explains Download, so it travels with it, in the bottom bar on a phone. */}
      <div className="resume-review-primary">
        {status}
        <ResumeDownload {...download} edit={props.actions.edit} localization={localization} onDownload={props.onDownload}
          purpose={props.document.purpose} />
      </div>
      {editing ? props.editor : <>
        {/* Where the Match Analysis summary goes, under the primary actions. */}
        <div className="resume-review-match-summary" />
        {props.actions.secondary}
        <CandidateNameField identity={props.document.identity} explain={missingName} errorId={download.explainedBy('name')}
          localization={localization} name={name} />
        <PhotoPicker photo={photo} localization={localization} disabled={props.enabled === false} />
      </>}
    </div>
  </section>
}

/** What the current render shows: the pages, the rail's status line, Download's state and whether the name is missing. */
type ResumeReviewParts = Readonly<{
  pages: ReactNode; status: ReactNode; missingName: boolean
  download: Readonly<{
    bytes: Uint8Array | null; revision: string | null
    /** Why the button is disabled: the element that says so, and the hint to show beside it when nothing else does. */
    explanation: Readonly<{ id: string; hint: string | null }> | null
    explainedBy: (source: DownloadExplanation['source']) => string | undefined
  }>
}>

/**
 * Derives each preview state from the current render. What the browser made of the pages is remembered per layout
 * revision, so a new render starts over without remounting anything.
 */
/** State that belongs to one layout revision: a new render reads the initial value again, without remounting anything. */
function useRevisionState<T>(revision: string | null, initial: T) {
  const [state, setState] = useState<Readonly<{ revision: string | null; value: T }>>({ revision, value: initial })
  const value = state.revision === revision ? state.value : initial
  const update = useCallback((next: (value: T) => T) => {
    setState((previous) => ({ revision, value: next(previous.revision === revision ? previous.value : initial) }))
  }, [revision, initial])
  return [value, update] as const
}

const pagesPending = { preview: 'pending', pageCount: 0, expanded: false } as const satisfies PagesShown
type PagesShown = Readonly<{ preview: 'pending' | 'ready' | 'failed'; pageCount: number; expanded: boolean }>

function useResumeReviewParts({ current, document, localization, onRetry, pageBudget, unsavedEdits, photo }: Readonly<
  Pick<ResumePreviewProps, 'document' | 'localization' | 'pageBudget' | 'unsavedEdits' | 'photo'>
  & { current: ResumeRenderResult | null; onRetry: () => void }>): ResumeReviewParts {
  const revision = current?.assessment.layout.revision ?? null
  const [{ preview, pageCount, expanded }, updatePages] = useRevisionState<PagesShown>(revision, pagesPending)
  const ready = useCallback((count: number) => { updatePages(() => ({ preview: 'ready', pageCount: count, expanded: false })) }, [updatePages])
  const failed = useCallback(() => { updatePages(() => ({ ...pagesPending, preview: 'failed' })) }, [updatePages])
  const explanationId = useId()
  // Without a PDF, the pending status or the render failure is what explains the disabled Download.
  const withoutPdf = { bytes: null, revision, explanation: { id: explanationId, hint: null }, explainedBy: () => undefined }
  if (current === null) return { pages: null, missingName: false, download: withoutPdf,
    status: <Text id={explanationId} role="status">{localization.translate(photo.failed ? 'resumePreview.photoInvalid' : 'resumePreview.pending')}</Text> }
  if (current.assessment.layout.status === 'unavailable') return { status: null, missingName: false, download: withoutPdf,
    pages: <RenderFailure id={explanationId} {...{ localization, onRetry }} failure={current.failure} /> }
  const eligibility = current.assessment.exportEligibility
  const bytes = eligibility.status === 'eligible' && preview === 'ready' && !unsavedEdits ? current.pdf : null
  const blocker = eligibility.status === 'blocked' ? readPrimaryBlocker({ reasons: eligibility.reasons }) : null
  const explanation = bytes !== null ? null : readDownloadExplanation({ blocker, localization, unsavedEdits, preview })
  const explainedBy = (source: DownloadExplanation['source']) => explanation?.source === source ? explanationId : undefined
  const budgetStatus = pageBudget === undefined ? null
    : readPageBudgetStatus({ layout: current.assessment.layout, overflowReduction: pageBudget.overflowReduction })
  // A phone shows the first page and collapses the others behind one action; a desktop shows them all.
  const collapsed = !expanded && pageCount > 1
  return {
    pages: <>
      {current.pdf === null ? null : <ResumePdfPages bytes={current.pdf} collapsed={collapsed} onReady={ready} onFailure={failed}
        pageLabel={localization.translate('resumePreview.page')} />}
      {collapsed ? <Button className="resume-pdf-pages-expand" variant="default" onClick={() => { updatePages((pages) => ({ ...pages, expanded: true })) }}>
        {localization.translate('resumePreview.showAllPages').replace('{pageCount}', String(pageCount))}</Button> : null}
      <CopiedExperiences {...{ document, localization }} />
      {preview === 'failed' ? <RenderFailure id={explainedBy('render-failure')} {...{ localization, onRetry }} failure={undefined} /> : null}
    </>,
    // The Page Budget status, or the reason a download is blocked and the action that unblocks it, heads the rail.
    status: blocker === 'overflow' || blocker === null || blocker === 'missing-identity'
      ? budgetStatus === null || pageBudget === undefined ? null
        : <PageBudget status={budgetStatus} id={explainedBy('blocker')} {...{ localization, pageBudget }} />
      : <StatusMessage tone="error" id={explainedBy('blocker')}>{localization.translate(`resumePreview.${blocker}`)}</StatusMessage>,
    download: { bytes, revision, explainedBy,
      explanation: explanation === null ? null : { id: explanationId, hint: explanation.hint } },
    missingName: blocker === 'missing-identity',
  }
}

/** The one Page Budget status of the current render; an overflow makes shortening the primary action. */
function PageBudget({ id, localization, pageBudget, status }: Readonly<{
  id?: string; localization: Localization; pageBudget: NonNullable<ResumePreviewProps['pageBudget']>; status: PageBudgetStatus
}>) {
  const { message } = status
  // A reduced status always counts some Hidden Content, so its summary is never empty.
  const text = message.kind === 'overflow'
    ? localization.translate('pageBudget.overflow').replace('{pageCount}', String(message.pageCount))
    : message.kind === 'reduced' ? describeOverflowReduction({ locale: localization.locale, ...message }) ?? ''
      : localization.translate(fitsKeys[message.pageCount])
  const action = status.action === 'shorten'
    ? <Button disabled={pageBudget.shortening.disabled} onClick={pageBudget.shortening.shorten}>{localization.translate('pageBudget.shorten')}</Button>
    : status.action === 'review-hidden' ? <Button variant="subtle" size="compact-sm" disabled={pageBudget.reviewHidden.disabled}
      leftSection={<IconEye aria-hidden="true" size={16} />} onClick={pageBudget.reviewHidden.open}>{localization.translate('resumeReview.reviewHidden')}</Button> : undefined
  return <StatusMessage tone={status.tone} id={id} action={action}>{text}</StatusMessage>
}

/**
 * The PDF pages are the exported document, so the notice for each experience copied from the Candidate's own wording
 * is listed beside them and never printed.
 */
function CopiedExperiences({ document, localization }: Readonly<{ document: TailoredResume; localization: Localization }>) {
  const copied = document.experiences.filter((experience) => isCopiedFromSource({ kind: 'experience', experience }))
  if (copied.length === 0) return null
  return <List aria-label={localization.translate('resumePreview.copiedExperiences')} listStyleType="none" spacing={4}>
    {copied.map(({ id, role, organization }) => <List.Item key={id}>
      <Text fw={600} size="sm">{[role?.text, organization?.text].filter(Boolean).join(' – ')}</Text>
      <CopiedNotice localization={localization} /></List.Item>)}
  </List>
}

/** Only one blocking message is shown: the one the Candidate should resolve first. */
function readPrimaryBlocker({ reasons }: Readonly<{ reasons: readonly ResumeExportBlocker[] }>) {
  return blockerPriority.find((reason) => reasons.includes(reason)) ?? null
}

const blockerPriority = ['unsupported-content', 'overflow', 'missing-identity',
  'missing-contact', 'stale-layout'] as const satisfies readonly ResumeExportBlocker[]

type DownloadExplanation = Readonly<{ source: 'blocker' | 'name' | 'render-failure'; hint: null } | { source: 'hint'; hint: string }>

/**
 * What says why the Download button is disabled, which the button is described by. A blocker or a failed preview
 * already explains itself on screen, a missing name beside its field; otherwise a hint beside the button does.
 */
function readDownloadExplanation({ blocker, localization, unsavedEdits, preview }: Readonly<{
  blocker: ReturnType<typeof readPrimaryBlocker>; localization: Localization; unsavedEdits: boolean; preview: 'pending' | 'ready' | 'failed'
}>): DownloadExplanation {
  if (blocker === 'missing-identity') return { source: 'name', hint: null }
  if (blocker !== null) return { source: 'blocker', hint: null }
  if (preview === 'failed') return { source: 'render-failure', hint: null }
  return { source: 'hint', hint: unsavedEdits ? localization.translate('resumePreview.unsaved') : localization.translate('resumePreview.pending') }
}

/**
 * The name being typed lives above the preview branches, so a render landing mid-typing keeps it. It commits on blur
 * or Enter, at most once per value, so typing never re-renders the PDF and the editor edits the same identity.
 */
function useCandidateNameDraft({ identity, onCommit }: Readonly<{
  identity: TailoredResume['identity']; onCommit: ResumePreviewProps['onIdentityChange']
}>) {
  const committed = identity?.value ?? ''
  const [draft, setDraft] = useState(committed)
  const submitted = useRef(committed)
  useEffect(() => { setDraft(committed); submitted.current = committed }, [committed])
  const commit = () => {
    const name = draft.trim()
    if (name === submitted.current.trim()) return
    submitted.current = name
    onCommit(name.length === 0 ? null : { kind: 'personal-information', value: name })
  }
  return { draft, setDraft, commit }
}

function CandidateNameField({ identity, errorId, explain, localization, name }: Readonly<{
  identity: TailoredResume['identity']; errorId?: string; explain: boolean; localization: Localization; name: CandidateNameDraft
}>) {
  return <TextInput label={localization.translate('resumePreview.fullName')} value={name.draft} autoComplete="name" errorProps={{ id: errorId }}
    description={identity?.origin === 'detected' ? localization.translate('resumePreview.detectedName') : undefined}
    error={explain && (identity?.value.trim() ?? '').length === 0 ? localization.translate('resumePreview.missing-identity') : undefined}
    onChange={(event) => { name.setDraft(event.currentTarget.value) }} onBlur={name.commit}
    onKeyDown={(event) => { if (event.key === 'Enter') name.commit() }} />
}

/** A photo picker that reads as one: the chosen photo's thumbnail, an explicit action and the accepted formats. */
function PhotoPicker({ disabled, localization, photo }: Readonly<{
  disabled: boolean; localization: Localization; photo: ResumePreviewProps['photo']
}>) {
  const chosen = photo.name !== null
  return <div role="group" aria-labelledby="resume-photo-label"><Stack gap={6}>
    <Text id="resume-photo-label" fw={600} size="sm">{localization.translate('resumePreview.photo')}</Text>
    <Group gap="md" wrap="nowrap">
      <Avatar src={photo.ready ? photo.dataUrl : undefined} alt="" radius="xl" size="lg" />
      <Stack gap={4}>
        <Group gap="xs">
          <FileButton accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={photo.select}>
            {(props) => <Button {...props} variant="default" size="xs">{chosen ? localization.translate('resumePreview.photoChange') : localization.translate('resumePreview.photoAdd')}</Button>}
          </FileButton>
          {chosen ? <Button variant="subtle" size="xs" disabled={disabled} onClick={() => { photo.select(null) }}>
            {localization.translate('resumePreview.photoRemove')}</Button> : null}
        </Group>
        <Text c={photo.failed ? 'danger.8' : 'dimmed'} role={photo.failed ? 'alert' : undefined} size="xs">
          {photo.failed ? localization.translate('resumePreview.photoInvalid') : photo.name ?? localization.translate('resumePreview.photoHint')}</Text>
      </Stack>
    </Group>
  </Stack></div>
}

/**
 * A render the renderer could not complete explains its Failure Cause and offers its Recovery. Pages the browser could
 * not display have no cause: retrying the preview renders them again.
 */
function RenderFailure({ failure, id, localization, onRetry }: Readonly<{
  failure: ResumeRenderResult['failure']; id?: string; localization: Localization; onRetry: () => void
}>) {
  return <Stack gap="sm" id={id} mt="md" role="alert">
    <Text c="danger.8">{localization.translate(failure === undefined ? 'failure.preview.pagesUnavailable' : 'failure.preview.layoutUnavailable')}</Text>
    {failure === undefined ? <Button onClick={onRetry}>{localization.translate('failure.preview.retry')}</Button> : <>
      <FailureExplanation cause={failure.cause} localization={localization} />
      <Group><RecoveryAction {...failure} {...{ localization, onRetry }} /></Group></>}
  </Stack>
}

/**
 * Download, with Edit beside it: the primary actions a phone keeps in a bottom bar. The outcome of a download belongs
 * to the revision it downloaded.
 */
function ResumeDownload({ bytes, edit, explanation, localization, onDownload, purpose, revision }: ResumeReviewParts['download'] & Readonly<{
  edit: ReactNode; localization: Localization; onDownload: () => void; purpose: TailoredResume['purpose']
}>) {
  const [download, setDownload] = useRevisionState<'idle' | 'failed' | 'handed-off'>(revision, 'idle')
  return <><div className="resume-review-primary-actions"><Button disabled={bytes === null} aria-describedby={explanation?.id}
    leftSection={<IconDownload aria-hidden="true" size={16} />} onClick={() => {
    if (bytes === null) return
    const handedOff = handOffResumePdf({ bytes, purpose })
    setDownload(() => handedOff ? 'handed-off' : 'failed')
    if (handedOff) onDownload()
  }}>{localization.translate('resumePreview.download')}</Button>{edit}</div>
    {explanation === null || explanation.hint === null ? null : <Text id={explanation.id} size="sm" c="dimmed">{explanation.hint}</Text>}
    {download === 'idle' ? null : <Text role={download === 'failed' ? 'alert' : 'status'}>
      {download === 'failed' ? localization.translate('failure.preview.download') : localization.translate('resumePreview.downloaded')}</Text>}
  </>
}

export function DocumentText({ document, localization }: Readonly<{ document: TailoredResume; localization: Localization }>) {
  return <details><summary>{localization.translate('resumePreview.textVersion')}</summary>
    <iframe className="tailored-resume-preview-frame" sandbox="" title={localization.translate('resumePreview.previewTitle')}
      srcDoc={renderTailoredResumeDocument({ tailoredResume: document })} />
  </details>
}

function handOffResumePdf({ bytes, purpose }: Readonly<{ bytes: Uint8Array; purpose: TailoredResume['purpose'] }>) {
  let url: string | undefined
  const link = window.document.createElement('a')
  try {
    url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }))
    link.href = url
    link.download = purpose === 'normalized' ? 'normalized-resume.pdf' : 'tailored-resume.pdf'
    window.document.body.append(link)
    link.click()
    return true
  } catch {
    return false
  } finally {
    link.remove()
    if (url !== undefined) { const releasedUrl = url; window.setTimeout(() => { URL.revokeObjectURL(releasedUrl) }, 30_000) }
  }
}
