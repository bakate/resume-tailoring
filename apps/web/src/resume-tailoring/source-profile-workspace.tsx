import type {
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileFactKind,
  SourceProfileReview,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { sourceProfileFactKinds } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  hasSourceProfileFactConflict,
  sourceProfileProcessingNoticeVersion,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

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
  const { translate } = localization
  return (
    <div className="source-profile-card">
      <p>{translate('sourceProfile.importDescription')}</p>
      <label className="file-field">
        <span>{translate('sourceProfile.fileLabel')}</span>
        <input
          accept="application/pdf,.pdf"
          disabled={candidateSession.pendingOperation !== null}
          onChange={(event) => {
            const [file] = event.currentTarget.files ?? []
            if (file !== undefined) void candidateSession.importSourceDocument({ file })
          }}
          type="file"
        />
      </label>
    </div>
  )
}

function SourceDocumentReview({ candidateSession, localization, sourceProfile }: SourceProfileReviewProps) {
  const [outgoingContent, setOutgoingContent] = useState(sourceProfile.outgoingContent)
  useEffect(() => {
    setOutgoingContent(sourceProfile.outgoingContent)
  }, [sourceProfile.outgoingContent])
  const contentRevision = outgoingContent === sourceProfile.outgoingContent ? 'saved' : 'changed'
  return (
    <section aria-labelledby="source-document-review-title"
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
  )
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
  const [statusFilter, setStatusFilter] = useState<FactStatusFilter>('all')
  const [visibleCount, setVisibleCount] = useState(factPageSize)
  const [selectedFactIds, setSelectedFactIds] = useState<ReadonlySet<SourceProfileFactId>>(
    () => new Set(),
  )
  const filteredFacts = statusFilter === 'all'
    ? sourceProfile.facts
    : sourceProfile.facts.filter((fact) => fact.status === statusFilter)
  const visibleFacts = filteredFacts.slice(0, visibleCount)
  return (
    <div className="source-profile-card facts-review-card">
      <FactsReviewHeader {...{
        facts: sourceProfile.facts, localization, setStatusFilter, setVisibleCount, statusFilter,
      }} />
      <GroupedSourceProfileFacts {...{
        candidateSession, facts: visibleFacts, localization, selectedFactIds,
        setSelectedFactIds, sourceProfile,
      }} />
      <ShowMoreFacts {...{
        filteredCount: filteredFacts.length, localization, setVisibleCount, visibleCount,
      }} />
    </div>
  )
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

function SourceProfileFactGroup(props: FactsCollectionProps & Readonly<{
  kind: SourceProfileFactKind
}>) {
  const { facts, kind } = props
  if (facts.length === 0) return null
  const titleId = `source-profile-fact-group-${kind}`
  return <section aria-labelledby={titleId} className="fact-group">
    <FactGroupHeading {...props} titleId={titleId} />
    <FactBatchReview {...props} />
    <SourceProfileFactsList {...props} facts={facts} />
  </section>
}

function FactGroupHeading(props: FactsCollectionProps & Readonly<{
  kind: SourceProfileFactKind
  titleId: string
}>) {
  const { facts, kind, localization, selectedFactIds, setSelectedFactIds } = props
  const confirmableFacts = facts.filter((fact) => fact.status === 'extracted')
  const allSelected = confirmableFacts.length > 0
    && confirmableFacts.every((fact) => selectedFactIds.has(fact.id))
  return <div className="fact-group-heading">
    <h4 id={props.titleId}>{localization.translate(`sourceProfile.kind.${kind}`)}</h4>
    <span>{facts.length}</span>
    {confirmableFacts.length === 0 ? null : <label className="fact-group-selection">
      <input aria-label={`${localization.translate('sourceProfile.selectAll')} ${
        localization.translate(`sourceProfile.kind.${kind}`)} ${localization.translate('sourceProfile.facts')}`}
        checked={allSelected} onChange={() => {
          setSelectedFactIds((current) => updateFactSelection({
            current,
            factIds: confirmableFacts.map((fact) => fact.id),
            selectionAction: allSelected ? 'deselect' : 'select',
          }))
        }} type="checkbox" />
      <span>{localization.translate('sourceProfile.selectGroup')}</span>
    </label>}
  </div>
}

function FactBatchReview(props: FactsCollectionProps) {
  const { candidateSession, facts, localization, selectedFactIds } = props
  const selectedFacts = facts.filter(
    (fact) => fact.status === 'extracted' && selectedFactIds.has(fact.id),
  )
  if (selectedFacts.length === 0) return null
  const { translate } = localization
  return (
    <div aria-live="polite" className="fact-batch">
      <strong>{readSelectionCount({ count: selectedFacts.length, localization })}</strong>
      <p>{translate('sourceProfile.batchDescription')}</p>
      <ul>{selectedFacts.map((fact) => <li key={fact.id}>{fact.value}</li>)}</ul>
      <button className="secondary-action" type="button" onClick={() => void candidateSession
        .confirmSourceProfileFacts({ factIds: selectedFacts.map((fact) => fact.id) })}>
        {translate('sourceProfile.batchConfirm')} {readSelectionCount({
          count: selectedFacts.length, localization,
        })}
      </button>
    </div>
  )
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
  const { candidateSession, fact, facts, localization, selectedFactIds, setSelectedFactIds } = props
  const conflict = hasSourceProfileFactConflict({ fact, facts })
  return (
    <li aria-live="polite" className={`source-fact source-fact-${fact.status}`}>
      <div className="fact-heading">
        <strong>{localization.translate(`sourceProfile.kind.${fact.kind}`)}</strong>
        <span>{localization.translate(`sourceProfile.status.${fact.status}`)}</span>
      </div>
      <p>{fact.value}</p>
      {fact.status === 'extracted' && !conflict
        ? <label className="fact-selection">
          <input aria-label={`${localization.translate('sourceProfile.selectFact')} ${fact.value}`}
            checked={selectedFactIds.has(fact.id)} onChange={(event) => {
              const selectionAction = event.currentTarget.checked ? 'select' : 'deselect'
              setSelectedFactIds((current) => updateFactSelection({
                current,
                factIds: [fact.id],
                selectionAction,
              }))
            }} type="checkbox" />
          <span>{localization.translate('sourceProfile.select')}</span>
        </label> : null}
      {conflict
        ? <ConflictDecisionActions {...{ candidateSession, factId: fact.id, localization }} />
        : fact.status === 'extracted'
          ? <FactDecisionActions {...{ candidateSession, factId: fact.id, localization }} />
          : null}
      {fact.status === 'verified'
        ? <CorrectionForm {...{ candidateSession, fact, localization }} /> : null}
    </li>
  )
}

function readNonConflictingFacts({ facts, kind, sourceProfile }: Readonly<{
  facts: readonly SourceProfileFact[]
  kind: SourceProfileFactKind
  sourceProfile: SourceProfileReview
}>) {
  return facts.filter((fact) => fact.kind === kind
    && !hasSourceProfileFactConflict({ fact, facts: sourceProfile.facts }))
}

function updateFactSelection({ current, factIds, selectionAction }: Readonly<{
  current: ReadonlySet<SourceProfileFactId>
  factIds: readonly SourceProfileFactId[]
  selectionAction: 'deselect' | 'select'
}>) {
  const next = new Set(current)
  factIds.forEach((factId) => {
    if (selectionAction === 'select') next.add(factId)
    else next.delete(factId)
  })
  return next
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
