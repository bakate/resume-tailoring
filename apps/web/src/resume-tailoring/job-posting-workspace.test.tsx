import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Localization } from '../localization/localization'
import { JobPostingWorkspace } from './job-posting-workspace'
import type { CandidateSessionController } from './use-candidate-session'

describe('JobPostingWorkspace', () => {
  it('shows the extracted target role with its exact source excerpt', () => {
    const html = renderToStaticMarkup(<JobPostingWorkspace
      candidateSession={createCandidateSession()}
      localization={createLocalization()} />)

    expect(html).toContain('Senior FullStack Developer')
    expect(html).toContain('Role: Senior FullStack Developer')
  })
})

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
