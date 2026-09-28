import type { ResumeTailoringView } from '@resume-tailoring/application/resume-tailoring-workflow'
import type { ResumeTailoringCommand } from '@resume-tailoring/application/resume-tailoring-workflow'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import {
  LocalizationFailure,
  useLocalization,
} from '../localization/localization'
import type { Locale, Localization } from '../localization/localization'
import {
  isSourceDocumentIntakeFailureMessage,
  useCandidateSession,
} from './use-candidate-session'
import type {
  CandidateSessionController,
  CandidateSessionFailureMessageKey,
} from './use-candidate-session'
import { SourceProfileWorkspace } from './source-profile-workspace'
import { JobPostingWorkspace } from './job-posting-workspace'
import { MatchAnalysisWorkspace } from './match-analysis-workspace'
import { TailoredResumeWorkspace } from './tailored-resume-workspace'

type LocalizationProps = Readonly<{ localization: Localization }>
type CandidateSessionProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>
type WorkflowStepId = 'job-posting' | 'match-analysis' | 'source-profile' | 'tailored-resume'
type WorkflowStepStatus = 'completed' | 'current' | 'unavailable'

export function ResumeTailoringScreen() {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  return <LocalizedResumeTailoringScreen localization={localizationResult.value} />
}

function LocalizedResumeTailoringScreen({ localization }: LocalizationProps) {
  const candidateSession = useCandidateSession()
  const currentStep = readCurrentStep({ view: candidateSession.view })
  const { activeStep, selectStep } = useActiveWorkflowStep({ candidateSession, currentStep })
  return <main className="app-shell">
    <SiteHeader localization={localization} />
    <WorkflowHero {...{ activeStep, candidateSession, currentStep, localization, selectStep }} />
    <OperationFeedback {...{ candidateSession, localization }} />
    <ActiveWorkflowStep {...{ activeStep, candidateSession, localization }} />
    <DeleteSessionControls candidateSession={candidateSession} localization={localization} />
    <ValueStrip localization={localization} />
  </main>
}

function useActiveWorkflowStep({ candidateSession, currentStep }: Readonly<{
  candidateSession: CandidateSessionController
  currentStep: WorkflowStepId
}>) {
  const [activeStep, setActiveStep] = useState<WorkflowStepId>(currentStep)
  useCurrentStepSynchronization({ candidateSession, currentStep, setActiveStep })
  useResultStepSynchronization({ candidateSession, currentStep, setActiveStep })
  return { activeStep, selectStep: (step: WorkflowStepId) => {
    setActiveStep(step)
    focusWorkflowStep({ step })
  } } as const
}

function useCurrentStepSynchronization({ candidateSession, currentStep, setActiveStep }: Readonly<{
  candidateSession: CandidateSessionController
  currentStep: WorkflowStepId
  setActiveStep: (step: WorkflowStepId) => void
}>) {
  useEffect(() => {
    if (candidateSession.completedOperation !== null) return
    setActiveStep(currentStep)
  }, [candidateSession.completedOperation, currentStep])
}

function useResultStepSynchronization({ candidateSession, currentStep, setActiveStep }: Readonly<{
  candidateSession: CandidateSessionController
  currentStep: WorkflowStepId
  setActiveStep: (step: WorkflowStepId) => void
}>) {
  useEffect(() => {
    if (candidateSession.completedOperation === null) return
    const resultStep = readOperationResultStep({
      fallback: currentStep,
      operation: candidateSession.completedOperation.type,
    })
    setActiveStep(resultStep)
    focusOperationResult({ operation: candidateSession.completedOperation.type, step: resultStep })
  }, [candidateSession.completedOperation, currentStep])
}

