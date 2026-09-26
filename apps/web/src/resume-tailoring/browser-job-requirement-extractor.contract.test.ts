import { describe, expect, it } from 'vitest'

import { createBrowserJobRequirementExtractor } from './browser-adapters'

describe('browser Job Requirement extractor contract', () => {
  it('maps network failures to a typed recoverable transport failure', async () => {
    const extractor = createBrowserJobRequirementExtractor({
      request: () => Promise.reject(new TypeError('Network unavailable')),
    })

    const result = await extractor.extract({ jobPostingContent: 'TypeScript is required.' })

    expect(result).toEqual({
      ok: false,
      error: { type: 'job-requirement-transport-unavailable' },
    })
  })

  it('preserves a typed extraction failure returned by the server', async () => {
    const extractor = createBrowserJobRequirementExtractor({
      request: () => Promise.resolve(Response.json({
        ok: false,
        error: { type: 'job-requirement-extraction-unavailable' },
      }, { status: 502 })),
    })

    const result = await extractor.extract({ jobPostingContent: 'TypeScript is required.' })

    expect(result).toEqual({
      ok: false,
      error: { type: 'job-requirement-extraction-unavailable' },
    })
  })
})
