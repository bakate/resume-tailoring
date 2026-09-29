import type {
  ResumeClaim,
  SourceProfileFactKind,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { sourceProfileFactKinds } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { formatResumeClaimText as formatClaim } from '@resume-tailoring/application/tailored-resume-document'
import type { SyntheticEvent } from 'react'
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
  const unsupportedEdits = useUnsupportedResumeEdits()
  const { view } = candidateSession
  if (view.status !== 'ready' || view.matchAnalysis === undefined) return null
  return (
    <section aria-busy={candidateSession.pendingOperation === 'edit-resume-claim'
      || candidateSession.pendingOperation === 'generate-resume-claims'
      || candidateSession.pendingOperation === 'reformulate-resume-claim'}
      className="tailored-resume-workspace" aria-labelledby="tailored-resume-title">
      <h2 id="tailored-resume-title" tabIndex={-1}>{localization.translate('resumeClaims.title')}</h2>
      <TailoredResumeContent {...{ candidateSession, localization, unsupportedEdits }} />
    </section>
  )
}

function TailoredResumeContent({ candidateSession, localization, unsupportedEdits }: WorkspaceProps
& Readonly<{ unsupportedEdits: ReturnType<typeof useUnsupportedResumeEdits> }>) {
  const { view } = candidateSession
  if (view.status !== 'ready' || view.tailoredResume === undefined) {
    return <GenerationAction {...{ candidateSession, localization }} />
  }
  const exportStatus = unsupportedEdits.claimIds.length > 0 ? 'blocked' : 'ready'
  return <>{exportStatus === 'ready'
    ? <TailoredResumeFlowNavigation {...{ candidateSession, localization }} /> : null}
    <CuratedClaims {...{
      candidateSession, claims: view.tailoredResume.claims,
      exclusions: view.tailoredResume.exclusions.length, localization,
      resumeLocale: view.tailoredResume.locale, clearUnsupportedEdit: unsupportedEdits.clear,
      clearUnsupportedEdits: unsupportedEdits.clearAll,
      reportUnsupportedEdit: unsupportedEdits.report,
    }} />
    <TailoredResumeExport {...{ candidateSession, exportStatus, localization }} />
  </>
}

function TailoredResumeExport({ candidateSession, exportStatus, localization }: WorkspaceProps
& Readonly<{ exportStatus: 'blocked' | 'ready' }>) {
  if (exportStatus === 'blocked') return <p className="match-warning" role="alert">
    {localization.translate('resumeClaims.unsupportedEditBlocksExport')}
  </p>
  return <TailoredResumePreview {...{ candidateSession, localization }} />
}

function useUnsupportedResumeEdits() {
  const [claimIds, setClaimIds] = useState<readonly ResumeClaim['id'][]>([])
  return {
    claimIds,
    clear: (claimId: ResumeClaim['id']) => {
      setClaimIds((currentClaimIds) => currentClaimIds.filter((id) => id !== claimId))
    },
    clearAll: () => { setClaimIds([]) },
    report: (claimId: ResumeClaim['id']) => {
      setClaimIds((currentClaimIds) => currentClaimIds.includes(claimId)
        ? currentClaimIds : [...currentClaimIds, claimId])
    },
  }
}

function TailoredResumeFlowNavigation({ candidateSession, localization }: WorkspaceProps) {
  const feedbackAvailable = candidateSession.view.status === 'ready'
    && candidateSession.view.currentJobPostingStatus === 'pdf-downloaded'
  return (
    <nav aria-label={localization.translate('resumeClaims.flowNavigation')}
      className="tailored-resume-flow-navigation">
      <a href="#resume-claims-list-title">
        {localization.translate('resumeClaims.collectionTitle')}
      </a>
      <a href="#resume-preview-title">{localization.translate('resumePreview.title')}</a>
      <a href="#resume-photo-title">{localization.translate('resumePreview.photoSection')}</a>
      <a href="#resume-export-title">{localization.translate('resumePreview.exportSection')}</a>
      {feedbackAvailable
        ? <a href="#resume-outcome-title">{localization.translate('resumePreview.outcomeSection')}</a>
        : null}
    </nav>
  )
}

