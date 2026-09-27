import type { ResumeTailoringView } from '@resume-tailoring/application/resume-tailoring-workflow'
import type { ResumeTailoringCommand } from '@resume-tailoring/application/resume-tailoring-workflow'
import { useEffect, useState } from 'react'

import {
  LocalizationFailure,
  useLocalization,
} from '../localization/localization'
import type { Locale, Localization } from '../localization/localization'
import { useCandidateSession } from './use-candidate-session'
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
    focusWorkflowStep({ step: resultStep })
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
        messageKey={candidateSession.failureMessageKey}
      />
    </div>
  )
}

function StartSessionButton({ candidateSession, localization }: CandidateSessionProps) {
  const { translate } = localization
  return (
    <button
      className="primary-action"
      disabled={!candidateSession.isHydrated || candidateSession.view.status === 'ready'}
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
      <DeleteSessionButton candidateSession={candidateSession} localization={localization} />
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
  requestAnimationFrame(() => { document.getElementById(`${step}-title`)?.focus() })
}

function readRetryOperationMessageKey({ type }: Readonly<{
  type: ResumeTailoringCommand['type']
}>) {
  if (type === 'extract-source-profile') return 'operation.retrySourceProfile' as const
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

function DeleteSessionButton({ candidateSession, localization }: CandidateSessionProps) {
  const { translate } = localization
  if (candidateSession.view.status !== 'ready') return null
  return (
    <button
      className="delete-session-action"
      onClick={() => void candidateSession.delete()}
      type="button"
    >
      {translate('session.delete')}
    </button>
  )
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
  'generate-resume-claims': 'operation.generateResumeClaims',
  'import-source-document': 'operation.importSourceDocument',
  'reformulate-resume-claim': 'operation.reformulateResumeClaim',
} as const
const sourceProfileOperations = new Set<ResumeTailoringCommand['type']>([
  'import-source-document',
  'update-source-content',
  'confirm-processing-notice',
  'extract-source-profile',
  'confirm-source-fact',
  'confirm-source-facts',
  'reject-source-fact',
  'correct-source-fact',
  'resolve-source-fact-conflict',
])
const jobPostingOperations = new Set<ResumeTailoringCommand['type']>([
  'review-job-posting',
  'update-job-posting-content',
  'confirm-job-posting-processing-notice',
  'extract-job-requirements',
])
const resumeOperations = new Set<ResumeTailoringCommand['type']>([
  'generate-resume-claims',
  'remove-resume-claim',
  'move-resume-claim',
  'reformulate-resume-claim',
])
