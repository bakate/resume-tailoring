import type {
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileFactKind,
  SourceProfileReview,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  sourceProfileFactKinds,
  sourceProfileFactStatuses,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  hasSourceProfileFactConflict,
  sourceProfileProcessingNoticeVersion,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, SetStateAction } from 'react'

import type { Localization } from '../localization/localization'
import type { CandidateSessionController } from './use-candidate-session'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>
type SourceProfileReviewProps = WorkspaceProps & Readonly<{ sourceProfile: SourceProfileReview }>
type FactActionProps = WorkspaceProps & Readonly<{ factId: SourceProfileFactId }>
type ContentRevision = 'changed' | 'saved'
type FactStatusFilter = SourceProfileFact['status'] | 'all'
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
  if (messageKey === 'sourceProfile.unreadableFailure') return messageKey
  if (messageKey === 'sourceProfile.unsupportedFailure') return messageKey
  return messageKey === 'sourceProfile.failure' ? messageKey : null
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
      <NoticeConfirmation {...{ ...props, confirmationStatus }} />
      <ExtractFactsButton {...{ ...props, confirmationStatus }} />
    </div>
  )
}

type NoticeActionProps = ProcessingNoticeProps & Readonly<{
  confirmationStatus: 'confirmed' | 'pending'
}>

function NoticeConfirmation({ candidateSession, confirmationStatus, contentRevision, localization, sourceProfile }: NoticeActionProps) {
  if (confirmationStatus === 'confirmed') return <p className="confirmed-note">
    {localization.translate('sourceProfile.noticeConfirmed')}
  </p>
  return <button className="secondary-action"
    disabled={contentRevision === 'changed' || sourceProfile.outgoingContent.trim().length === 0}
    onClick={() => void candidateSession.confirmProcessingNotice()} type="button">
    {localization.translate('sourceProfile.confirmNotice')}
  </button>
}

function ExtractFactsButton({ candidateSession, confirmationStatus, contentRevision, localization }: NoticeActionProps) {
  return <button className="primary-action compact-action"
    disabled={candidateSession.pendingOperation !== null
      || confirmationStatus === 'pending' || contentRevision === 'changed'}
    onClick={() => void candidateSession.extractSourceProfile()} type="button">
    {localization.translate('sourceProfile.extract')}
  </button>
}

function SourceProfileFactsReview({ candidateSession, localization, sourceProfile }: SourceProfileReviewProps) {
  const review = useSourceProfileFactReview({ sourceProfile })
  return <div className="source-profile-card facts-review-card">
    <FactsReviewHeader {...{
      facts: sourceProfile.facts, localization, setStatusFilter: review.setStatusFilter,
      setVisibleCount: review.setVisibleCount, statusFilter: review.statusFilter,
    }} />
    <FactReviewAnnouncement {...{ localization, sourceProfile }} selectedFactIds={review.selectedFactIds} />
    <GroupedSourceProfileFacts {...{
      candidateSession, facts: review.visibleFacts, localization,
      selectedFactIds: review.selectedFactIds, setSelectedFactIds: review.setSelectedFactIds, sourceProfile,
    }} />
    <ShowMoreFacts {...{
      filteredCount: review.filteredCount, localization,
      setVisibleCount: review.setVisibleCount, visibleCount: review.visibleCount,
    }} />
  </div>
}

function useSourceProfileFactReview({ sourceProfile }: Readonly<{ sourceProfile: SourceProfileReview }>) {
  const [statusFilter, setStatusFilter] = useState<FactStatusFilter>('all')
  const [visibleCount, setVisibleCount] = useState(factPageSize)
  const [selectedFactIds, setSelectedFactIds] = useState<ReadonlySet<SourceProfileFactId>>(
    () => new Set(),
  )
  const filteredFacts = statusFilter === 'all'
    ? sourceProfile.facts
    : sourceProfile.facts.filter((fact) => fact.status === statusFilter)
  return {
    filteredCount: filteredFacts.length, selectedFactIds, setSelectedFactIds,
    setStatusFilter, setVisibleCount, statusFilter, visibleCount,
    visibleFacts: filteredFacts.slice(0, visibleCount),
  } as const
}

type FactsReviewHeaderProps = Omit<SourceProfileReviewProps, 'candidateSession' | 'sourceProfile'>
  & Readonly<{
    facts: readonly SourceProfileFact[]
    setStatusFilter: (status: FactStatusFilter) => void
    setVisibleCount: (count: number) => void
    statusFilter: FactStatusFilter
  }>

