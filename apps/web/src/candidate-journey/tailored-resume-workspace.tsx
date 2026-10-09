import { Button, CloseButton, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

import type { ResumeReviewOperation } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { useResumePhoto } from './use-resume-preview'
import type { ResumePreviewProps } from './use-resume-preview'
import { DocumentText, TailoredResumePreview } from './tailored-resume-preview'
import { JobMatchWorkspace } from './job-match-workspace'
import { renderTailoredResumeDocument } from './tailored-resume-document'
import { ResumeEditor } from './resume-editor'
import type { EditorTab } from './resume-editor'
import { ResumeOperationFailureAlert } from './failure-recovery'
import { fitsKeys } from './page-budget-status'

export type ResumeReviewController = ReturnType<typeof useCandidateJourney>
export type ResumeReviewProps = Readonly<{ candidateJourney: ResumeReviewController; localization: Localization }>

export function TailoredResumeWorkspace({ candidateJourney, localization, onChangeJobPosting }: ResumeReviewProps & Readonly<{
  onChangeJobPosting: () => void
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  return <ResumeReview {...{ candidateJourney, localization, onChangeJobPosting }} resume={view.resumeReview.draft.document} />
}

type ResumeDocumentProps = ResumeReviewProps & Readonly<{ resume: TailoredResume }>

/**
 * The preview beside a rail of actions: the Page Budget status and Download first, then Edit and the secondary actions.
 * On a desktop the editor opens in the rail, under Download, so the preview stays in view and follows each save.
 */
function ResumeReview(props: ResumeDocumentProps & Readonly<{ onChangeJobPosting: () => void }>) {
  const { view } = props.candidateJourney
  const photo = useResumePhoto({ photo: view.status === 'candidate-session-open' ? view.session.resumePhoto ?? null : null,
    onChange: props.candidateJourney.updateResumePhoto })
  const [proposalPhoto, setProposalPhoto] = useState<string | undefined>(undefined)
  const [editorTab, setEditorTab] = useState<EditorTab | null>(null)
  const [unsavedEdits, setUnsavedEdits] = useState(false)
  const editorOpened = editorTab !== null
  const besidePreview = useMediaQuery('(min-width: 62em)')
  const editButton = useRef<HTMLButtonElement>(null)
  const closeEditor = () => { setEditorTab(null); editButton.current?.focus() }
  const [downloadedRevision, setDownloadedRevision] = useState<string | null>(null)
  const revision = props.candidateJourney.view.status === 'candidate-session-open' ? props.candidateJourney.view.resumeReview?.draft.revision ?? null : null
  const { localization } = props
  const operations = useRetryableOperations()
  const shorteningAvailable = canCondense({ candidateJourney: props.candidateJourney, photo })
  /** Shortening and condensing measure the proposal with the photo the Candidate sees at that moment. */
  const withPhoto = (shorten: (request: Readonly<{ photoDataUrl?: string }>) => Promise<void>) => { operations.attempt(() => {
    setProposalPhoto(photo.dataUrl); void shorten({ photoDataUrl: photo.dataUrl }) }) }
  return <Paper aria-labelledby="tailored-resume-title" component="section"
    className="candidate-journey-workspace" p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg">
      <PreparationStatus {...props} />
      <div><Title id="tailored-resume-title" order={2}>{localization.translate('resumeReview.preview')}</Title><Text c="dimmed">{localization.translate('resumeReview.description')}</Text></div>
      <CurrentResumePreview {...props} {...{ unsavedEdits, photo }} onDownload={() => {
        props.candidateJourney.recordResumeDownload(); setDownloadedRevision(revision) }}
        pageBudget={{ overflowReduction: view.status === 'candidate-session-open' && view.resumeReview !== null
          ? view.resumeReview.recovery.overflowReduction : { achievements: 0, other: 0 },
        reviewHidden: { disabled: blocksResumeEditing(view), open: () => { setEditorTab('hidden') } },
        shortening: { disabled: !shorteningAvailable, shorten: () => { withPhoto(props.candidateJourney.shortenResume) } } }}
        actions={{
          edit: <Button ref={editButton} variant="default" disabled={blocksResumeEditing(view)}
            aria-expanded={besidePreview ? editorOpened : undefined} aria-controls={besidePreview && editorOpened ? 'resume-editor-panel' : undefined}
            onClick={() => { if (editorOpened) closeEditor(); else setEditorTab('contacts') }}>{localization.translate('resumeReview.edit')}</Button>,
          secondary: <>
            {downloadedRevision !== null && downloadedRevision === revision
              ? <UsabilityFeedback key={downloadedRevision} candidateJourney={props.candidateJourney} localization={props.localization} /> : null}
            <ReviewStatus {...props} onRetry={operations.retry} />
            {/* Shorter wording keeps every item: the alternative to shortening, offered while the resume overflows. */}
            {overflows(view) ? <Button variant="default" disabled={!shorteningAvailable}
              onClick={() => { withPhoto(props.candidateJourney.proposeResumeCondensation) }}>{localization.translate('resumeReview.condense')}</Button> : null}
            <Button variant="default" onClick={props.onChangeJobPosting}>{localization.translate('resumeReview.changeJobPosting')}</Button>
          </>,
        }}
        editor={besidePreview && editorTab !== null
          ? <ResumeEditorPanel {...props} {...{ editorTab, operations, closeEditor }} onUnsavedChange={setUnsavedEdits} /> : null}>
        <CondensationProposal {...props} photoDataUrl={photo.dataUrl}
          proposalLayoutCurrent={photo.ready && !photo.failed && proposalPhoto === photo.dataUrl} />
        <MatchAnalysisDisclosure {...props} />
        <DocumentText document={props.resume} localization={props.localization} />
      </CurrentResumePreview>
    </Stack>
    <ResumeEditorDialog {...props} {...{ operations }} editorTab={besidePreview ? null : editorTab}
      closeEditor={() => { setEditorTab(null) }} onUnsavedChange={setUnsavedEdits} />
  </Paper>
}

function PreparationStatus({ candidateJourney, localization, resume }: ResumeDocumentProps) {
  const { view } = candidateJourney
  return <>
    {view.status === 'candidate-session-open' && view.session.preparedResumeStatus === 'outdated'
      ? <Text c="danger.8" role="status">{localization.translate('combinedIntake.outdated')}</Text> : null}
    {resume.purpose === 'normalized' ? <Text fw={700}>{localization.translate('combinedIntake.normalizedReady')}</Text> : null}
  </>
}

/**
 * Remembers the last edit or proposal the Candidate started, so a failure's Recovery can run it again. Nothing is
 * remembered across a reload, where no failure is shown either.
 */
function useRetryableOperations() {
  const last = useRef<(() => void) | null>(null)
  return {
    attempt: (operation: () => void) => { last.current = operation; operation() },
    retry: () => { last.current?.() },
  }
}

export type RetryableOperations = ReturnType<typeof useRetryableOperations>

type EditorFrameProps = ResumeDocumentProps & Readonly<{
  closeEditor: () => void; operations: RetryableOperations; onUnsavedChange: (unsaved: boolean) => void
}>

/** Below a desktop width the preview has no room beside the editor, which opens as a sheet over it. */
function ResumeEditorDialog({ editorTab, ...props }: EditorFrameProps & Readonly<{ editorTab: EditorTab | null }>) {
  const fullScreen = useMediaQuery('(max-width: 48em)')
  return <Modal opened={editorTab !== null} onClose={props.closeEditor} title={props.localization.translate('resumeReview.edit')}
    fullScreen={fullScreen} size="xl" returnFocus closeButtonProps={{ 'aria-label': props.localization.translate('resumeReview.close') }}>
    <ResumeEditor {...props} initialTab={editorTab ?? 'contacts'} />
  </Modal>
}

/**
 * The editor beside the preview, in place of the rail's secondary actions. It takes focus when it opens; Escape or
 * its close button give focus back to Edit.
 */
function ResumeEditorPanel({ editorTab, ...props }: EditorFrameProps & Readonly<{ editorTab: EditorTab }>) {
  const title = useRef<HTMLHeadingElement>(null)
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { if (editorTab === 'contacts') title.current?.focus() }, [editorTab])
  useCloseOnEscape({ panel, close: props.closeEditor })
  return <section id="resume-editor-panel" ref={panel} className="resume-editor-panel" aria-labelledby="resume-editor-title">
    <Group justify="space-between" wrap="nowrap">
      <Title id="resume-editor-title" ref={title} tabIndex={-1} order={2} size="h3">{props.localization.translate('resumeReview.edit')}</Title>
      <CloseButton aria-label={props.localization.translate('resumeReview.close')} onClick={props.closeEditor} />
    </Group>
    {/* A new tab request, such as reviewing Hidden Content, opens the editor again where it was asked. */}
    <div className="resume-editor-body"><ResumeEditor key={editorTab} {...props} initialTab={editorTab} /></div>
  </section>
}

/**
 * Escape closes the panel from inside it, and from the page itself: hiding or restoring an item removes the button
 * that had focus, which leaves focus on the body.
 */
function useCloseOnEscape({ panel, close }: Readonly<{ panel: RefObject<HTMLElement | null>; close: () => void }>) {
  const latestClose = useRef(close)
  latestClose.current = close
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const focused = document.activeElement
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (focused !== null && focused !== document.body && panel.current?.contains(focused) !== true) return
      event.preventDefault(); latestClose.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [panel])
}

