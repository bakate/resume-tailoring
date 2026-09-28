import type {
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileFactKind,
  SourceProfileReview,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  sourceProfileFactKinds,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  hasSourceProfileFactConflict,
  sourceProfileProcessingNoticeVersion,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

import type { Localization } from '../localization/localization'
import { isSourceDocumentIntakeFailureMessage } from './use-candidate-session'
import type { CandidateSessionController } from './use-candidate-session'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>
type SourceProfileReviewProps = WorkspaceProps & Readonly<{ sourceProfile: SourceProfileReview }>
type FactActionProps = WorkspaceProps & Readonly<{ factId: SourceProfileFactId }>
type ContentRevision = 'changed' | 'saved'
type SourceDocumentMethod = 'pdf' | 'text'
type TextValidation = 'empty' | null

export function SourceProfileWorkspace({ candidateSession, localization }: WorkspaceProps) {
  if (candidateSession.view.status !== 'ready') return null
  const sourceProfile = candidateSession.view.sourceProfile
  return (
    <section aria-busy={isSourceProfilePending({ candidateSession })}
      className="source-profile-workspace" aria-labelledby="source-profile-title">
      <h2 id="source-profile-title" tabIndex={-1}>{localization.translate('sourceProfile.title')}</h2>
      {sourceProfile === undefined ? (
        <SourceDocumentImport {...{ candidateSession, localization }} />
      ) : sourceProfile.status === 'reviewing-document' ? (
        <SourceDocumentReview {...{ candidateSession, localization, sourceProfile }} />
      ) : (
        <SourceProfileFactsReview {...{ candidateSession, localization, sourceProfile }} />
      )}
    </section>
  )
}

function SourceDocumentImport({ candidateSession, localization }: WorkspaceProps) {
  const intake = useSourceDocumentIntake()
  return <div className="source-profile-card">
    <p>{localization.translate('sourceProfile.importDescription')}</p>
    <SourceDocumentMethodSelector {...{ candidateSession, intake, localization }} />
    {intake.method === 'pdf'
      ? <PdfSourceDocumentInput {...{ candidateSession, intake, localization }} />
      : <PastedSourceDocumentInput {...{ candidateSession, intake, localization }} />}
  </div>
}

function useSourceDocumentIntake() {
  const [method, setMethod] = useState<SourceDocumentMethod>('pdf')
  const [professionalText, setProfessionalText] = useState('')
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null)
  const [textValidation, setTextValidation] = useState<TextValidation>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  return { fileInput, method, professionalText, selectedFilename, setMethod,
    setProfessionalText, setSelectedFilename, setTextValidation, textValidation } as const
}

type SourceDocumentIntake = ReturnType<typeof useSourceDocumentIntake>
type IntakeProps = WorkspaceProps & Readonly<{ intake: SourceDocumentIntake }>

function SourceDocumentMethodSelector({ candidateSession, intake, localization }: IntakeProps) {
  const { translate } = localization
  return <fieldset className="source-document-methods">
    <legend>{translate('sourceProfile.methodLabel')}</legend>
    <SourceDocumentMethodOption description={translate('sourceProfile.pdfDescription')}
      intake={intake} label={translate('sourceProfile.pdfMethod')} method="pdf"
      pendingOperation={candidateSession.pendingOperation} />
    <SourceDocumentMethodOption description={translate('sourceProfile.textDescription')}
      intake={intake} label={translate('sourceProfile.textMethod')} method="text"
      pendingOperation={candidateSession.pendingOperation} />
  </fieldset>
}

function SourceDocumentMethodOption({ description, intake, label, method, pendingOperation }: Readonly<{
  description: string
  intake: SourceDocumentIntake
  label: string
  method: SourceDocumentMethod
  pendingOperation: CandidateSessionController['pendingOperation']
}>) {
  return <label><input checked={intake.method === method} disabled={pendingOperation !== null}
    name="source-document-method"
    onChange={() => { intake.setMethod(method) }} type="radio" />
  <span><strong>{label}</strong><small>{description}</small></span></label>
}

function PdfSourceDocumentInput({ candidateSession, intake, localization }: IntakeProps) {
  const { translate } = localization
  const failureMessageKey = readPdfFailureMessageKey({ candidateSession })
  return <div className="source-document-input">
    <input accept="application/pdf,.pdf" disabled={candidateSession.pendingOperation !== null}
      hidden id="source-document-pdf"
      onChange={(event) => { importSelectedPdf({ candidateSession, event, intake }) }}
      ref={intake.fileInput} type="file" />
    <button className="secondary-action" disabled={candidateSession.pendingOperation !== null}
      onClick={() => { intake.fileInput.current?.click() }} type="button">
      {translate('sourceProfile.choosePdf')}</button>
    <p aria-live="polite">{intake.selectedFilename === null
      ? translate('sourceProfile.noFileSelected')
      : `${translate('sourceProfile.selectedFile')} ${intake.selectedFilename}`}</p>
    {failureMessageKey === null ? null : <p className="intake-failure" role="alert">
      {translate(failureMessageKey)}
    </p>}
  </div>
}