function SiteHeader({ localization }: LocalizationProps) {
  const { preferencePersistenceError, translate } = localization
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label={translate('brand.homeLabel')}>
        {translate('brand.name')}
      </a>
      <div className="header-tools">
        <p>{translate('brand.tagline')}</p>
        <LocaleSwitcher localization={localization} />
      </div>
      {preferencePersistenceError === null ? null : (
        <p className="locale-failure" role="alert">
          {translate('locale.persistenceFailure')}
        </p>
      )}
    </header>
  )
}

function LocaleSwitcher({ localization }: LocalizationProps) {
  const { locale, selectLocale, translate } = localization
  return (
    <nav className="locale-switcher" aria-label={translate('locale.switcherLabel')}>
      <LocaleButton
        activeLocale={locale}
        label={translate('locale.english')}
        locale="en"
        selectLocale={selectLocale}
      />
      <LocaleButton
        activeLocale={locale}
        label={translate('locale.french')}
        locale="fr"
        selectLocale={selectLocale}
      />
    </nav>
  )
}

type LocaleButtonProps = Readonly<{
  activeLocale: Locale
  label: string
  locale: Locale
  selectLocale: (locale: Locale) => void
}>

function LocaleButton({ activeLocale, label, locale, selectLocale }: LocaleButtonProps) {
  return (
    <button
      aria-pressed={activeLocale === locale}
      onClick={() => {
        selectLocale(locale)
      }}
      type="button"
    >
      {label}
    </button>
  )
}

type WorkflowHeroProps = CandidateSessionProps & Readonly<{
  activeStep: WorkflowStepId
  currentStep: WorkflowStepId
  selectStep: (step: WorkflowStepId) => void
}>

function WorkflowHero(props: WorkflowHeroProps) {
  const { candidateSession, localization } = props
  const heroClassName = candidateSession.view.status === 'ready'
    ? 'workflow-hero workflow-hero-active'
    : 'workflow-hero'
  return (
    <section className={heroClassName} aria-labelledby="page-title">
      <Introduction candidateSession={candidateSession} localization={localization} />
      <WorkflowSummary {...props} />
    </section>
  )
}

function Introduction({ candidateSession, localization }: CandidateSessionProps) {
  const { translate } = localization
  return (
    <div className="introduction">
      <h1 id="page-title">{translate('hero.title')}</h1>
      <p className="lede">{translate('hero.lede')}</p>
      <StartSessionButton candidateSession={candidateSession} localization={localization} />
      <PrivacyNote localization={localization} />
      <FailureMessage
        localization={localization}
        messageKey={readIntroductionFailureMessageKey({ candidateSession })}
      />
    </div>
  )
}

