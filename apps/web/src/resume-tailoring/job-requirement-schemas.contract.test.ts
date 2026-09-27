import { describe, expect, it } from 'vitest'

import { jobPostingReviewSchema } from './job-requirement-schemas'

describe('browser-local Job Posting Review contract', () => {
  it('restores a source-backed target role from browser-local state', () => {
    const result = jobPostingReviewSchema.safeParse({
      status: 'reviewing-requirements',
      detectedSensitiveContent: [],
      outgoingContent: 'Role: Senior FullStack Developer',
      processingNotice: null,
      targetRole: {
        sourceExcerpt: 'Role: Senior FullStack Developer',
        value: 'Senior FullStack Developer',
      },
      requirements: [],
    })

    expect(result.success ? result.data.targetRole : null).toEqual({
      sourceExcerpt: 'Role: Senior FullStack Developer',
      value: 'Senior FullStack Developer',
    })
  })

  it('rejects an invented target role value from browser-local state', () => {
    const result = jobPostingReviewSchema.safeParse({
      status: 'reviewing-requirements',
      detectedSensitiveContent: [],
      outgoingContent: 'Role: Senior FullStack Developer',
      processingNotice: null,
      targetRole: {
        sourceExcerpt: 'Role: Senior FullStack Developer',
        value: 'Chief Technology Officer',
      },
      requirements: [],
    })

    expect(result.success).toBe(false)
  })

  it('rejects a target role excerpt absent from the reviewed Job Posting', () => {
    const result = jobPostingReviewSchema.safeParse({
      status: 'reviewing-requirements',
      detectedSensitiveContent: [],
      outgoingContent: 'TypeScript is required.',
      processingNotice: null,
      targetRole: {
        sourceExcerpt: 'Chief Technology Officer',
        value: 'Chief Technology Officer',
      },
      requirements: [],
    })

    expect(result.success).toBe(false)
  })
})