function overflows(view: ResumeReviewController['view']) {
  const review = view.status === 'candidate-session-open' ? view.resumeReview : null
  const layout = review?.assessment?.layout
  return layout?.status === 'overflow' && layout.revision === review?.draft.revision
}

/** A preview render is background work: disabling the button for it drops keyboard focus when the editor closes. */
function blocksResumeEditing(view: ResumeReviewController['view']) {
  return view.status === 'candidate-session-open' && view.operation !== null && view.operation !== 'rendering-resume-document'
}

function canCondense({ candidateJourney, photo }: Readonly<{
  candidateJourney: ResumeReviewController; photo: ReturnType<typeof useResumePhoto>
}>) {
  const { view } = candidateJourney
  return photo.ready && !photo.failed && view.status === 'candidate-session-open'
    && view.resumeReview?.operation === null && view.operation === null
}

function MatchAnalysisDisclosure({ candidateJourney, localization }: ResumeReviewProps) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const { sourceIntake, jobMatch } = view.preparationInputs
  if (sourceIntake === null || jobMatch === null) return null
  return <details><summary>{localization.translate('combinedIntake.analysis')}</summary>
    <JobMatchWorkspace {...{ candidateJourney, localization }} /></details>
}

function ReviewStatus({ candidateJourney, localization, onRetry }: ResumeReviewProps & Readonly<{ onRetry: () => void }>) {
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  if (review === null) return null
  // The Page Budget status sits under the Download button; this line only follows the operation in progress.
  const operationText = review.operation === null ? '' : localization.translate(operationKeys[review.operation])
  return <Stack gap="xs"><Text role="status" aria-live="polite">{operationText}</Text>
    {review.failure === null ? null : <ResumeOperationFailureAlert failure={review.failure} {...{ localization, onRetry }} />}
  </Stack>
}