function readIntroductionFailureMessageKey({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const messageKey = candidateSession.failureMessageKey
  const sourceProfile = candidateSession.view.status === 'ready'
    ? candidateSession.view.sourceProfile
    : undefined
  if (sourceProfile !== undefined) return messageKey
  return isSourceDocumentIntakeFailureMessage(messageKey) ? null : messageKey
}

function StartSessionButton({ candidateSession, localization }: CandidateSessionProps) {
  const { translate } = localization
  return (
    <button
      className="primary-action"
      disabled={!candidateSession.isHydrated || candidateSession.view.status === 'ready'}
      id="start-tailoring"
      onClick={() => void candidateSession.start()}
      type="button"
    >
      <span>{translate('session.start')}</span>
      <ArrowIcon />
    </button>
  )
}

function PrivacyNote({ localization }: LocalizationProps) {
  const { translate } = localization
  return (
    <p className="privacy-note">
      <LockIcon />
      <span>{translate('privacy.retention')}</span>
    </p>
  )
}

function FailureMessage({
  localization,
  messageKey,
}: Readonly<{
  localization: Localization
  messageKey: CandidateSessionFailureMessageKey | null
}>) {
  const { translate } = localization
  return messageKey === null ? null : (
    <p className="failure-message" role="alert">
      {translate(messageKey)}
    </p>
  )
}

function WorkflowSummary(props: WorkflowHeroProps) {
  const { candidateSession, localization } = props
  const { translate } = localization
  return (
    <div className="workflow-summary">
      <h2>{translate('workflow.title')}</h2>
      <WorkflowStatus localization={localization} view={candidateSession.view} />
      <WorkflowSteps {...props} />
    </div>
  )
}

function WorkflowStatus({ localization, view }: Readonly<{
  localization: Localization
  view: ResumeTailoringView
}>) {
  const { translate } = localization
  const statusCopy = workflowStatusCopy[view.status]
  return (
    <div className="workflow-status" aria-live="polite">
      <span className="status-mark" aria-hidden="true">✓</span>
      <div>
        <strong>{translate(statusCopy.title)}</strong>
        <p>{translate(statusCopy.description)}</p>
      </div>
    </div>
  )
}

function WorkflowSteps(props: WorkflowHeroProps) {
  const { activeStep, candidateSession, currentStep, localization, selectStep } = props
  const workflowSteps = createWorkflowSteps({ currentStep, localization, view: candidateSession.view })
  return (
    <nav aria-label={localization.translate('workflow.progressLabel')} className="workflow-progress">
      <ol className="workflow-steps">
        {workflowSteps.map((step, stepIndex) => <WorkflowStep
          {...{ activeStep, candidateSession, currentStep, localization, selectStep, step, stepIndex }}
          key={step.id}
        />)}
      </ol>
    </nav>
  )
}

function WorkflowStep({
  activeStep, candidateSession, currentStep, localization, selectStep, step, stepIndex,
}: WorkflowHeroProps & Readonly<{
  step: ReturnType<typeof createWorkflowSteps>[number]
  stepIndex: number
}>) {
  return <li className={`workflow-step workflow-step-${step.status}`}>
    <button aria-current={step.id === currentStep ? 'step' : undefined}
      aria-expanded={step.id === activeStep}
      disabled={candidateSession.view.status !== 'ready' || step.status === 'unavailable'}
      onClick={() => { selectStep(step.id) }} type="button">
      <span className="step-number">{step.status === 'completed' ? '✓' : stepIndex + 1}</span>
      <span className="step-copy"><strong>{step.title}</strong><span>{step.summary}</span></span>
      <span className="step-state">{localization.translate(`workflow.${step.status}`)}</span>
    </button>
  </li>
}

function createWorkflowSteps({ currentStep, localization, view }: Readonly<{
  currentStep: WorkflowStepId
  localization: Localization
  view: ResumeTailoringView
}>) {
  return workflowStepIds.map((id) => ({
    id,
    status: readStepStatus({ currentStep, id, view }),
    summary: readStepSummary({ id, localization, view }),
    title: localization.translate(workflowStepTitleKeys[id]),
  }))
}

function readStepStatus({ currentStep, id, view }: Readonly<{
  currentStep: WorkflowStepId
  id: WorkflowStepId
  view: ResumeTailoringView
}>): WorkflowStepStatus {
  if (isStepCompleted({ id, view })) return 'completed'
  return id === currentStep ? 'current' : 'unavailable'
}

function readCurrentStep({ view }: Readonly<{ view: ResumeTailoringView }>): WorkflowStepId {
  const incompleteStep = workflowStepIds.find((id) => !isStepCompleted({ id, view }))
  return incompleteStep ?? 'tailored-resume'
}

function isStepCompleted({ id, view }: Readonly<{
  id: WorkflowStepId
  view: ResumeTailoringView
}>) {
  if (view.status !== 'ready') return false
  if (id === 'source-profile') return view.sourceProfile?.status === 'reviewing-facts'
    && view.sourceProfile.facts.some((fact) => fact.status === 'verified')
    && view.sourceProfile.facts.every((fact) => fact.status !== 'extracted')
  if (id === 'job-posting') return view.jobPosting?.status === 'reviewing-requirements'
  if (id === 'match-analysis') return view.matchAnalysis !== undefined
  return view.tailoredResume !== undefined
}

function readStepSummary({ id, localization, view }: Readonly<{
  id: WorkflowStepId
  localization: Localization
  view: ResumeTailoringView
}>) {
  if (view.status !== 'ready') return localization.translate(workflowStepDescriptionKeys[id])
  if (id === 'source-profile' && view.sourceProfile?.status === 'reviewing-facts') {
    const verifiedCount = view.sourceProfile.facts.filter((fact) => fact.status === 'verified').length
    return `${String(verifiedCount)} ${localization.translate('workflow.verifiedFacts')}`
  }
  if (id === 'job-posting' && view.jobPosting?.status === 'reviewing-requirements') {
    return `${String(view.jobPosting.requirements.length)} ${localization.translate('workflow.requirements')}`
  }
  if (id === 'match-analysis' && view.matchAnalysis !== undefined) {
    return `${String(view.matchAnalysis.matchScore)}% ${localization.translate('workflow.matchScore')}`
  }
  if (id === 'tailored-resume' && view.tailoredResume !== undefined) {
    return `${String(view.tailoredResume.claims.length)} ${localization.translate('workflow.resumeClaims')}`
  }
  return localization.translate(workflowStepDescriptionKeys[id])
}

function ActiveWorkflowStep({ activeStep, candidateSession, localization }: CandidateSessionProps
  & Readonly<{ activeStep: WorkflowStepId }>) {
  if (candidateSession.view.status !== 'ready') return null
  if (activeStep === 'source-profile') return <SourceProfileWorkspace {...{ candidateSession, localization }} />
  if (activeStep === 'job-posting') return <JobPostingWorkspace {...{ candidateSession, localization }} />
  if (activeStep === 'match-analysis') return <MatchAnalysisWorkspace {...{ candidateSession, localization }} />
  return <TailoredResumeWorkspace {...{ candidateSession, localization }} />
}

function OperationFeedback({ candidateSession, localization }: CandidateSessionProps) {
  const pendingMessage = candidateSession.pendingOperation === null
    ? null
    : localization.translate(pendingOperationMessageKeys[candidateSession.pendingOperation])
  return <div className="operation-feedback" aria-live="polite" role="status">
    {pendingMessage === null ? null : <p>{pendingMessage}</p>}
    {candidateSession.isOperationTakingLong
      ? <p>{localization.translate('operation.stillWorking')}</p> : null}
    {candidateSession.retryCommand === null ? null : (
      <button onClick={() => void candidateSession.retryLastOperation()} type="button">
        {localization.translate(readRetryOperationMessageKey({
          type: candidateSession.retryCommand.type,
        }))}
      </button>
    )}
  </div>
}

function focusWorkflowStep({ step }: Readonly<{ step: WorkflowStepId }>) {
  focusElementById({ elementId: `${step}-title` })
}

function focusOperationResult({ operation, step }: Readonly<{
  operation: ResumeTailoringCommand['type']
  step: WorkflowStepId
}>) {
  if (operation === 'extract-job-requirements') {
    focusElementById({ elementId: 'job-requirements-title' })
    return
  }
  if (operation === 'analyze-match') {
    focusElementById({ elementId: 'match-analysis-summary-title' })
    return
  }
  if (operation === 'generate-resume-claims' || operation === 'reformulate-resume-claim') {
    focusElementById({ elementId: 'resume-claims-list-title' })
    return
  }
  focusWorkflowStep({ step })
}

function focusElementById({ elementId }: Readonly<{ elementId: string }>) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { document.getElementById(elementId)?.focus() })
  })
}

