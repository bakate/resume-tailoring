import { Button, Group, Modal, Paper, Stack, Text, Title } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { useState } from 'react'

import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { useResumePhoto } from './use-resume-preview'
import { TailoredResumePreview } from './tailored-resume-preview'
import { createPrivacySafeBrowserTelemetry } from '../resume-tailoring/browser-adapters'
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
  const copy = resumeReviewCopy[props.localization.locale]
  return <Paper aria-labelledby="tailored-resume-title" component="section"
    className="candidate-journey-workspace" p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg">
      <PreparationStatus {...props} />
      <div><Title id="tailored-resume-title" order={2}>{copy.preview}</Title><Text c="dimmed">{copy.description}</Text></div>
      <CurrentResumePreview {...props} {...{ editorOpened, photo }} />
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
  const layoutText = layout === undefined || layout.revision !== review.draft.revision ? copy.unchecked
    : layout.status === 'fits' ? copy.fits : layout.status === 'overflow' ? copy.overflow : copy.unavailable
  const operationText = review.operation === 'validating-section' ? copy.validating
    : review.operation === 'condensing' ? copy.condensing : review.operation === 'assessing-layout' ? copy.checking : ''
  return <Stack gap="xs"><Text role="status" aria-live="polite">{operationText || layoutText}</Text>
    {review.unsupportedFieldIds.length > 0 ? <Text c="danger.8" role="alert">{copy.unsupported}</Text> : null}
    {review.failure === null ? null : <Text c="danger.8" role="alert">{copy.failure} {copy[review.failure.recovery]}</Text>}
    {review.assessment?.exportEligibility.status === 'blocked' ? <Stack gap={0}>
      {review.assessment.exportEligibility.reasons.filter((reason) => reason !== 'overflow').map((reason) =>
        <Text key={reason} size="sm">{copy[reason]}</Text>)}
    </Stack> : null}
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

function CurrentResumePreview({ candidateJourney, resume, editorOpened, photo }: ResumeDocumentProps & Readonly<{
  editorOpened: boolean; photo: ReturnType<typeof useResumePhoto>
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  const enabled = !editorOpened && view.session.preparedResumeStatus !== 'outdated'
    && view.resumeReview.operation === null && (view.operation === null || view.operation === 'rendering-resume-document')
  return <TailoredResumePreview document={resume} enabled={enabled} photo={photo}
    unsupportedFieldIds={view.resumeReview.unsupportedFieldIds} renderDocument={candidateJourney.renderResumeDocument}
    onDownload={() => { recordDownload({ candidateJourney }) }} />
}

function recordDownload({ candidateJourney }: Readonly<{ candidateJourney: ResumeReviewController }>) {
  const view = candidateJourney.view
  if (view.status !== 'candidate-session-open' || view.session.jobMatch === null) return
  const score = view.session.jobMatch.analysis.matchScore
  const matchScoreBand = score < 25 ? '0-24' : score < 50 ? '25-49' : score < 75 ? '50-74' : '75-100'
  void createPrivacySafeBrowserTelemetry().record({ name: 'resume-downloaded', matchScoreBand })
}
