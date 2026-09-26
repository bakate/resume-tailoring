import type { ResumeClaim } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { useState } from 'react'

import type { Localization } from '../localization/localization'
import type { CandidateSessionController } from './use-candidate-session'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>

export function TailoredResumeWorkspace({ candidateSession, localization }: WorkspaceProps) {
  const { view } = candidateSession
  if (view.status !== 'ready' || view.matchAnalysis === undefined) return null
  return (
    <section className="tailored-resume-workspace" aria-labelledby="tailored-resume-title">
      <h2 id="tailored-resume-title">{localization.translate('resumeClaims.title')}</h2>
      {view.tailoredResume === undefined
        ? <GenerationAction {...{ candidateSession, localization }} />
        : <CuratedClaims {...{
            candidateSession,
            claims: view.tailoredResume.claims,
            exclusions: view.tailoredResume.exclusions.length,
            localization,
          }} />}
    </section>
  )
}

function GenerationAction({ candidateSession, localization }: WorkspaceProps) {
  return (
    <div className="source-profile-card">
      <p>{localization.translate('resumeClaims.description')}</p>
      <button className="primary-action compact-action"
        disabled={candidateSession.view.status !== 'ready'
          || candidateSession.view.matchAnalysis?.generationEligibility !== 'eligible'}
        onClick={() => void candidateSession.generateResumeClaims()} type="button">
        {localization.translate('resumeClaims.generate')}
      </button>
    </div>
  )
}

function CuratedClaims({
  candidateSession,
  claims,
  exclusions,
  localization,
}: WorkspaceProps & Readonly<{
  claims: readonly ResumeClaim[]
  exclusions: number
}>) {
  return (
    <div className="resume-claim-list">
      {exclusions === 0 ? null : (
        <p className="match-warning" role="status">
          {localization.translate('resumeClaims.excluded')}
        </p>
      )}
      {claims.length === 0
        ? <p>{localization.translate('resumeClaims.empty')}</p>
        : claims.map((claim, claimIndex) => (
            <ResumeClaimCard key={claim.id} {...{
              candidateSession,
              claim,
              claimIndex,
              claims,
              localization,
            }} />
          ))}
    </div>
  )
}

function ResumeClaimCard({
  candidateSession,
  claim,
  claimIndex,
  claims,
  localization,
}: WorkspaceProps & Readonly<{
  claim: ResumeClaim
  claimIndex: number
  claims: readonly ResumeClaim[]
}>) {
  const [reformulationRequest, setReformulationRequest] = useState('')
  return (
    <article className="source-profile-card resume-claim-card">
      <p className="resume-claim-text">
        {claim.segments.map(({ text }) => text).join('')}
      </p>
      <div className="resume-claim-actions">
        <button disabled={claimIndex === 0}
          onClick={() => {
            reorderClaim({ candidateSession, claimIndex, claims, offset: -1 })
          }}
          type="button">
          {localization.translate('resumeClaims.moveUp')}
        </button>
        <button disabled={claimIndex === claims.length - 1}
          onClick={() => {
            reorderClaim({ candidateSession, claimIndex, claims, offset: 1 })
          }}
          type="button">
          {localization.translate('resumeClaims.moveDown')}
        </button>
        <button onClick={() => void candidateSession.removeResumeClaim({ claimId: claim.id })}
          type="button">
          {localization.translate('resumeClaims.remove')}
        </button>
      </div>
      <form className="reformulation-form" onSubmit={(event) => {
        event.preventDefault()
        void candidateSession.reformulateResumeClaim({
          claimId: claim.id,
          request: reformulationRequest,
        }).then(() => {
          setReformulationRequest('')
        })
      }}>
        <label htmlFor={`reformulate-${claim.id}`}>
          {localization.translate('resumeClaims.reformulationLabel')}
        </label>
        <input id={`reformulate-${claim.id}`} value={reformulationRequest}
          onChange={(event) => {
            setReformulationRequest(event.target.value)
          }} />
        <button disabled={reformulationRequest.trim().length === 0} type="submit">
          {localization.translate('resumeClaims.reformulate')}
        </button>
      </form>
      <p className="claim-editing-note">{localization.translate('resumeClaims.noFreeEdit')}</p>
    </article>
  )
}

function reorderClaim({
  candidateSession,
  claimIndex,
  claims,
  offset,
}: Readonly<{
  candidateSession: CandidateSessionController
  claimIndex: number
  claims: readonly ResumeClaim[]
  offset: -1 | 1
}>) {
  const reorderedClaims = [...claims]
  const [claim] = reorderedClaims.splice(claimIndex, 1)
  if (claim === undefined) return
  reorderedClaims.splice(claimIndex + offset, 0, claim)
  void candidateSession.reorderResumeClaims({
    claimIds: reorderedClaims.map(({ id }) => id),
  })
}