function GenerationAction({ candidateSession, localization }: WorkspaceProps) {
  const [locale, setLocale] = usePreferredResumeLocale({ candidateSession, localization })
  return <div className="source-profile-card">
    <p>{localization.translate('resumeClaims.description')}</p>
    <GenerationAvailability {...{ candidateSession, locale, localization, setLocale }} />
  </div>
}

function GenerationAvailability({ candidateSession, locale, localization,
  setLocale }: WorkspaceProps & Readonly<{
  locale: 'en' | 'fr'; setLocale: (locale: 'en' | 'fr') => void
}>) {
  const isEligible = candidateSession.view.status === 'ready'
    && candidateSession.view.matchAnalysis?.generationEligibility === 'eligible'
  if (!isEligible) return <p className="match-warning">
    {localization.translate('matchAnalysis.denied')}
  </p>
  return <ResumeGenerationControls {...{
    candidateSession, confirmReplacement: false,
    label: localization.translate('resumeClaims.generate'), locale,
    localization, onGenerated: ignoreGenerated, setLocale,
  }} />
}

function usePreferredResumeLocale({ candidateSession, localization }: WorkspaceProps) {
  const jobPostingContent = candidateSession.view.status === 'ready'
    ? candidateSession.view.jobPosting?.outgoingContent ?? '' : ''
  return useState(() => readPreferredResumeLocale({
    fallbackLocale: localization.locale, jobPostingContent,
  }))
}

function ResumeGenerationControls({ candidateSession, label, locale, localization, onGenerated,
  confirmReplacement, setLocale }:
WorkspaceProps & Readonly<{
  confirmReplacement: boolean
  label: string
  locale: 'en' | 'fr'
  onGenerated: () => void
  setLocale: (locale: 'en' | 'fr') => void
}>) {
  return <>
    <ResumeLanguageSelector {...{ locale, localization, setLocale }} />
    <button className="primary-action compact-action"
      disabled={candidateSession.pendingOperation !== null}
      onClick={() => void generateResumeClaims({
        candidateSession,
        confirmMessage: localization.translate('resumeClaims.confirmRegeneration'),
        confirmReplacement,
        locale,
        onGenerated,
      })}
      type="button">
      {label}
    </button>
  </>
}

export async function generateResumeClaims({
  candidateSession, confirmMessage, confirmReplacement = false, locale, onGenerated,
}: Readonly<{
  candidateSession: Pick<CandidateSessionController, 'generateResumeClaims'>
  confirmMessage?: string
  confirmReplacement?: boolean
  locale: 'en' | 'fr'
  onGenerated: () => void
}>) {
  if (confirmReplacement && typeof window !== 'undefined'
    && !window.confirm(confirmMessage ?? '')) return
  const result = await candidateSession.generateResumeClaims({ locale })
  if (result.ok) onGenerated()
}

function ignoreGenerated() {}

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

type CuratedClaimsProps = WorkspaceProps & Readonly<{
  claims: readonly ResumeClaim[]
  exclusions: number
  resumeLocale: 'en' | 'fr'
  clearUnsupportedEdit: ResumeClaimCardProps['clearUnsupportedEdit']
  clearUnsupportedEdits: () => void
  reportUnsupportedEdit: ResumeClaimCardProps['reportUnsupportedEdit']
}>

function CuratedClaims(props: CuratedClaimsProps) {
  const { exclusions, localization, resumeLocale } = props
  const [locale, setLocale] = useState(resumeLocale)
  return <section aria-labelledby="resume-claims-list-title">
    <ClaimsHeading {...{ exclusions, localization }} />
    <CuratedGenerationControls {...{ locale, props, setLocale }} />
    <ClaimList {...props} />
  </section>
}