function importSelectedPdf({ candidateSession, event, intake }: Readonly<{
  candidateSession: CandidateSessionController
  event: ChangeEvent<HTMLInputElement>
  intake: SourceDocumentIntake
}>) {
  const [file] = event.currentTarget.files ?? []
  if (file === undefined) return
  intake.setSelectedFilename(file.name)
  void candidateSession.importSourceDocument({ file })
}

function readPdfFailureMessageKey({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const messageKey = candidateSession.failureMessageKey
  return isSourceDocumentIntakeFailureMessage(messageKey) ? messageKey : null
}

function PastedSourceDocumentInput({ candidateSession, intake, localization }: IntakeProps) {
  const { translate } = localization
  return <div className="source-document-input pasted-source-document">
    <label htmlFor="pasted-source-document">{translate('sourceProfile.textLabel')}</label>
    <textarea id="pasted-source-document" onChange={(event) => {
      updateProfessionalText({ content: event.currentTarget.value, intake })
    }} placeholder={translate('sourceProfile.textPlaceholder')} rows={10} value={intake.professionalText} />
    {intake.textValidation === null ? null : <p className="intake-failure" role="alert">
      {translate('sourceProfile.emptyTextFailure')}
    </p>}
    <button className="secondary-action" disabled={candidateSession.pendingOperation !== null}
      onClick={() => { reviewPastedText({ candidateSession, intake }) }} type="button">
      {translate('sourceProfile.reviewText')}</button>
  </div>
}

function updateProfessionalText({ content, intake }: Readonly<{
  content: string
  intake: SourceDocumentIntake
}>) {
  intake.setProfessionalText(content)
  if (content.trim().length > 0) intake.setTextValidation(null)
}

function reviewPastedText({ candidateSession, intake }: Readonly<{
  candidateSession: CandidateSessionController
  intake: SourceDocumentIntake
}>) {
  if (intake.professionalText.trim().length === 0) {
    intake.setTextValidation('empty')
    return
  }
  intake.setTextValidation(null)
  const file = new File([intake.professionalText], 'pasted-professional-text.txt', {
    type: 'text/plain',
  })
  void candidateSession.importSourceDocument({ file })
}

function SourceDocumentReview({ candidateSession, localization, sourceProfile }: SourceProfileReviewProps) {
  const [outgoingContent, setOutgoingContent] = useState(sourceProfile.outgoingContent)
  useEffect(() => {
    setOutgoingContent(sourceProfile.outgoingContent)
  }, [sourceProfile.outgoingContent])
  const contentRevision = outgoingContent === sourceProfile.outgoingContent ? 'saved' : 'changed'
  return <section aria-labelledby="source-document-review-title"
    className="source-profile-card source-document-review">
    <h3 id="source-document-review-title">
      {localization.translate('sourceProfile.reviewSurfaceTitle')}
    </h3>
    <div className="source-profile-grid">
      <SensitiveContentPanel {...{ localization, sourceProfile }} />
      <OutgoingContentPanel {...{
        candidateSession, contentRevision, localization, outgoingContent, setOutgoingContent, sourceProfile,
      }} />
    </div>
  </section>
}

function SensitiveContentPanel({ localization, sourceProfile }: Omit<SourceProfileReviewProps, 'candidateSession'>) {
  return <section className="source-document-panel">
    <h3>{localization.translate('sourceProfile.detectedTitle')}</h3>
    <SensitiveContentList {...{ localization, sourceProfile }} />
  </section>
}

type OutgoingContentPanelProps = SourceProfileReviewProps & Readonly<{
  contentRevision: ContentRevision
  outgoingContent: string
  setOutgoingContent: (content: string) => void
}>

function OutgoingContentPanel(props: OutgoingContentPanelProps) {
  const { candidateSession, contentRevision, localization, outgoingContent, sourceProfile } = props
  return <section className="source-document-panel source-profile-review">
    <OutgoingContentEditor {...props} />
    <button className="secondary-action" disabled={contentRevision === 'saved'}
      onClick={() => void candidateSession.updateSourceContent({ outgoingContent })} type="button">
      {localization.translate('sourceProfile.saveContent')}
    </button>
    <ProcessingNotice {...{ candidateSession, contentRevision, localization, sourceProfile }} />
  </section>
}

function OutgoingContentEditor({ localization, outgoingContent, setOutgoingContent }: OutgoingContentPanelProps) {
  return <>
    <label htmlFor="outgoing-source-content">{localization.translate('sourceProfile.outgoingLabel')}</label>
    <textarea id="outgoing-source-content" rows={14} value={outgoingContent}
      onChange={(event) => { setOutgoingContent(event.currentTarget.value) }} />
  </>
}

function SensitiveContentList({
  localization,
  sourceProfile,
}: Readonly<{ localization: Localization; sourceProfile: SourceProfileReview }>) {
  const { translate } = localization
  if (sourceProfile.detectedSensitiveContent.length === 0) {
    return <p>{translate('sourceProfile.detectedNone')}</p>
  }
  return (
    <ul className="sensitive-content-list">
      {sourceProfile.detectedSensitiveContent.map((content) => (
        <li key={content.id}>
          <strong>{translate(`sourceProfile.sensitiveKind.${content.kind}`)}</strong>
          <span>{content.value}</span>
        </li>
      ))}
    </ul>
  )
}

type ProcessingNoticeProps = SourceProfileReviewProps & Readonly<{ contentRevision: ContentRevision }>

function ProcessingNotice(props: ProcessingNoticeProps) {
  const { localization, sourceProfile } = props
  const { translate } = localization
  const confirmationStatus = sourceProfile.processingNotice?.version
    === sourceProfileProcessingNoticeVersion ? 'confirmed' : 'pending'
  return (
    <div className="processing-notice">
      <h3>{translate('sourceProfile.noticeTitle')}</h3>
      <p>{translate('sourceProfile.noticeText')}</p>
      <small>{translate('sourceProfile.noticeVersion')} {sourceProfileProcessingNoticeVersion}</small>
      <ExtractFactsButton {...{ ...props, confirmationStatus }} />
    </div>
  )
}

type NoticeActionProps = ProcessingNoticeProps & Readonly<{
  confirmationStatus: 'confirmed' | 'pending'
}>

function ExtractFactsButton({
  candidateSession,
  confirmationStatus,
  contentRevision,
  localization,
  sourceProfile,
}: NoticeActionProps) {
  return <button className="primary-action compact-action"
    disabled={candidateSession.pendingOperation !== null
      || contentRevision === 'changed' || sourceProfile.outgoingContent.trim().length === 0}
    onClick={() => void (confirmationStatus === 'confirmed'
      ? candidateSession.extractSourceProfile()
      : candidateSession.confirmProcessingAndExtractSourceProfile())} type="button">
    {localization.translate(confirmationStatus === 'confirmed'
      ? 'sourceProfile.extract'
      : 'sourceProfile.confirmAndExtract')}
  </button>
}

function SourceProfileFactsReview({ candidateSession, localization, sourceProfile }: SourceProfileReviewProps) {
  const currentFacts = sourceProfile.facts.filter((fact) =>
    fact.status === 'verified' || fact.status === 'extracted')
  return <div className="source-profile-card facts-review-card">
    <div className="facts-review-header">
      <div>
        <h3>{localization.translate('sourceProfile.factsTitle')}</h3>
        <p>{localization.translate('sourceProfile.importDescription')}</p>
      </div>
    </div>
    <GroupedSourceProfileFacts {...{ candidateSession, facts: currentFacts, localization,
      sourceProfile }} />
  </div>
}

type FactsCollectionProps = WorkspaceProps & Readonly<{
  facts: readonly SourceProfileFact[]
  sourceProfile: SourceProfileReview
}>
type FactGroupProps = FactsCollectionProps & Readonly<{ kind: SourceProfileFactKind }>

function GroupedSourceProfileFacts(props: FactsCollectionProps) {
  const { facts, localization, sourceProfile } = props
  if (facts.length === 0) return <p className="facts-empty-state">
    {localization.translate('sourceProfile.filterEmpty')}
  </p>
  const conflictingFacts = facts.filter((fact) => hasSourceProfileFactConflict({
    fact, facts: sourceProfile.facts,
  }))
  return <div className="source-fact-groups">
    {conflictingFacts.length === 0 ? null : <ConflictFactsReview {...props} facts={conflictingFacts} />}
    {sourceProfileFactKinds.map((kind) => <SourceProfileFactGroup
      {...props} facts={readNonConflictingFacts({ facts, kind, sourceProfile })}
      key={kind} kind={kind} />)}
  </div>
}


function ConflictFactsReview(props: FactsCollectionProps) {
  const { facts, localization } = props
  return <section aria-labelledby="source-profile-conflicts-title" className="fact-group conflict-group">
    <div className="fact-group-heading">
      <h4 id="source-profile-conflicts-title">
        {localization.translate('sourceProfile.conflictsTitle')}
      </h4>
      <p>{localization.translate('sourceProfile.conflictsDescription')}</p>
    </div>
    <SourceProfileFactsList {...props} facts={facts} />
  </section>
}

function SourceProfileFactGroup(props: FactGroupProps) {
  const { facts, kind, localization } = props
  if (facts.length === 0) return null
  const titleId = `source-profile-fact-group-${kind}`
  return <section aria-labelledby={titleId} className="fact-group">
    <div className="fact-group-heading">
      <h4 id={titleId}>{localization.translate(`sourceProfile.kind.${kind}`)}</h4>
      <span>{facts.length}</span>
    </div>
    <SourceProfileFactsList {...props} facts={facts} />
  </section>
}

function SourceProfileFactsList(props: FactsCollectionProps) {
  const { facts, sourceProfile } = props
  return <ul className="source-fact-list">
    {facts.map((fact) => <SourceProfileFactCard
      {...props} fact={fact} facts={sourceProfile.facts} key={fact.id} />)}
  </ul>
}

type SourceProfileFactCardProps = WorkspaceProps & Readonly<{
  fact: SourceProfileFact
  facts: readonly SourceProfileFact[]
}>

function SourceProfileFactCard(props: SourceProfileFactCardProps) {
  const { candidateSession, fact, localization } = props
  return <li className={`source-fact source-fact-${fact.status}`}>
    <div className="fact-heading">
      <strong>{localization.translate(`sourceProfile.kind.${fact.kind}`)}</strong>
      <span>{localization.translate(`sourceProfile.status.${fact.status}`)}</span>
    </div>
    <p>{fact.value}</p>
    <FactControls {...props} />
    {fact.status === 'verified'
      ? <CorrectionForm {...{ candidateSession, fact, localization }} /> : null}
  </li>
}

function FactControls(props: SourceProfileFactCardProps) {
  const { candidateSession, fact, facts, localization } = props
  const conflict = hasSourceProfileFactConflict({ fact, facts })
  if (conflict) {
    return <ConflictDecisionActions {...{ candidateSession, factId: fact.id, localization }} />
  }
  return null
}

function readNonConflictingFacts({ facts, kind, sourceProfile }: Readonly<{
  facts: readonly SourceProfileFact[]
  kind: SourceProfileFactKind
  sourceProfile: SourceProfileReview
}>) {
  return facts.filter((fact) => fact.kind === kind
    && !hasSourceProfileFactConflict({ fact, facts: sourceProfile.facts }))
}

function ConflictDecisionActions({ candidateSession, factId, localization }: FactActionProps) {
  return (
    <div className="fact-actions">
      <button className="conflict-action" type="button" onClick={() => void candidateSession
        .resolveSourceProfileFactConflict({ selectedFactId: factId })}>
        {localization.translate('sourceProfile.resolveConflict')}
      </button>
      <button onClick={() => void candidateSession.rejectSourceProfileFact({ factId })} type="button">
        {localization.translate('sourceProfile.rejectFact')}
      </button>
    </div>
  )
}

function CorrectionForm({ candidateSession, fact, localization }:
WorkspaceProps & Readonly<{ fact: SourceProfileFact }>) {
  const [correctedValue, setCorrectedValue] = useState(fact.value)
  return (
    <details className="correction-disclosure">
      <summary>{localization.translate('sourceProfile.correctionLabel')}</summary>
      <div className="correction-form">
        <label htmlFor={`correction-${fact.id}`}>{localization.translate('sourceProfile.correctionLabel')}</label>
        <input id={`correction-${fact.id}`} value={correctedValue}
          onChange={(event) => { setCorrectedValue(event.currentTarget.value) }} />
        <button disabled={correctedValue.trim().length === 0 || correctedValue === fact.value}
          onClick={() => void candidateSession.correctSourceProfileFact({
            factId: fact.id, correctedValue: correctedValue.trim(),
          })} type="button">
          {localization.translate('sourceProfile.correctFact')}
        </button>
      </div>
    </details>
  )
}

function isSourceProfilePending({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  return candidateSession.pendingOperation === 'import-source-document'
    || candidateSession.pendingOperation === 'extract-source-profile'
}
