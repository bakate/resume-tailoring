import { Button, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useState } from 'react'

import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { useResumePhoto } from './use-resume-preview'
import { TailoredResumePreview } from './tailored-resume-preview'
import { renderTailoredResumeDocument } from './tailored-resume-document'
import { ResumeEditor } from './resume-editor'
import { resumeReviewCopy } from './resume-review-copy'
import type { ResumeReviewCopy } from './resume-review-copy'

export type ResumeReviewController = ReturnType<typeof useCandidateJourney>
export type ResumeReviewProps = Readonly<{ candidateJourney: ResumeReviewController; localization: Localization }>

export function TailoredResumeWorkspace({ candidateJourney, localization }: ResumeReviewProps) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  return <ResumeReview {...{ candidateJourney, localization }} resume={view.resumeReview.draft.document} />
}

type ResumeDocumentProps = ResumeReviewProps & Readonly<{ resume: TailoredResume }>

function ResumeReview(props: ResumeDocumentProps) {
  const photo = useResumePhoto()
  const [proposalPhoto, setProposalPhoto] = useState<string | undefined>(undefined)
  const [editorOpened, setEditorOpened] = useState(false)
  const [downloadedRevision, setDownloadedRevision] = useState<string | null>(null)
  const revision = props.candidateJourney.view.status === 'candidate-session-open' ? props.candidateJourney.view.resumeReview?.draft.revision ?? null : null
  const copy = resumeReviewCopy[props.localization.locale]
  return <Paper aria-labelledby="tailored-resume-title" component="section"
    className="candidate-journey-workspace" p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg">
      <PreparationStatus {...props} />
      <div><Title id="tailored-resume-title" order={2}>{copy.preview}</Title><Text c="dimmed">{copy.description}</Text></div>
      <CurrentResumePreview {...props} {...{ editorOpened, photo }} onDownload={() => {
        props.candidateJourney.recordResumeDownload(); setDownloadedRevision(revision) }} />
      {downloadedRevision !== null && downloadedRevision === revision
        ? <UsabilityFeedback key={downloadedRevision} candidateJourney={props.candidateJourney} copy={copy} /> : null}
      <Group><Button disabled={props.candidateJourney.view.status === 'candidate-session-open' && props.candidateJourney.view.operation !== null} onClick={() => { setEditorOpened(true) }}>{copy.edit}</Button>
        <ReviewActions candidateJourney={props.candidateJourney} copy={copy} photo={photo} onProposalRequested={setProposalPhoto} /></Group>
      <ReviewStatus candidateJourney={props.candidateJourney} copy={copy} />
      <CondensationProposal {...props} copy={copy} photoDataUrl={photo.dataUrl}
        proposalLayoutCurrent={photo.ready && !photo.failed && proposalPhoto === photo.dataUrl} />
    </Stack>
    <ResumeEditorDialog {...props} {...{ copy, editorOpened }} closeEditor={() => { setEditorOpened(false) }} />
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

function ResumeEditorDialog(props: ResumeDocumentProps & Readonly<{
  copy: ResumeReviewCopy; editorOpened: boolean; closeEditor: () => void
}>) {
  const fullScreen = useMediaQuery('(max-width: 48em)')
  return <Modal opened={props.editorOpened} onClose={props.closeEditor} title={props.copy.edit}
    fullScreen={fullScreen} size="xl" returnFocus closeButtonProps={{ 'aria-label': props.copy.close }}>
    <ResumeEditor {...props} />
  </Modal>
}

function ReviewActions({ candidateJourney, copy, photo, onProposalRequested }: Readonly<{
  candidateJourney: ResumeReviewController; copy: ResumeReviewCopy; photo: ReturnType<typeof useResumePhoto>
  onProposalRequested: (photoDataUrl: string | undefined) => void
}>) {
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  const busy = !photo.ready || photo.failed || review?.operation !== null || (candidateJourney.view.status === 'candidate-session-open' && candidateJourney.view.operation !== null)
  return <><Button variant="default" disabled={busy} onClick={() => { onProposalRequested(photo.dataUrl); void candidateJourney.proposeResumeCondensation({ photoDataUrl: photo.dataUrl }) }}>
    {copy.condense}</Button><Button variant="default" disabled={busy} onClick={() => { void candidateJourney.assessResumeLayout({ photoDataUrl: photo.dataUrl }) }}>
    {copy.checkLayout}</Button></>
}

function ReviewStatus({ candidateJourney, copy }: Readonly<{ candidateJourney: ResumeReviewController; copy: ResumeReviewCopy }>) {
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  if (review === null) return null
  const layout = review.assessment?.layout
  const measured = layout !== undefined && layout.revision === review.draft.revision
  const layoutText = !measured ? '' : layout.status === 'fits' ? copy.fits : layout.status === 'overflow' ? copy.overflow : ''
  const operationText = review.operation === 'validating-section' ? copy.validating
    : review.operation === 'condensing' ? copy.condensing : review.operation === 'assessing-layout' ? copy.checking : ''
  return <Stack gap="xs"><Text role="status" aria-live="polite">{operationText || layoutText}</Text>
    {review.failure === null ? null : <Text c="danger.8" role="alert">{copy.failure} {copy[review.failure.recovery]}</Text>}
  </Stack>
}

function CondensationProposal({ candidateJourney, copy, resume, photoDataUrl, proposalLayoutCurrent }: Readonly<{
  candidateJourney: ResumeReviewController; copy: ResumeReviewCopy; resume: TailoredResume; photoDataUrl?: string; proposalLayoutCurrent: boolean
}>) {
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  const proposal = review?.proposal
  if (proposal === undefined || proposal === null) return null
  const decision = { proposalId: proposal.id, baseRevision: proposal.baseRevision }
  const proposedResume = { ...proposal.document, identity: resume.identity, contactDetails: resume.contactDetails }
  return <Paper p="md" withBorder><Stack>
    <Title order={3}>{copy.proposal}</Title><Text>{copy.proposalDescription}</Text>
    <ResumePreview resume={proposedResume} title={copy.proposal} photoDataUrl={photoDataUrl} />
    <Text>{!proposalLayoutCurrent ? copy.unchecked : proposal.layout.status === 'fits' ? copy.fits : proposal.layout.status === 'overflow' ? copy.overflow : copy.unavailable}</Text>
    <Group><Button disabled={review?.draft.revision !== proposal.baseRevision}
      onClick={() => { candidateJourney.acceptResumeCondensation(decision) }}>{copy.accept}</Button>
      <Button variant="default" onClick={() => { candidateJourney.rejectResumeCondensation(decision) }}>{copy.reject}</Button></Group>
  </Stack></Paper>
}

function ResumePreview({ resume, title, photoDataUrl }: Readonly<{ resume: TailoredResume; title: string; photoDataUrl?: string }>) {
  return <iframe className="tailored-resume-preview-frame" sandbox="" title={title}
    srcDoc={renderTailoredResumeDocument({ tailoredResume: resume, photoDataUrl })} />
}

function CurrentResumePreview({ candidateJourney, resume, editorOpened, photo, onDownload }: ResumeDocumentProps & Readonly<{
  editorOpened: boolean; photo: ReturnType<typeof useResumePhoto>; onDownload: () => void
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  const enabled = view.session.preparedResumeStatus !== 'outdated'
    && view.resumeReview.operation === null && (view.operation === null || view.operation === 'rendering-resume-document')
  return <TailoredResumePreview document={resume} enabled={enabled} paused={editorOpened} photo={photo}
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