function CuratedGenerationControls({ locale, props, setLocale }: Readonly<{
  locale: 'en' | 'fr'
  props: CuratedClaimsProps
  setLocale: (locale: 'en' | 'fr') => void
}>) {
  const { candidateSession, clearUnsupportedEdits, localization } = props
  return <ResumeGenerationControls {...{
    candidateSession, confirmReplacement: true,
    label: localization.translate('resumeClaims.regenerate'), locale,
    localization, onGenerated: clearUnsupportedEdits, setLocale,
  }} />
}

function ClaimsHeading({ exclusions, localization }: Readonly<{
  exclusions: number
  localization: Localization
}>) {
  return <><h3 id="resume-claims-list-title" tabIndex={-1}>
    {localization.translate('resumeClaims.collectionTitle')}
  </h3>{exclusions === 0 ? null : <p className="match-warning" role="status">
    {localization.translate('resumeClaims.excluded')}
  </p>}</>
}

function ClaimList({ candidateSession, claims, clearUnsupportedEdit, localization,
  reportUnsupportedEdit }: Omit<ResumeClaimCardProps, 'claim' | 'claimIndex'>) {
  if (claims.length === 0) return <p>{localization.translate('resumeClaims.empty')}</p>
  return <><p className="claim-editing-note">{localization.translate('resumeClaims.editingNote')}</p>
    <ol aria-labelledby="resume-claims-list-title" className="resume-claim-list">
      {claims.map((claim, claimIndex) => <ResumeClaimCard key={claim.id} {...{
        candidateSession, claim, claimIndex, claims, clearUnsupportedEdit,
        localization, reportUnsupportedEdit,
      }} />)}
    </ol></>
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
        <ClaimEditForm key={createClaimVersion({ claim })} {...props} />
        <ReformulationForm {...props} />
      </article>
    </li>
  )
}

function ClaimEditForm(props: ResumeClaimCardProps) {
  const { claim } = props
  const [kind, setKind] = useState<SourceProfileFactKind>('experience')
  const [editStatus, setEditStatus] = useState<'ready' | 'confirmation-required'>('ready')
  const [texts, setTexts] = useState<readonly string[]>(claim.segments.map(({ text }) => text))
  return <ClaimEditDisclosure {...{
    ...props, editStatus, kind, setEditStatus, setKind, setTexts, texts,
  }} />
}

type ClaimEditDisclosureProps = ResumeClaimCardProps & Readonly<{
  editStatus: 'ready' | 'confirmation-required'
  kind: SourceProfileFactKind
  setEditStatus: (status: 'ready' | 'confirmation-required') => void
  setKind: (kind: SourceProfileFactKind) => void
  setTexts: (texts: readonly string[]) => void
  texts: readonly string[]
}>

function ClaimEditDisclosure(props: ClaimEditDisclosureProps) {
  const { candidateSession, claimIndex, editStatus, localization, texts } = props
  return <details><summary>{createClaimActionLabel({
    action: localization.translate('resumeClaims.edit'), claimIndex, localization,
  })}</summary><form onSubmit={(event) => { submitClaimEdit({ event, props }) }}>
    <ClaimTextInputs {...props} />
    <button disabled={candidateSession.pendingOperation !== null
      || texts.some((text) => text.trim().length === 0)}
      type="submit">{localization.translate('resumeClaims.saveEdit')}</button>
    {editStatus === 'confirmation-required' ? <ClaimFactConfirmation {...props} /> : null}
  </form></details>
}

function ClaimTextInputs({ claim, localization, setTexts, texts }: ClaimEditDisclosureProps) {
  return texts.map((text, segmentIndex) => <label key={String(segmentIndex)}
    htmlFor={`edit-${claim.id}-${String(segmentIndex)}`}>
    {localization.translate('resumeClaims.edit')}
    <textarea id={`edit-${claim.id}-${String(segmentIndex)}`} value={text}
      onChange={(event) => { setTexts(replaceTextAt({
        segmentIndex, text: event.currentTarget.value, texts,
      })) }} />
  </label>)
}

