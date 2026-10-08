import { Button, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useRef, useState } from 'react'

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
import { describeOverflowReduction, resumeReviewCopy } from './resume-review-copy'
import type { ResumeReviewCopy } from './resume-review-copy'

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

/** Preview and Download first, then the name, then the secondary actions. */
function ResumeReview(props: ResumeDocumentProps & Readonly<{ onChangeJobPosting: () => void }>) {
  const { view } = props.candidateJourney
  const photo = useResumePhoto({ photo: view.status === 'candidate-session-open' ? view.session.resumePhoto ?? null : null,
    onChange: props.candidateJourney.updateResumePhoto })
  const [proposalPhoto, setProposalPhoto] = useState<string | undefined>(undefined)
  const [editorTab, setEditorTab] = useState<EditorTab | null>(null)
  const editorOpened = editorTab !== null
  const [downloadedRevision, setDownloadedRevision] = useState<string | null>(null)
  const revision = props.candidateJourney.view.status === 'candidate-session-open' ? props.candidateJourney.view.resumeReview?.draft.revision ?? null : null
  const copy = resumeReviewCopy[props.localization.locale]
  const operations = useRetryableOperations()
  return <Paper aria-labelledby="tailored-resume-title" component="section"
    className="candidate-journey-workspace" p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg">
      <PreparationStatus {...props} />
      <div><Title id="tailored-resume-title" order={2}>{copy.preview}</Title><Text c="dimmed">{copy.description}</Text></div>
      <OverflowReductionSummary {...props} copy={copy} openHiddenContent={() => { setEditorTab('recovery') }} />
      <CurrentResumePreview {...props} {...{ editorOpened, photo }} onDownload={() => {
        props.candidateJourney.recordResumeDownload(); setDownloadedRevision(revision) }}
        condensation={{ label: copy.condense, disabled: !canCondense({ candidateJourney: props.candidateJourney, photo }),
          propose: () => { operations.attempt(() => {
            setProposalPhoto(photo.dataUrl); void props.candidateJourney.proposeResumeCondensation({ photoDataUrl: photo.dataUrl }) }) } }} />
      {downloadedRevision !== null && downloadedRevision === revision
        ? <UsabilityFeedback key={downloadedRevision} candidateJourney={props.candidateJourney} copy={copy} /> : null}
      <ReviewStatus {...props} copy={copy} onRetry={operations.retry} />
      <CondensationProposal {...props} copy={copy} photoDataUrl={photo.dataUrl}
        proposalLayoutCurrent={photo.ready && !photo.failed && proposalPhoto === photo.dataUrl} />
      <Group><Button variant="default" disabled={blocksResumeEditing(view)}
        onClick={() => { setEditorTab('contacts') }}>{copy.edit}</Button>
        <Button variant="default" onClick={props.onChangeJobPosting}>{copy.changeJobPosting}</Button></Group>
      <MatchAnalysisDisclosure {...props} />
      <DocumentText document={props.resume} locale={props.localization.locale} />
    </Stack>
    <ResumeEditorDialog {...props} {...{ copy, editorTab, operations }} closeEditor={() => { setEditorTab(null) }} />
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

function ResumeEditorDialog({ editorTab, ...props }: ResumeDocumentProps & Readonly<{
  copy: ResumeReviewCopy; editorTab: EditorTab | null; closeEditor: () => void; operations: RetryableOperations
}>) {
  const fullScreen = useMediaQuery('(max-width: 48em)')
  return <Modal opened={editorTab !== null} onClose={props.closeEditor} title={props.copy.edit}
    fullScreen={fullScreen} size="xl" returnFocus closeButtonProps={{ 'aria-label': props.copy.close }}>
    <ResumeEditor {...props} initialTab={editorTab ?? 'contacts'} />
  </Modal>
}

/** Says how much Hidden Content Overflow Reduction produced, and opens the editor where the Candidate restores it. */
function OverflowReductionSummary({ candidateJourney, copy, openHiddenContent }: ResumeReviewProps & Readonly<{
  copy: ResumeReviewCopy; openHiddenContent: () => void
}>) {
  const { view } = candidateJourney
  const review = view.status === 'candidate-session-open' ? view.resumeReview : null
  if (review === null) return null
  const layout = review.assessment?.layout
  // Only a measured layout of the current draft says which Page Budget the hidden content fits.
  const pageCount = layout?.status === 'fits' && layout.revision === review.draft.revision ? layout.pageCount : null
  const summary = describeOverflowReduction({ locale: review.draft.document.locale, ...review.recovery.overflowReduction, pageCount })
  if (summary === null) return null
  return <Group justify="space-between"><Text>{summary}</Text>
    <Button variant="subtle" disabled={blocksResumeEditing(view)} onClick={openHiddenContent}>{copy.reviewHidden}</Button></Group>
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
  const { preparation } = view.session
  if ((preparation?.sourceIntake ?? view.session.sourceIntake) === null || (preparation?.jobMatch ?? view.session.jobMatch) === null) return null
  return <details><summary>{localization.translate('combinedIntake.analysis')}</summary>
    <JobMatchWorkspace {...{ candidateJourney, localization }} /></details>
}

function ReviewStatus({ candidateJourney, copy, localization, onRetry }: ResumeReviewProps & Readonly<{
  copy: ResumeReviewCopy; onRetry: () => void
}>) {
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  if (review === null) return null
  const layout = review.assessment?.layout
  const measured = layout !== undefined && layout.revision === review.draft.revision
  const layoutText = !measured ? '' : layout.status === 'fits' ? copy.fits : layout.status === 'overflow' ? copy.overflow : ''
  const operationText = review.operation === 'validating-section' ? copy.validating
    : review.operation === 'condensing' ? copy.condensing : review.operation === 'assessing-layout' ? copy.checking : ''
  return <Stack gap="xs"><Text role="status" aria-live="polite">{operationText || layoutText}</Text>
    {review.failure === null ? null : <ResumeOperationFailureAlert failure={review.failure} {...{ localization, onRetry }} />}
  </Stack>
}

function CondensationProposal({ candidateJourney, copy, localization, resume, photoDataUrl, proposalLayoutCurrent }: Readonly<{
  candidateJourney: ResumeReviewController; copy: ResumeReviewCopy; localization: Localization; resume: TailoredResume
  photoDataUrl?: string; proposalLayoutCurrent: boolean
}>) {
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  const proposal = review?.proposal
  if (proposal === undefined || proposal === null) return null
  const decision = { proposalId: proposal.id, baseRevision: proposal.baseRevision }
  const proposedResume = { ...proposal.document, identity: resume.identity, contactDetails: resume.contactDetails }
  return <Paper p="md" withBorder><Stack>
    <Title order={3}>{copy.proposal}</Title><Text>{copy.proposalDescription}</Text>
    <ResumePreview resume={proposedResume} title={copy.proposal} photoDataUrl={photoDataUrl} />
    <Text>{!proposalLayoutCurrent ? copy.unchecked : proposal.layout.status === 'fits' ? copy.fits : proposal.layout.status === 'overflow' ? copy.overflow
      : localization.translate('failure.review.pageCountUnavailable')}</Text>
    <Group><Button disabled={review?.draft.revision !== proposal.baseRevision}
      onClick={() => { candidateJourney.acceptResumeCondensation(decision) }}>{copy.accept}</Button>
      <Button variant="default" onClick={() => { candidateJourney.rejectResumeCondensation(decision) }}>{copy.reject}</Button></Group>
  </Stack></Paper>
}

function ResumePreview({ resume, title, photoDataUrl }: Readonly<{ resume: TailoredResume; title: string; photoDataUrl?: string }>) {
  return <iframe className="tailored-resume-preview-frame" sandbox="" title={title}
    srcDoc={renderTailoredResumeDocument({ tailoredResume: resume, photoDataUrl })} />
}

function CurrentResumePreview({ candidateJourney, condensation, localization, resume, editorOpened, photo, onDownload }: ResumeDocumentProps & Readonly<{
  condensation: ResumePreviewProps['condensation']; editorOpened: boolean; photo: ReturnType<typeof useResumePhoto>; onDownload: () => void
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  const enabled = view.session.preparedResumeStatus !== 'outdated'
    && view.resumeReview.operation === null && (view.operation === null || view.operation === 'rendering-resume-document')
  return <TailoredResumePreview document={resume} localization={localization} enabled={enabled} paused={editorOpened} photo={photo} condensation={condensation}
    unsupportedFieldIds={view.resumeReview.unsupportedFieldIds} renderDocument={candidateJourney.renderResumeDocument}
    onDownload={onDownload} onIdentityChange={(identity) => {
      candidateJourney.updateResumeContacts({ identity, contactDetails: resume.contactDetails }) }} />
}

function UsabilityFeedback({ candidateJourney, copy }: Readonly<{ candidateJourney: ResumeReviewController; copy: ResumeReviewCopy }>) {
  const [recorded, setRecorded] = useState(false)
  const rate = (useful: boolean) => { candidateJourney.rateResumeUsefulness({ useful }); setRecorded(true) }
  if (recorded) return <Text role="status">{copy.usabilityRecorded}</Text>
  return <div role="group" aria-labelledby="resume-usability-question"><Stack gap="xs">
    <Text id="resume-usability-question" fw={600}>{copy.usability}</Text>
    <Group><Button variant="default" onClick={() => { rate(true) }}>{copy.usable}</Button>
      <Button variant="default" onClick={() => { rate(false) }}>{copy.needsRewriting}</Button></Group>
  </Stack></div>
}