const operationKeys = {
  'validating-section': 'resumeReview.validating',
  condensing: 'resumeReview.condensing',
  shortening: 'resumeReview.shortening',
  'assessing-layout': 'resumeReview.checking',
} as const satisfies Record<ResumeReviewOperation, Parameters<Localization['translate']>[0]>

function CondensationProposal({ candidateJourney, localization, resume, photoDataUrl, proposalLayoutCurrent }: Readonly<{
  candidateJourney: ResumeReviewController; localization: Localization; resume: TailoredResume
  photoDataUrl?: string; proposalLayoutCurrent: boolean
}>) {
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  const proposal = review?.proposal
  if (proposal === undefined || proposal === null) return null
  const decision = { proposalId: proposal.id, baseRevision: proposal.baseRevision }
  const proposedResume = { ...proposal.document, identity: resume.identity, contactDetails: resume.contactDetails }
  return <Paper p="md" withBorder><Stack>
    <Title order={3}>{localization.translate('resumeReview.proposal')}</Title><Text>{localization.translate('resumeReview.proposalDescription')}</Text>
    <ResumePreview resume={proposedResume} title={localization.translate('resumeReview.proposal')} photoDataUrl={photoDataUrl} />
    <Text>{!proposalLayoutCurrent ? localization.translate('resumeReview.unchecked')
      : proposal.layout.status === 'fits' ? localization.translate(fitsKeys[proposal.layout.pageCount])
        : proposal.layout.status === 'overflow' ? localization.translate('pageBudget.proposalOverflow')
          : localization.translate('failure.review.pageCountUnavailable')}</Text>
    <Group><Button disabled={review?.draft.revision !== proposal.baseRevision}
      onClick={() => { candidateJourney.acceptResumeCondensation(decision) }}>{localization.translate('resumeReview.accept')}</Button>
      <Button variant="default" onClick={() => { candidateJourney.rejectResumeCondensation(decision) }}>{localization.translate('resumeReview.reject')}</Button></Group>
  </Stack></Paper>
}

