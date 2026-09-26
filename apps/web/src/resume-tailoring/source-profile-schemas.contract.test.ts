import { describe, expect, it } from 'vitest'

import {
  extractedSourceProfileFactContentSchema,
  sourceProfileReviewSchema,
  storedCandidateSessionSchema,
} from './source-profile-schemas'

describe('Source Profile boundary schemas', () => {
  it('accepts a valid atomic extracted fact', () => {
    const result = extractedSourceProfileFactContentSchema.safeParse({
      kind: 'skill',
      propositionKey: 'proposition-skill-candidate-typescript',
      value: 'TypeScript',
    })

    expect(result.success).toBe(true)
  })

  it.each([
    ['a mismatched proposition kind', 'experience', 'proposition-skill-candidate-typescript', 'TypeScript'],
    ['a compound value', 'skill', 'proposition-skill-candidate-typescript', 'TypeScript and React'],
  ])('rejects %s', (_caseName, kind, propositionKey, value) => {
    const result = extractedSourceProfileFactContentSchema.safeParse({ kind, propositionKey, value })

    expect(result.success).toBe(false)
  })

  it('rejects malformed persisted identifiers', () => {
    const result = storedCandidateSessionSchema.safeParse({
      status: 'ready',
      sessionId: 'invalid-session-id',
      expiresAt: Date.now(),
    })

    expect(result.success).toBe(false)
  })

  it('rejects malformed nested Source Profile data', () => {
    const result = sourceProfileReviewSchema.safeParse({
      status: 'reviewing-facts',
      documentName: 'resume.pdf',
      detectedSensitiveContent: [],
      outgoingContent: 'TypeScript',
      processingNotice: null,
      facts: [{
        id: 'source-fact-1',
        kind: 'unknown',
        propositionKey: 'proposition-skill-candidate-typescript',
        value: 'TypeScript',
        status: 'verified',
      }],
    })

    expect(result.success).toBe(false)
  })
})