function FactsReviewHeader(props: FactsReviewHeaderProps) {
  const { facts, localization } = props
  const reviewedCount = facts.filter((fact) => fact.status !== 'extracted').length
  return <div className="facts-review-header">
    <div>
      <h3>{localization.translate('sourceProfile.factsTitle')}</h3>
      <p aria-live="polite" className="facts-review-progress">
        {localization.translate('sourceProfile.reviewProgress')} {reviewedCount}/{facts.length}
      </p>
      <progress max={Math.max(facts.length, 1)} value={reviewedCount} />
    </div>
    <FactStatusFilters {...props} />
  </div>
}

function FactReviewAnnouncement({ localization, selectedFactIds, sourceProfile }:
Omit<SourceProfileReviewProps, 'candidateSession'> & Pick<FactSelectionProps, 'selectedFactIds'>) {
  return <p aria-atomic="true" aria-live="polite" className="visually-hidden" role="status">
    {readFactReviewAnnouncement({
      facts: sourceProfile.facts, localization, selectedFactIds,
    })}
  </p>
}

function readFactReviewAnnouncement({ facts, localization, selectedFactIds }: Readonly<{
  facts: readonly SourceProfileFact[]
  localization: Localization
  selectedFactIds: ReadonlySet<SourceProfileFactId>
}>) {
  const stateSummary = sourceProfileFactStatuses.map((status) =>
    `${String(countFacts({ facts, filter: status }))} ${localization.translate(`sourceProfile.status.${status}`)}`)
  const conflictCount = facts.filter((fact) => hasSourceProfileFactConflict({ fact, facts })).length
  const selectedCount = facts.filter((fact) =>
    fact.status === 'extracted' && selectedFactIds.has(fact.id)).length
  return `${localization.translate('sourceProfile.factStates')} ${stateSummary.join(', ')}. ${
    String(conflictCount)} ${localization.translate('sourceProfile.conflictsAnnouncement')} ${
    readSelectionCount({ count: selectedCount, localization })}.`
}

function FactStatusFilters(props: FactsReviewHeaderProps) {
  const { facts, localization, setStatusFilter, setVisibleCount, statusFilter } = props
  return <div aria-label={localization.translate('sourceProfile.filterLabel')}
    className="fact-status-filters" role="group">
    {factStatusFilters.map((filter) => <button aria-pressed={statusFilter === filter}
      key={filter} onClick={() => { setStatusFilter(filter); setVisibleCount(factPageSize) }}
      type="button">
      {readFactFilterLabel({ filter, localization })} <span>{countFacts({ facts, filter })}</span>
    </button>)}
  </div>
}

type FactSelectionProps = Readonly<{
  selectedFactIds: ReadonlySet<SourceProfileFactId>
  setSelectedFactIds: Dispatch<SetStateAction<ReadonlySet<SourceProfileFactId>>>
}>

type FactsCollectionProps = WorkspaceProps & FactSelectionProps & Readonly<{
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

function ShowMoreFacts({ filteredCount, localization, setVisibleCount, visibleCount }: Readonly<{
  filteredCount: number
  localization: Localization
  setVisibleCount: (count: number) => void
  visibleCount: number
}>) {
  if (visibleCount >= filteredCount) return null
  return <button className="show-more-facts" onClick={() => {
    setVisibleCount(Math.min(visibleCount + factPageSize, filteredCount))
  }} type="button">
    {localization.translate('sourceProfile.showMore')} ({filteredCount - visibleCount})
  </button>
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
  const { facts, kind } = props
  if (facts.length === 0) return null
  const titleId = `source-profile-fact-group-${kind}`
  return <section aria-labelledby={titleId} className="fact-group">
    <FactGroupHeading {...props} titleId={titleId} />
    <FactBatchReview {...props} />
    <SourceProfileFactsList {...props} facts={facts} />
  </section>
}

function FactGroupHeading(props: FactGroupProps & Readonly<{ titleId: string }>) {
  const { facts, kind, localization } = props
  const confirmableFacts = facts.filter((fact) => fact.status === 'extracted')
  return <div className="fact-group-heading">
    <h4 id={props.titleId}>{localization.translate(`sourceProfile.kind.${kind}`)}</h4>
    <span>{facts.length}</span>
    <FactGroupSelection {...props} facts={confirmableFacts} />
  </div>
}

function FactGroupSelection(props: FactGroupProps) {
  const { facts, kind, localization, selectedFactIds, setSelectedFactIds } = props
  if (facts.length === 0) return null
  const allSelected = facts.every((fact) => selectedFactIds.has(fact.id))
  const accessibleLabel = `${localization.translate('sourceProfile.selectGroup')}: ${
    localization.translate(`sourceProfile.kind.${kind}`)}`
  return <label className="fact-group-selection">
    <input aria-label={accessibleLabel} checked={allSelected} onChange={() => {
      setSelectedFactIds((currentSelectedFactIds) => updateFactSelection({
        currentSelectedFactIds, factIds: facts.map((fact) => fact.id),
        selectionAction: allSelected ? 'deselect' : 'select',
      }))
    }} type="checkbox" />
    <span>{localization.translate('sourceProfile.selectGroup')}</span>
  </label>
}

function FactBatchReview(props: FactsCollectionProps) {
  const { candidateSession, facts, localization, selectedFactIds } = props
  const selectedFacts = readSelectedFacts({ facts, selectedFactIds })
  if (selectedFacts.length === 0) return null
  const selectionCount = readSelectionCount({ count: selectedFacts.length, localization })
  return <div aria-live="polite" className="fact-batch">
    <strong>{selectionCount}</strong>
    <p>{localization.translate('sourceProfile.batchDescription')}</p>
    <ul>{selectedFacts.map((fact) => <li key={fact.id}>{fact.value}</li>)}</ul>
    <button className="secondary-action" type="button" onClick={() => void candidateSession
      .confirmSourceProfileFacts({ factIds: selectedFacts.map((fact) => fact.id) })}>
      {localization.translate('sourceProfile.batchConfirm')} {selectionCount}
    </button>
  </div>
}

function readSelectedFacts({ facts, selectedFactIds }: Readonly<{
  facts: readonly SourceProfileFact[]
  selectedFactIds: ReadonlySet<SourceProfileFactId>
}>) {
  return facts.filter((fact) => fact.status === 'extracted' && selectedFactIds.has(fact.id))
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
}> & FactSelectionProps

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
  if (fact.status !== 'extracted') return null
  return <>
    <FactSelectionControl {...props} />
    <FactDecisionActions {...{ candidateSession, factId: fact.id, localization }} />
  </>
}

