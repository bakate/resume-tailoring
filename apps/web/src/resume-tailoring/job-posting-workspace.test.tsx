import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Localization } from '../localization/localization'
import { JobPostingWorkspace } from './job-posting-workspace'
import type { CandidateSessionController } from './use-candidate-session'

describe('JobPostingWorkspace', () => {
  it('offers pasted text and PDF or TXT upload through one analysis action', () => {
    const html = renderToStaticMarkup(<JobPostingWorkspace
      candidateSession={createCandidateSessionWithoutJobPosting()}
      localization={createLocalization()} />)

    expect(html).toContain('jobPosting.analyze')
    expect(html).toContain('type="file"')
    expect(html).toContain('accept="application/pdf,text/plain,.pdf,.txt"')
  })

  it('shows the extracted target role with its exact source excerpt', () => {
    const html = renderToStaticMarkup(<JobPostingWorkspace
      candidateSession={createCandidateSession()}
      localization={createLocalization()} />)

    expect(html).toContain('Senior FullStack Developer')
    expect(html).toContain('Role: Senior FullStack Developer')
  })

  it('offers an exact-source Target Role correction', () => {
    const html = renderToStaticMarkup(<JobPostingWorkspace
      candidateSession={createCandidateSession()}
      localization={createLocalization()} />)

    expect(html).toContain('jobPosting.targetRoleEdit')
    expect(html).toContain('value="Senior FullStack Developer"')
    expect(html).toContain('jobPosting.targetRoleSave')
  })
})

function createCandidateSessionWithoutJobPosting() {
  return {
    view: {
      status: 'ready',
      sessionId: 'candidate-session-test',
      expiresAt: 1,
    },
  } as unknown as CandidateSessionController
}

function createCandidateSession() {
  return {
    view: {
      status: 'ready',
      sessionId: 'candidate-session-test',
      expiresAt: 1,
      jobPosting: {
        status: 'reviewing-requirements',
        detectedSensitiveContent: [],
        outgoingContent: 'Role: Senior FullStack Developer',
        practicalConstraints: [],
        processingNotice: null,
        targetRole: {
          sourceExcerpt: 'Role: Senior FullStack Developer',
          value: 'Senior FullStack Developer',
        },
        requirements: [],
      },
    },
  } as unknown as CandidateSessionController
}

function createLocalization(): Localization {
  return {
    locale: 'en',
    preferencePersistenceError: null,
    readiness: 'ready',
    selectLocale: () => undefined,
    translate: (key) => key,
  }
}