function readRetryOperationMessageKey({ type }: Readonly<{
  type: ResumeTailoringCommand['type']
}>) {
  if (type === 'extract-source-profile'
    || type === 'confirm-processing-and-extract-source-profile') {
    return 'operation.retrySourceProfile' as const
  }
  if (type === 'extract-job-requirements') return 'operation.retryJobPosting' as const
  if (type === 'analyze-match') return 'operation.retryMatchAnalysis' as const
  if (type === 'generate-resume-claims') return 'operation.retryTailoredResume' as const
  return 'operation.retry' as const
}

function readOperationResultStep({ fallback, operation }: Readonly<{
  fallback: WorkflowStepId
  operation: ResumeTailoringCommand['type']
}>): WorkflowStepId {
  if (sourceProfileOperations.has(operation)) return 'source-profile'
  if (jobPostingOperations.has(operation)) return 'job-posting'
  if (operation === 'analyze-match') return 'match-analysis'
  if (resumeOperations.has(operation)) return 'tailored-resume'
  return fallback
}

function DeleteSessionControls({ candidateSession, localization }: CandidateSessionProps) {
  const confirmation = useDeleteSessionConfirmation()
  if (candidateSession.view.status !== 'ready') return null
  return <section className="session-controls"
    aria-label={localization.translate('session.controlsLabel')}>
    <DeleteSessionTrigger {...{ confirmation, localization }} />
    <DeleteSessionDialog {...{ candidateSession, confirmation, localization }} />
  </section>
}

