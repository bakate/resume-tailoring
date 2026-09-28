import { describe, expect, it } from 'vitest'

import { createBrowserJobRequirementExtractor } from './browser-adapters'

describe('browser Job Requirement extractor contract', () => {
  it('carries a source-backed target role from the server into browser-local state', async () => {
    const targetRole = 'Senior FullStack Developer'
    const extractor = createBrowserJobRequirementExtractor({
      request: () => Promise.resolve(Response.json({
        ok: true,
        value: {
          targetRole: { sourceExcerpt: targetRole, value: targetRole },
          practicalConstraints: [],
          requirements: [],
        },
      })),
    })

    const result = await extractor.extract({ jobPostingContent: `Role: ${targetRole}` })

    expect(result).toEqual({
      ok: true,
      value: {
        targetRole: { sourceExcerpt: targetRole, value: targetRole },
        practicalConstraints: [],
        requirements: [],
      },
    })
  })

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

  it.each([
    ['invented classification', {
      classification: 'mandatory',
      sourceExcerpt: 'TypeScript is required.',
      value: 'Know TypeScript',
    }],
    ['invented source excerpt', {
      classification: 'required',
      sourceExcerpt: 'React is required.',
      value: 'React',
    }],
    ['invented requirement value', {
      classification: 'required',
      sourceExcerpt: 'TypeScript is required.',
      value: '10 years of Rust',
    }],
  ])('rejects an %s returned across the transport boundary', async (_caseName, requirement) => {
    const extractor = createBrowserJobRequirementExtractor({
      request: () => Promise.resolve(Response.json({
        ok: true,
        value: { targetRole: null, practicalConstraints: [], requirements: [requirement] },
      })),
    })

    const result = await extractor.extract({ jobPostingContent: 'TypeScript is required.' })

    expect(result).toEqual({
      ok: false,
      error: { type: 'job-requirement-transport-unavailable' },
    })
  })
})
