import type {
  ResumeClaim,
  SourceProfileFactKind,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { sourceProfileFactKinds } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { formatResumeClaimText as formatClaim } from '@resume-tailoring/application/tailored-resume-document'
import { useState } from 'react'

import type { Localization } from '../localization/localization'
import { TailoredResumePreview } from './tailored-resume-preview'
import type { CandidateSessionController } from './use-candidate-session'
import { readPreferredResumeLocale } from './resume-language'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>

type ResumeClaimCardProps = WorkspaceProps & Readonly<{
  claim: ResumeClaim
  claimIndex: number
  claims: readonly ResumeClaim[]
  clearUnsupportedEdit: (claimId: ResumeClaim['id']) => void
  reportUnsupportedEdit: (claimId: ResumeClaim['id']) => void
}>
type ResumeClaimReformulator = Pick<CandidateSessionController, 'reformulateResumeClaim'>

export function formatResumeClaimText({ segments }: Readonly<{
  segments: ResumeClaim['segments']
}>) {
  return formatClaim({ segments })
}

export function TailoredResumeWorkspace({ candidateSession, localization }: WorkspaceProps) {
  const [unsupportedEditClaimIds, setUnsupportedEditClaimIds] = useState<readonly ResumeClaim['id'][]>([])
  const { view } = candidateSession
  if (view.status !== 'ready' || view.matchAnalysis === undefined) return null
  return (
    <section aria-busy={candidateSession.pendingOperation === 'edit-resume-claim'
      || candidateSession.pendingOperation === 'generate-resume-claims'
      || candidateSession.pendingOperation === 'reformulate-resume-claim'}
      className="tailored-resume-workspace" aria-labelledby="tailored-resume-title">
      <h2 id="tailored-resume-title" tabIndex={-1}>{localization.translate('resumeClaims.title')}</h2>
      {view.tailoredResume === undefined
        ? <GenerationAction {...{ candidateSession, localization }} />
        : <>
            {unsupportedEditClaimIds.length === 0
              ? <TailoredResumeFlowNavigation localization={localization} /> : null}
            <CuratedClaims {...{
              candidateSession,
              claims: view.tailoredResume.claims,
              exclusions: view.tailoredResume.exclusions.length,
              localization,
              resumeLocale: view.tailoredResume.locale,
              clearUnsupportedEdit: (claimId: ResumeClaim['id']) => {
                setUnsupportedEditClaimIds((claimIds) => claimIds.filter((id) => id !== claimId))
              },
              reportUnsupportedEdit: (claimId: ResumeClaim['id']) => {
                setUnsupportedEditClaimIds((claimIds) => claimIds.includes(claimId)
                  ? claimIds : [...claimIds, claimId])
              },
            }} />
            {unsupportedEditClaimIds.length === 0
              ? <TailoredResumePreview {...{ candidateSession, localization }} />
              : <p className="match-warning" role="alert">
                {localization.translate('resumeClaims.unsupportedEditBlocksExport')}
              </p>}
          </>}
    </section>
  )
}

function TailoredResumeFlowNavigation({ localization }: Readonly<{
  localization: Localization
}>) {
  return (
    <nav aria-label={localization.translate('resumeClaims.flowNavigation')}
      className="tailored-resume-flow-navigation">
      <a href="#resume-claims-list-title">
        {localization.translate('resumeClaims.collectionTitle')}
      </a>
      <a href="#resume-preview-title">{localization.translate('resumePreview.title')}</a>
      <a href="#resume-photo-title">{localization.translate('resumePreview.photoSection')}</a>
      <a href="#resume-outcome-title">{localization.translate('resumePreview.outcomeSection')}</a>
      <a href="#resume-export-title">{localization.translate('resumePreview.exportSection')}</a>
    </nav>
  )
}

function GenerationAction({ candidateSession, localization }: WorkspaceProps) {
  const isEligible = candidateSession.view.status === 'ready'
    && candidateSession.view.matchAnalysis?.generationEligibility === 'eligible'
  const jobPostingContent = candidateSession.view.status === 'ready'
    ? candidateSession.view.jobPosting?.outgoingContent ?? '' : ''
  const [locale, setLocale] = useState(() => readPreferredResumeLocale({
    fallbackLocale: localization.locale,
    jobPostingContent,
  }))
  return (
    <div className="source-profile-card">
      <p>{localization.translate('resumeClaims.description')}</p>
      {isEligible ? (
        <ResumeGenerationControls {...{
          candidateSession,
          label: localization.translate('resumeClaims.generate'),
          locale,
          localization,
          setLocale,
        }} />
      ) : <p className="match-warning">{localization.translate('matchAnalysis.denied')}</p>}
    </div>
  )
}

function ResumeGenerationControls({ candidateSession, label, locale, localization, setLocale }:
WorkspaceProps & Readonly<{
  label: string
  locale: 'en' | 'fr'
  setLocale: (locale: 'en' | 'fr') => void
}>) {
  return <>
    <ResumeLanguageSelector {...{ locale, localization, setLocale }} />
    <button className="primary-action compact-action"
      disabled={candidateSession.pendingOperation !== null}
      onClick={() => void candidateSession.generateResumeClaims({ locale })} type="button">
      {label}
    </button>
  </>
}

function ResumeLanguageSelector({ locale, localization, setLocale }: Readonly<{
  locale: 'en' | 'fr'
  localization: Localization
  setLocale: (locale: 'en' | 'fr') => void
}>) {
  return <fieldset><legend>{localization.translate('resumeClaims.languageLegend')}</legend>
    {(['en', 'fr'] as const).map((optionLocale) => <label key={optionLocale}>
      <input checked={locale === optionLocale} name="resume-language"
        onChange={() => { setLocale(optionLocale) }} type="radio" value={optionLocale} />
      {localization.translate(optionLocale === 'en' ? 'locale.english' : 'locale.french')}
    </label>)}
  </fieldset>
}

function CuratedClaims({
  candidateSession,
  claims,
  exclusions,
  localization,
  resumeLocale,
  clearUnsupportedEdit,
  reportUnsupportedEdit,
}: WorkspaceProps & Readonly<{
  claims: readonly ResumeClaim[]
  exclusions: number
  resumeLocale: 'en' | 'fr'
  clearUnsupportedEdit: ResumeClaimCardProps['clearUnsupportedEdit']
  reportUnsupportedEdit: ResumeClaimCardProps['reportUnsupportedEdit']
}>) {
  const [locale, setLocale] = useState(resumeLocale)
  return (
    <section aria-labelledby="resume-claims-list-title">
      <h3 id="resume-claims-list-title" tabIndex={-1}>
        {localization.translate('resumeClaims.collectionTitle')}
      </h3>
      {exclusions === 0 ? null : (
        <p className="match-warning" role="status">
          {localization.translate('resumeClaims.excluded')}
        </p>
      )}
      <ResumeGenerationControls {...{
        candidateSession,
        label: localization.translate('resumeClaims.regenerate'),
        locale,
        localization,
        setLocale,
      }} />
      <p className="claim-editing-note">{localization.translate('resumeClaims.editingNote')}</p>
      {claims.length === 0
        ? <p>{localization.translate('resumeClaims.empty')}</p>
        : <ol aria-labelledby="resume-claims-list-title" className="resume-claim-list">
          {claims.map((claim, claimIndex) => (
            <ResumeClaimCard key={claim.id} {...{
              candidateSession,
              claim,
              claimIndex,
              claims,
              clearUnsupportedEdit,
              localization,
              reportUnsupportedEdit,
            }} />
          ))}
        </ol>}
    </section>
  )
}

function ResumeClaimCard(props: ResumeClaimCardProps) {
  const { claim, claimIndex, localization } = props
  const claimLabel = createResumeClaimLabel({ claimIndex, localization })
  return (
    <li>
      <article aria-label={claimLabel} className="source-profile-card resume-claim-card">
        <span className="resume-claim-position">{claimLabel}</span>
        <p className="resume-claim-text">
          {formatResumeClaimText({ segments: claim.segments })}
        </p>
        <ClaimActions {...props} />
        <ClaimEditForm {...props} />
        <ReformulationForm {...props} />
      </article>
    </li>
  )
}

function ClaimEditForm({ candidateSession, claim, claimIndex, clearUnsupportedEdit, localization,
  reportUnsupportedEdit }: ResumeClaimCardProps) {
  const [kind, setKind] = useState<SourceProfileFactKind>('experience')
  const [editStatus, setEditStatus] = useState<'ready' | 'confirmation-required'>('ready')
  const [text, setText] = useState(formatResumeClaimText({ segments: claim.segments }))
  return <details><summary>{createClaimActionLabel({
    action: localization.translate('resumeClaims.edit'), claimIndex, localization,
  })}</summary><form onSubmit={(event) => {
    event.preventDefault()
    void attemptClaimEdit({
      candidateSession, claim, clearUnsupportedEdit, reportUnsupportedEdit,
      setEditStatus, text,
    })
  }}>
    <label htmlFor={`edit-${claim.id}`}>{localization.translate('resumeClaims.edit')}</label>
    <textarea id={`edit-${claim.id}`} value={text}
      onChange={(event) => { setText(event.currentTarget.value) }} />
    <button disabled={candidateSession.pendingOperation !== null || text.trim().length === 0}
      type="submit">{localization.translate('resumeClaims.saveEdit')}</button>
    {editStatus === 'confirmation-required' ? <ClaimFactConfirmation {...{
      candidateSession, claim, clearUnsupportedEdit, kind, localization, setKind,
      setEditStatus, setText, text,
    }} /> : null}
  </form></details>
}

async function attemptClaimEdit({ candidateSession, claim, clearUnsupportedEdit,
  reportUnsupportedEdit, setEditStatus, text }: Readonly<{
  candidateSession: CandidateSessionController
  claim: ResumeClaim
  clearUnsupportedEdit: ResumeClaimCardProps['clearUnsupportedEdit']
  reportUnsupportedEdit: ResumeClaimCardProps['reportUnsupportedEdit']
  setEditStatus: (status: 'ready' | 'confirmation-required') => void
  text: string
}>) {
  const result = await candidateSession.editResumeClaim({ claimId: claim.id, text })
  const requiresConfirmation = !result.ok
    && result.error.type === 'resume-claim-new-fact-confirmation-required'
  setEditStatus(requiresConfirmation ? 'confirmation-required' : 'ready')
  if (requiresConfirmation) reportUnsupportedEdit(claim.id)
  else clearUnsupportedEdit(claim.id)
}

function ClaimFactConfirmation({ candidateSession, claim, clearUnsupportedEdit, kind, localization,
  setEditStatus, setKind, setText, text }: Readonly<{
  candidateSession: CandidateSessionController
  claim: ResumeClaim
  clearUnsupportedEdit: ResumeClaimCardProps['clearUnsupportedEdit']
  kind: SourceProfileFactKind
  localization: Localization
  setEditStatus: (status: 'ready' | 'confirmation-required') => void
  setKind: (kind: SourceProfileFactKind) => void
  setText: (text: string) => void
  text: string
}>) {
  return <fieldset><legend>{localization.translate('resumeClaims.confirmNewFact')}</legend>
    <label htmlFor={`fact-kind-${claim.id}`}>{localization.translate('resumeClaims.factKind')}</label>
    <select id={`fact-kind-${claim.id}`} value={kind} onChange={(event) => {
      setKind(event.currentTarget.value as SourceProfileFactKind)
    }}>{sourceProfileFactKinds.map((factKind) => <option key={factKind} value={factKind}>
      {localization.translate(`sourceProfile.kind.${factKind}`)}
    </option>)}</select>
    <button onClick={() => { void confirmClaimEdit({
      candidateSession, claim, clearUnsupportedEdit, kind, setEditStatus, text,
    }) }} type="button">{localization.translate('resumeClaims.confirmAndSave')}</button>
    <button onClick={() => {
      clearUnsupportedEdit(claim.id)
      setEditStatus('ready')
      setText(formatResumeClaimText({ segments: claim.segments }))
    }} type="button">{localization.translate('resumeClaims.discardEdit')}</button>
  </fieldset>
}

async function confirmClaimEdit({ candidateSession, claim, clearUnsupportedEdit, kind,
  setEditStatus, text }: Readonly<{
  candidateSession: CandidateSessionController
  claim: ResumeClaim
  clearUnsupportedEdit: ResumeClaimCardProps['clearUnsupportedEdit']
  kind: SourceProfileFactKind
  setEditStatus: (status: 'ready' | 'confirmation-required') => void
  text: string
}>) {
  const result = await candidateSession.confirmResumeClaimEdit({ claimId: claim.id, kind, text })
  if (!result.ok) return
  clearUnsupportedEdit(claim.id)
  setEditStatus('ready')
}

function ClaimActions(props: ResumeClaimCardProps) {
  const { candidateSession, claim, localization } = props
  return (
    <div className="resume-claim-actions">
      <MoveClaimButton {...props} direction="up" />
      <MoveClaimButton {...props} direction="down" />
      <button aria-label={createClaimActionLabel({
        action: localization.translate('resumeClaims.remove'),
        claimIndex: props.claimIndex,
        localization,
      })} disabled={candidateSession.pendingOperation !== null}
        onClick={() => { void removeResumeClaim({
          candidateSession,
          claim,
          clearUnsupportedEdit: props.clearUnsupportedEdit,
        }) }}
        type="button">
        {localization.translate('resumeClaims.remove')}
      </button>
    </div>
  )
}

async function removeResumeClaim({ candidateSession, claim, clearUnsupportedEdit }: Readonly<{
  candidateSession: CandidateSessionController
  claim: ResumeClaim
  clearUnsupportedEdit: ResumeClaimCardProps['clearUnsupportedEdit']
}>) {
  const result = await candidateSession.removeResumeClaim({ claimId: claim.id })
  if (result.ok) clearUnsupportedEdit(claim.id)
}

function MoveClaimButton(props: ResumeClaimCardProps & Readonly<{ direction: 'up' | 'down' }>) {
  const { candidateSession, claim, claimIndex, claims, direction, localization } = props
  const reachedBoundary = direction === 'up' ? claimIndex === 0 : claimIndex === claims.length - 1
  return (
    <button aria-label={createClaimActionLabel({
      action: localization.translate(direction === 'up'
        ? 'resumeClaims.moveUp' : 'resumeClaims.moveDown'),
      claimIndex,
      localization,
    })} disabled={reachedBoundary || candidateSession.pendingOperation !== null}
      onClick={() => void candidateSession.moveResumeClaim({ claimId: claim.id, direction })}
      type="button">
      {localization.translate(direction === 'up' ? 'resumeClaims.moveUp' : 'resumeClaims.moveDown')}
    </button>
  )
}

function ReformulationForm({
  candidateSession,
  claim,
  claimIndex,
  localization,
}: WorkspaceProps & Readonly<{ claim: ResumeClaim; claimIndex: number }>) {
  const [reformulationRequest, setReformulationRequest] = useState('')
  return (
    <details className="reformulation-disclosure">
      <summary>{createClaimActionLabel({
        action: localization.translate('resumeClaims.reformulationLabel'),
        claimIndex,
        localization,
      })}</summary>
      <form className="reformulation-form" onSubmit={(event) => {
        event.preventDefault()
        void submitReformulation({
          candidateSession,
          claim,
          clearRequest: () => { setReformulationRequest('') },
          reformulationRequest,
        })
      }}>
        <label htmlFor={`reformulate-${claim.id}`}>
          {localization.translate('resumeClaims.reformulationLabel')}
        </label>
        <input id={`reformulate-${claim.id}`} value={reformulationRequest}
          onChange={(event) => {
            setReformulationRequest(event.target.value)
          }} />
        <button disabled={candidateSession.pendingOperation !== null
          || reformulationRequest.trim().length === 0} type="submit">
          {localization.translate('resumeClaims.reformulate')}
        </button>
      </form>
    </details>
  )
}

function createClaimActionLabel({ action, claimIndex, localization }: Readonly<{
  action: string
  claimIndex: number
  localization: Localization
}>) {
  return `${action} — ${createResumeClaimLabel({ claimIndex, localization })}`
}

function createResumeClaimLabel({ claimIndex, localization }: Readonly<{
  claimIndex: number
  localization: Localization
}>) {
  return `${localization.translate('resumeClaims.claimLabel')} ${String(claimIndex + 1)}`
}

export async function submitReformulation({
  candidateSession,
  claim,
  clearRequest,
  reformulationRequest,
}: Readonly<{
  candidateSession: ResumeClaimReformulator
  claim: ResumeClaim
  clearRequest: () => void
  reformulationRequest: string
}>) {
  const result = await candidateSession.reformulateResumeClaim({
    claimId: claim.id,
    request: reformulationRequest,
  })
  if (result.ok) clearRequest()
  return result
}
