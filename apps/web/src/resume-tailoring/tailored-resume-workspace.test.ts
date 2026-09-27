import { describe, expect, it } from 'vitest'

import { formatResumeClaimText } from './tailored-resume-workspace'

describe('formatResumeClaimText', () => {
  it('separates adjacent words without adding spaces before punctuation', () => {
    expect(formatResumeClaimText({
      segments: [
        { factIds: ['source-fact-experience'], text: 'Built APIs' },
        { factIds: ['source-fact-typescript'], text: 'with TypeScript' },
        { factIds: ['source-fact-typescript'], text: '.' },
      ],
    })).toBe('Built APIs with TypeScript.')
  })
})