function FactSelectionControl(props: SourceProfileFactCardProps) {
  const { fact, localization, selectedFactIds, setSelectedFactIds } = props
  return <label className="fact-selection">
    <input aria-label={`${localization.translate('sourceProfile.selectFact')} ${fact.value}`}
      checked={selectedFactIds.has(fact.id)} onChange={(event) => {
        const selectionAction = event.currentTarget.checked ? 'select' : 'deselect'
        setSelectedFactIds((currentSelectedFactIds) => updateFactSelection({
          currentSelectedFactIds, factIds: [fact.id], selectionAction,
        }))
      }} type="checkbox" />
    <span>{localization.translate('sourceProfile.select')}</span>
  </label>
}

function readNonConflictingFacts({ facts, kind, sourceProfile }: Readonly<{
  facts: readonly SourceProfileFact[]
  kind: SourceProfileFactKind
  sourceProfile: SourceProfileReview
}>) {
  return facts.filter((fact) => fact.kind === kind
    && !hasSourceProfileFactConflict({ fact, facts: sourceProfile.facts }))
}

function updateFactSelection({ currentSelectedFactIds, factIds, selectionAction }: Readonly<{
  currentSelectedFactIds: ReadonlySet<SourceProfileFactId>
  factIds: readonly SourceProfileFactId[]
  selectionAction: 'deselect' | 'select'
}>) {
  const nextSelectedFactIds = new Set(currentSelectedFactIds)
  factIds.forEach((factId) => {
    if (selectionAction === 'select') nextSelectedFactIds.add(factId)
    else nextSelectedFactIds.delete(factId)
  })
  return nextSelectedFactIds
}

function readSelectionCount({ count, localization }: Readonly<{
  count: number
  localization: Localization
}>) {
  const label = count === 1
    ? localization.translate('sourceProfile.selectedFact')
    : localization.translate('sourceProfile.selectedFacts')
  return `${String(count)} ${label}`
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

function FactDecisionActions({ candidateSession, factId, localization }: FactActionProps) {
  return (
    <div className="fact-actions">
      <button onClick={() => void candidateSession.confirmSourceProfileFact({ factId })} type="button">
        {localization.translate('sourceProfile.confirmFact')}
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

function countFacts({ facts, filter }: Readonly<{
  facts: readonly SourceProfileFact[]
  filter: FactStatusFilter
}>) {
  return filter === 'all' ? facts.length : facts.filter((fact) => fact.status === filter).length
}

function readFactFilterLabel({ filter, localization }: Readonly<{
  filter: FactStatusFilter
  localization: Localization
}>) {
  return filter === 'all'
    ? localization.translate('sourceProfile.filterAll')
    : localization.translate(`sourceProfile.status.${filter}`)
}

const factStatusFilters = ['all', 'extracted', 'verified', 'rejected', 'superseded'] as const
const factPageSize = 20

function isSourceProfilePending({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  return candidateSession.pendingOperation === 'import-source-document'
    || candidateSession.pendingOperation === 'extract-source-profile'
}