function useDeleteSessionConfirmation() {
  const [confirmationOpen, setConfirmationOpen] = useState(false)
  const confirmationReference = useRef<HTMLDialogElement>(null)
  const triggerReference = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmationOpen) confirmationReference.current?.showModal()
  }, [confirmationOpen])
  return {
    close: () => { confirmationReference.current?.close() },
    confirmationReference,
    open: () => { setConfirmationOpen(true) },
    restoreTriggerFocus: () => {
      setConfirmationOpen(false)
      triggerReference.current?.focus()
    },
    triggerReference,
  } as const
}

type DeleteSessionConfirmation = ReturnType<typeof useDeleteSessionConfirmation>
type DeleteSessionConfirmationProps = CandidateSessionProps & Readonly<{
  confirmation: DeleteSessionConfirmation
}>

function DeleteSessionTrigger({ confirmation, localization }: Omit<
DeleteSessionConfirmationProps, 'candidateSession'>) {
  return <button
    className="delete-session-action"
    onClick={confirmation.open}
    ref={confirmation.triggerReference}
    type="button"
  >{localization.translate('session.delete')}</button>
}

function DeleteSessionDialog({ candidateSession, confirmation, localization }:
DeleteSessionConfirmationProps) {
  return <dialog aria-labelledby="delete-session-title" className="delete-session-dialog"
    onCancel={(event) => {
      event.preventDefault()
      confirmation.close()
    }}
    onClose={confirmation.restoreTriggerFocus}
    onKeyDown={(event) => {
      trapDialogFocus({ dialog: confirmation.confirmationReference.current, event })
    }}
    ref={confirmation.confirmationReference} role="alertdialog">
    <DeleteSessionDescription localization={localization} />
    <DeleteSessionDialogActions {...{ candidateSession, confirmation, localization }} />
  </dialog>
}

function DeleteSessionDescription({ localization }: LocalizationProps) {
  const { translate } = localization
  return <>
    <h2 id="delete-session-title">{translate('session.deleteDialogTitle')}</h2>
    <p>{translate('session.deleteDialogDescription')}</p>
    <p>{translate('session.deleteContentIntro')}</p>
    <ul>{deleteSessionContentKeys.map((key) => <li key={key}>{translate(key)}</li>)}</ul>
  </>
}

function DeleteSessionDialogActions(props: DeleteSessionConfirmationProps) {
  const { candidateSession, confirmation, localization } = props
  return <div className="delete-session-dialog-actions">
    <button autoFocus onClick={confirmation.close} type="button">
      {localization.translate('session.deleteCancel')}
    </button>
    <button className="destructive-action" onClick={() => {
      void deleteCandidateSession({ candidateSession })
    }} type="button">{localization.translate('session.deleteConfirm')}</button>
  </div>
}

