import type { ResumeTailoringView } from '@resume-tailoring/application/resume-tailoring-workflow'

import { useLocalization } from '../localization/localization'
import type { Locale } from '../localization/localization'
import { useCandidateSession } from './use-candidate-session'
import type { CandidateSessionFailureMessageKey } from './use-candidate-session'

type CandidateSessionController = ReturnType<typeof useCandidateSession>

export function ResumeTailoringScreen() {
  const candidateSession = useCandidateSession()
  return (
    <main className="app-shell">
      <SiteHeader />
      <WorkflowHero candidateSession={candidateSession} />
      <ValueStrip />
    </main>
  )
}

function SiteHeader() {
  const { preferencePersistenceError, translate } = useLocalization()
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label={translate('brand.homeLabel')}>
        {translate('brand.name')}
      </a>
      <div className="header-tools">
        <p>{translate('brand.tagline')}</p>
        <LocaleSwitcher />
      </div>
      {preferencePersistenceError === null ? null : (
        <p className="locale-failure" role="alert">
          {translate('locale.persistenceFailure')}
        </p>
      )}
    </header>
  )
}

function LocaleSwitcher() {
  const { locale, selectLocale, translate } = useLocalization()
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

function WorkflowHero({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  return (
    <section className="workflow-hero" aria-labelledby="page-title">
      <Introduction candidateSession={candidateSession} />
      <WorkflowSummary candidateSession={candidateSession} />
    </section>
  )
}

function Introduction({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const { translate } = useLocalization()
  return (
    <div className="introduction">
      <h1 id="page-title">{translate('hero.title')}</h1>
      <p className="lede">{translate('hero.lede')}</p>
      <StartSessionButton candidateSession={candidateSession} />
      <PrivacyNote />
      <FailureMessage messageKey={candidateSession.failureMessageKey} />
    </div>
  )
}

function StartSessionButton({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const { translate } = useLocalization()
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

function PrivacyNote() {
  const { translate } = useLocalization()
  return (
    <p className="privacy-note">
      <LockIcon />
      <span>{translate('privacy.retention')}</span>
    </p>
  )
}

function FailureMessage({
  messageKey,
}: Readonly<{ messageKey: CandidateSessionFailureMessageKey | null }>) {
  const { translate } = useLocalization()
  return messageKey === null ? null : (
    <p className="failure-message" role="alert">
      {translate(messageKey)}
    </p>
  )
}

function WorkflowSummary({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const { translate } = useLocalization()
  return (
    <div className="workflow-summary">
      <h2>{translate('workflow.title')}</h2>
      <WorkflowStatus view={candidateSession.view} />
      <WorkflowSteps />
      <DeleteSessionButton candidateSession={candidateSession} />
    </div>
  )
}

function WorkflowStatus({ view }: Readonly<{ view: ResumeTailoringView }>) {
  const { translate } = useLocalization()
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

function WorkflowSteps() {
  const { translate } = useLocalization()
  const workflowSteps = createWorkflowSteps({ translate })
  return (
    <ol className="workflow-steps">
      {workflowSteps.map((step, stepIndex) => (
        <li key={step.title}>
          <span className="step-number">{stepIndex + 1}</span>
          <div><h3>{step.title}</h3><p>{step.description}</p></div>
        </li>
      ))}
    </ol>
  )
}

function createWorkflowSteps({ translate }: Readonly<{
  translate: ReturnType<typeof useLocalization>['translate']
}>) {
  return [
    createWorkflowStep({ translate, name: 'sourceProfile' }),
    createWorkflowStep({ translate, name: 'jobPosting' }),
    createWorkflowStep({ translate, name: 'tailoredResume' }),
  ] as const
}

type WorkflowStepName = 'jobPosting' | 'sourceProfile' | 'tailoredResume'

function createWorkflowStep({ translate, name }: Readonly<{
  translate: ReturnType<typeof useLocalization>['translate']
  name: WorkflowStepName
}>) {
  return {
    title: translate(`workflow.${name}`),
    description: translate(`workflow.${name}Description`),
  }
}

function DeleteSessionButton({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  const { translate } = useLocalization()
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

function ValueStrip() {
  const { translate } = useLocalization()
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
