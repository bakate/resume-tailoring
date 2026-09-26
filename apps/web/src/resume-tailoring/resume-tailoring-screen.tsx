import type { ResumeTailoringView } from '@resume-tailoring/application/resume-tailoring-workflow'

import { useCandidateSession } from './use-candidate-session'

const workflowSteps = [
  {
    title: 'Source Profile',
    description: 'Use your existing resume or career details as the source of truth.',
  },
  {
    title: 'Job Posting',
    description: 'Add the Job Posting you are targeting so we can identify what to highlight.',
  },
  {
    title: 'Tailored Resume',
    description: 'Review a focused resume based only on your approved facts.',
  },
] as const

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
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Honest Resume home">
        Honest Resume
      </a>
      <p>A more honest way to get hired.</p>
    </header>
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
  return (
    <div className="introduction">
      <h1 id="page-title">Tailor your resume without inventing a thing.</h1>
      <p className="lede">Build a focused resume from facts you have reviewed and approved.</p>
      <StartSessionButton candidateSession={candidateSession} />
      <PrivacyNote />
      <FailureMessage message={candidateSession.failureMessage} />
    </div>
  )
}

function StartSessionButton({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  return (
    <button
      className="primary-action"
      disabled={!candidateSession.isHydrated || candidateSession.view.status === 'ready'}
      onClick={() => void candidateSession.start()}
      type="button"
    >
      <span>Start tailoring</span>
      <ArrowIcon />
    </button>
  )
}

function PrivacyNote() {
  return (
    <p className="privacy-note">
      <LockIcon />
      <span>
        Candidate content you add stays in this browser and expires locally after 24 hours.{' '}
        Downloaded files remain on your device and are outside this automatic expiration.
      </span>
    </p>
  )
}

function FailureMessage({ message }: Readonly<{ message: string | null }>) {
  return message === null ? null : (
    <p className="failure-message" role="alert">
      {message}
    </p>
  )
}

function WorkflowSummary({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  return (
    <div className="workflow-summary">
      <h2>Your workflow</h2>
      <WorkflowStatus view={candidateSession.view} />
      <WorkflowSteps />
      <DeleteSessionButton candidateSession={candidateSession} />
    </div>
  )
}

function WorkflowStatus({ view }: Readonly<{ view: ResumeTailoringView }>) {
  const isReady = view.status === 'ready'
  return (
    <div className="workflow-status" aria-live="polite">
      <span className="status-mark" aria-hidden="true">✓</span>
      <div>
        <strong>{isReady ? 'Workflow opened' : 'Ready to begin'}</strong>
        <p>
          {isReady
            ? 'Your Source Profile is the next step.'
            : 'Click “Start tailoring” to begin your workflow.'}
        </p>
      </div>
    </div>
  )
}

function WorkflowSteps() {
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

function DeleteSessionButton({ candidateSession }: Readonly<{
  candidateSession: CandidateSessionController
}>) {
  if (candidateSession.view.status !== 'ready') return null
  return (
    <button
      className="delete-session-action"
      onClick={() => void candidateSession.delete()}
      type="button"
    >
      Delete private session
    </button>
  )
}

function ValueStrip() {
  return (
    <footer className="value-strip">
      <ValueStatement title="You stay in control" text="Only use information you have reviewed and approved." />
      <ValueStatement title="A more focused story" text="Show the most relevant version of your experience." />
      <ValueStatement title="Built for real opportunities" text="Tailor with confidence, apply with integrity." />
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