async function deleteCandidateSession({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const result = await candidateSession.delete()
  if (result.ok) focusElementById({ elementId: 'start-tailoring' })
}

const deleteSessionContentKeys = [
  'session.deleteSourceDocument', 'session.deleteSourceProfile', 'session.deleteJobPosting',
  'session.deleteMatchAnalysis', 'session.deleteTailoredResume', 'session.deletePhoto',
] as const

function trapDialogFocus({ dialog, event }: Readonly<{
  dialog: HTMLDialogElement | null
  event: ReactKeyboardEvent<HTMLDialogElement>
}>) {
  if (dialog === null || event.key !== 'Tab') return
  const focusableControls = [...dialog.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
  const firstControl = focusableControls[0]
  const lastControl = focusableControls.at(-1)
  if (event.shiftKey && document.activeElement === firstControl) lastControl?.focus()
  else if (!event.shiftKey && document.activeElement === lastControl) firstControl?.focus()
  else return
  event.preventDefault()
}

function ValueStrip({ localization }: LocalizationProps) {
  const { translate } = localization
  return (
    <footer className="value-strip">
      <ValueStatement title={translate('value.controlTitle')} text={translate('value.controlText')} />
      <ValueStatement title={translate('value.focusTitle')} text={translate('value.focusText')} />
      <ValueStatement
        title={translate('value.opportunitiesTitle')}
        text={translate('value.opportunitiesText')}
      />
    </footer>
  )
}

function ValueStatement({ title, text }: Readonly<{ title: string; text: string }>) {
  return <div><strong>{title}</strong><p>{text}</p></div>
}

function ArrowIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12h14M14 7l5 5-5 5" /></svg>
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="10" rx="1" width="14" x="5" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

const workflowStatusCopy = {
  'not-started': {
    title: 'workflow.ready',
    description: 'workflow.readyDescription',
  },
  ready: {
    title: 'workflow.opened',
    description: 'workflow.openedDescription',
  },
} as const

const workflowStepIds = [
  'source-profile',
  'job-posting',
  'match-analysis',
  'tailored-resume',
] as const satisfies readonly WorkflowStepId[]
const workflowStepTitleKeys = {
  'source-profile': 'workflow.sourceProfile',
  'job-posting': 'workflow.jobPosting',
  'match-analysis': 'workflow.matchAnalysis',
  'tailored-resume': 'workflow.tailoredResume',
} as const
const workflowStepDescriptionKeys = {
  'source-profile': 'workflow.sourceProfileDescription',
  'job-posting': 'workflow.jobPostingDescription',
  'match-analysis': 'workflow.matchAnalysisDescription',
  'tailored-resume': 'workflow.tailoredResumeDescription',
} as const
const pendingOperationMessageKeys = {
  'analyze-match': 'operation.analyzeMatch',
  'extract-job-requirements': 'operation.extractJobRequirements',
  'extract-source-profile': 'operation.extractSourceProfile',
  'edit-resume-claim': 'operation.editResumeClaim',
  'generate-resume-claims': 'operation.generateResumeClaims',
  'import-source-document': 'operation.importSourceDocument',
  'reformulate-resume-claim': 'operation.reformulateResumeClaim',
} as const
const sourceProfileOperations = new Set<ResumeTailoringCommand['type']>([
  'import-source-document',
  'update-source-content',
  'confirm-processing-notice',
  'extract-source-profile',
  'reject-source-fact',
  'correct-source-fact',
  'resolve-source-fact-conflict',
])
const jobPostingOperations = new Set<ResumeTailoringCommand['type']>([
  'review-job-posting',
  'update-job-posting-content',
  'update-target-role',
  'confirm-job-posting-processing-notice',
  'extract-job-requirements',
])
const resumeOperations = new Set<ResumeTailoringCommand['type']>([
  'generate-resume-claims',
  'remove-resume-claim',
  'move-resume-claim',
  'reformulate-resume-claim',
])
