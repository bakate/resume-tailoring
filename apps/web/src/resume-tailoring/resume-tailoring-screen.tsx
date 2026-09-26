import type { ResumeTailoringView } from '@resume-tailoring/application/resume-tailoring-workflow'
import { createResumeTailoringWorkflow } from '@resume-tailoring/application/resume-tailoring-workflow-composition'
import { useEffect, useState } from 'react'

import {
  createBrowserCandidateSessionPersistence,
  createPrivacySafeBrowserTelemetry,
} from './browser-adapters'

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

export function ResumeTailoringScreen() {
  const [workflow] = useState(() =>
    createResumeTailoringWorkflow({
      candidateSessionPersistence: createBrowserCandidateSessionPersistence(),
      telemetry: createPrivacySafeBrowserTelemetry(),
    }),
  )
  const [view, setView] = useState<ResumeTailoringView>({ status: 'not-started' })
  const [failureMessage, setFailureMessage] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  async function openResumeTailoring() {
    const result = await workflow.execute({ type: 'open-workflow' })
    if (!result.ok) {
      setFailureMessage('The workflow could not be opened. Try again.')
      return
    }

    setView(result.value)
  }

  const isReady = view.status === 'ready'

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="Honest Resume home">
          Honest Resume
        </a>
        <p>A more honest way to get hired.</p>
      </header>

      <section className="workflow-hero" aria-labelledby="page-title">
        <div className="introduction">
          <h1 id="page-title">Tailor your resume without inventing a thing.</h1>
          <p className="lede">Build a focused resume from facts you have reviewed and approved.</p>
          <button
            className="primary-action"
            disabled={!isHydrated || isReady}
            onClick={() => {
              void openResumeTailoring()
            }}
            type="button"
          >
            <span>Start tailoring</span>
            <ArrowIcon />
          </button>
          <p className="privacy-note">
            <LockIcon />
            <span>
              Candidate content you add stays in this browser and expires locally after 24 hours.
            </span>
          </p>
          {failureMessage !== null ? (
            <p className="failure-message" role="alert">
              {failureMessage}
            </p>
          ) : null}
        </div>

        <div className="workflow-summary">
          <h2>Your workflow</h2>
          <div className="workflow-status" aria-live="polite">
            <span className="status-mark" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>{isReady ? 'Workflow opened' : 'Ready to begin'}</strong>
              <p>
                {isReady
                  ? 'Your Source Profile is the next step.'
                  : 'Click “Start tailoring” to begin your workflow.'}
              </p>
            </div>
          </div>
          <ol className="workflow-steps">
            {workflowSteps.map((step, stepIndex) => (
              <li key={step.title}>
                <span className="step-number">{stepIndex + 1}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="value-strip">
        <ValueStatement
          title="You stay in control"
          text="Only use information you have reviewed and approved."
        />
        <ValueStatement
          title="A more focused story"
          text="Show the most relevant version of your experience."
        />
        <ValueStatement
          title="Built for real opportunities"
          text="Tailor with confidence, apply with integrity."
        />
      </footer>
    </main>
  )
}

function ValueStatement({ title, text }: Readonly<{ title: string; text: string }>) {
  return (
    <div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 12h14M14 7l5 5-5 5" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="10" rx="1" width="14" x="5" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}
