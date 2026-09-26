import { describe, expect, it } from 'vitest'

import { createBrowserMatchEvidenceMatcher } from './browser-adapters'

describe('browser Match Evidence matcher contract', () => {
  it('maps network failures to a typed recoverable transport failure', async () => {
    const matcher = createBrowserMatchEvidenceMatcher({
      request: () => Promise.reject(new TypeError('Network unavailable')),
    })

    const result = await matcher.match({ requirements: [], verifiedFacts: [] })

    expect(result).toEqual({
      ok: false,
      error: { type: 'match-analysis-transport-unavailable' },
    })
  })
})
