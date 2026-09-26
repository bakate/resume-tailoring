import type {
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileReview,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  hasSourceProfileFactConflict,
  sourceProfileProcessingNoticeVersion,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { useEffect, useState } from 'react'

import type { Localization } from '../localization/localization'
import type { CandidateSessionController } from './use-candidate-session'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>
type SourceProfileReviewProps = WorkspaceProps & Readonly<{ sourceProfile: SourceProfileReview }>
type FactActionProps = WorkspaceProps & Readonly<{ factId: SourceProfileFactId }>
type ContentRevision = 'changed' | 'saved'

export function SourceProfileWorkspace({ candidateSession, localization }: WorkspaceProps) {
  if (candidateSession.view.status !== 'ready') return null
  const sourceProfile = candidateSession.view.sourceProfile
  return (
    <section className="source-profile-workspace" aria-labelledby="source-profile-title">
      <h2 id="source-profile-title">{localization.translate('sourceProfile.title')}</h2>
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
    <div className="source-profile-grid">
      <SensitiveContentPanel {...{ localization, sourceProfile }} />
      <OutgoingContentPanel {...{
        candidateSession, contentRevision, localization, outgoingContent, setOutgoingContent, sourceProfile,
      }} />
    </div>
  )
}

function SensitiveContentPanel({ localization, sourceProfile }: Omit<SourceProfileReviewProps, 'candidateSession'>) {
  return <div className="source-profile-card">
    <h3>{localization.translate('sourceProfile.detectedTitle')}</h3>
    <SensitiveContentList {...{ localization, sourceProfile }} />
  </div>
}

type OutgoingContentPanelProps = SourceProfileReviewProps & Readonly<{
  contentRevision: ContentRevision
  outgoingContent: string
  setOutgoingContent: (content: string) => void
}>

function OutgoingContentPanel(props: OutgoingContentPanelProps) {
  const { candidateSession, contentRevision, localization, outgoingContent, sourceProfile } = props
  return <div className="source-profile-card source-profile-review">
    <OutgoingContentEditor {...props} />
    <button className="secondary-action" disabled={contentRevision === 'saved'}
      onClick={() => void candidateSession.updateSourceContent({ outgoingContent })} type="button">
      {localization.translate('sourceProfile.saveContent')}
    </button>
    <ProcessingNotice {...{ candidateSession, contentRevision, localization, sourceProfile }} />
  </div>
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
    disabled={confirmationStatus === 'pending' || contentRevision === 'changed'}
    onClick={() => void candidateSession.extractSourceProfile()} type="button">
    {localization.translate('sourceProfile.extract')}
  </button>
}

function SourceProfileFactsReview({ candidateSession, localization, sourceProfile }: SourceProfileReviewProps) {
  const { translate } = localization
  const confirmableFacts = sourceProfile.facts.filter(
    (fact) => fact.status === 'extracted'
      && !hasSourceProfileFactConflict({ fact, facts: sourceProfile.facts }),
  )
  return (
    <div className="source-profile-card">
      <h3>{translate('sourceProfile.factsTitle')}</h3>
      <TransparentBatch {...{ candidateSession, confirmableFacts, localization }} />
      <SourceProfileFactsList {...{ candidateSession, localization, sourceProfile }} />
    </div>
  )
}

function SourceProfileFactsList({ candidateSession, localization, sourceProfile }: SourceProfileReviewProps) {
  return <ul className="source-fact-list">
    {sourceProfile.facts.map((fact) => <SourceProfileFactCard
      {...{ candidateSession, fact, facts: sourceProfile.facts, localization }} key={fact.id} />)}
  </ul>
}

function TransparentBatch({ candidateSession, confirmableFacts, localization }:
WorkspaceProps & Readonly<{ confirmableFacts: readonly SourceProfileFact[] }>) {
  if (confirmableFacts.length < 2) return null
  const { translate } = localization
  return (
    <details className="fact-batch">
      <summary>{translate('sourceProfile.batchTitle')} ({confirmableFacts.length})</summary>
      <p>{translate('sourceProfile.batchDescription')}</p>
      <ul>{confirmableFacts.map((fact) => <li key={fact.id}>{fact.value}</li>)}</ul>
      <button className="secondary-action" type="button" onClick={() => void candidateSession
        .confirmSourceProfileFacts({ factIds: confirmableFacts.map((fact) => fact.id) })}>
        {translate('sourceProfile.batchConfirm')}
      </button>
    </details>
  )
}

type SourceProfileFactCardProps = WorkspaceProps & Readonly<{
  fact: SourceProfileFact
  facts: readonly SourceProfileFact[]
}>

function SourceProfileFactCard({ candidateSession, fact, facts, localization }: SourceProfileFactCardProps) {
  const conflict = hasSourceProfileFactConflict({ fact, facts })
  return (
    <li className={`source-fact source-fact-${fact.status}`}>
      <div className="fact-heading">
        <strong>{localization.translate(`sourceProfile.kind.${fact.kind}`)}</strong>
        <span>{localization.translate(`sourceProfile.status.${fact.status}`)}</span>
      </div>
      <p>{fact.value}</p>
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
  )
}