function ResumePreview({ resume, title, photoDataUrl }: Readonly<{ resume: TailoredResume; title: string; photoDataUrl?: string }>) {
  return <iframe className="tailored-resume-preview-frame" sandbox="" title={title}
    srcDoc={renderTailoredResumeDocument({ tailoredResume: resume, photoDataUrl })} />
}

function CurrentResumePreview({ actions, candidateJourney, children, editor, pageBudget, localization, resume, unsavedEdits, photo, onDownload }: ResumeDocumentProps & Pick<ResumePreviewProps, 'actions' | 'children' | 'editor'> & Readonly<{
  pageBudget: ResumePreviewProps['pageBudget']; unsavedEdits: boolean; photo: ReturnType<typeof useResumePhoto>; onDownload: () => void
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  const enabled = view.session.preparedResumeStatus !== 'outdated'
    && view.resumeReview.operation === null && (view.operation === null || view.operation === 'rendering-resume-document')
  return <TailoredResumePreview document={resume} localization={localization} enabled={enabled} unsavedEdits={unsavedEdits} photo={photo} editor={editor} pageBudget={pageBudget}
    unsupportedFieldIds={view.resumeReview.unsupportedFieldIds} renderDocument={candidateJourney.renderResumeDocument}
    onDownload={onDownload} actions={actions} onIdentityChange={(identity) => {
      candidateJourney.updateResumeContacts({ identity, contactDetails: resume.contactDetails }) }}>{children}</TailoredResumePreview>
}

function UsabilityFeedback({ candidateJourney, localization }: ResumeReviewProps) {
  const [recorded, setRecorded] = useState(false)
  const rate = (useful: boolean) => { candidateJourney.rateResumeUsefulness({ useful }); setRecorded(true) }
  if (recorded) return <Text role="status">{localization.translate('resumeReview.usabilityRecorded')}</Text>
  return <div role="group" aria-labelledby="resume-usability-question"><Stack gap="xs">
    <Text id="resume-usability-question" fw={600}>{localization.translate('resumeReview.usability')}</Text>
    <Group><Button variant="default" onClick={() => { rate(true) }}>{localization.translate('resumeReview.usable')}</Button>
      <Button variant="default" onClick={() => { rate(false) }}>{localization.translate('resumeReview.needsRewriting')}</Button></Group>
  </Stack></div>
}