function submitClaimEdit({ event, props }: Readonly<{
  event: SyntheticEvent<HTMLFormElement>
  props: ClaimEditDisclosureProps
}>) {
  event.preventDefault()
  void attemptClaimEdit(props)
}

async function attemptClaimEdit({ candidateSession, claim, clearUnsupportedEdit,
  reportUnsupportedEdit, setEditStatus, texts }: Readonly<{
  candidateSession: CandidateSessionController
  claim: ResumeClaim
  clearUnsupportedEdit: ResumeClaimCardProps['clearUnsupportedEdit']
  reportUnsupportedEdit: ResumeClaimCardProps['reportUnsupportedEdit']
  setEditStatus: (status: 'ready' | 'confirmation-required') => void
  texts: readonly string[]
}>) {
  const result = await candidateSession.editResumeClaim({ claimId: claim.id, texts })
  const requiresConfirmation = !result.ok
    && result.error.type === 'resume-claim-new-fact-confirmation-required'
  setEditStatus(requiresConfirmation ? 'confirmation-required' : 'ready')
  if (requiresConfirmation) reportUnsupportedEdit(claim.id)
  else clearUnsupportedEdit(claim.id)
}

function ClaimFactConfirmation(props: ClaimEditDisclosureProps) {
  const { candidateSession, claim, clearUnsupportedEdit, kind, localization, setEditStatus } = props
  const text = formatEditedClaimText({ claim, texts: props.texts })
  return <fieldset><legend>{localization.translate('resumeClaims.confirmNewFact')}</legend>
    <FactKindSelector {...props} />
    <button onClick={() => { void confirmClaimEdit({
      candidateSession, claim, clearUnsupportedEdit, kind, setEditStatus, text,
    }) }} type="button">{localization.translate('resumeClaims.confirmAndSave')}</button>
    <button onClick={() => { discardClaimEdit(props) }} type="button">
      {localization.translate('resumeClaims.discardEdit')}
    </button>
  </fieldset>
}

function FactKindSelector({ claim, kind, localization, setKind }: ClaimEditDisclosureProps) {
  return <><label htmlFor={`fact-kind-${claim.id}`}>
    {localization.translate('resumeClaims.factKind')}
  </label><select id={`fact-kind-${claim.id}`} value={kind} onChange={(event) => {
    setKind(event.currentTarget.value as SourceProfileFactKind)
  }}>{sourceProfileFactKinds.map((factKind) => <option key={factKind} value={factKind}>
    {localization.translate(`sourceProfile.kind.${factKind}`)}
  </option>)}</select></>
}

function discardClaimEdit({ claim, clearUnsupportedEdit, setEditStatus,
  setTexts }: ClaimEditDisclosureProps) {
  clearUnsupportedEdit(claim.id)
  setEditStatus('ready')
  setTexts(claim.segments.map((segment) => segment.text))
}

export function formatEditedClaimText({ claim, texts }: Readonly<{
  claim: ResumeClaim
  texts: readonly string[]
}>) {
  const segments = claim.segments.map((segment, segmentIndex) => ({
    ...segment, text: texts[segmentIndex] ?? '',
  }))
  return formatResumeClaimText({ segments })
}

function replaceTextAt({ segmentIndex, text, texts }: Readonly<{
  segmentIndex: number
  text: string
  texts: readonly string[]
}>) {
  return texts.map((currentText, currentIndex) => currentIndex === segmentIndex ? text : currentText)
}

export function createClaimVersion({ claim }: Readonly<{ claim: ResumeClaim }>) {
  return claim.segments.map(({ factIds, text }) => `${factIds.join(',')}:${text}`).join('|')
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
  clearUnsupportedEdit,
  localization,
}: ResumeClaimCardProps) {
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
          clearRequest: () => {
            clearUnsupportedEdit(claim.id)
            setReformulationRequest('')
          },
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
