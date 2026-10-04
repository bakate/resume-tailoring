import { describe, expect, it } from 'vitest'

import { hasProcessingConsentForPolicy } from '../src/processing-policy'
import type { ProcessingPolicy } from '../src/processing-policy'

const policy = {
  provider: 'Provider', purposes: ['Extract', 'Write'], retentionPolicy: 'None',
  storageBehavior: 'Browser-local', transmittedDataCategories: ['Evidence', 'Job Posting'], version: '1',
} as const satisfies ProcessingPolicy

describe('Processing Consent', () => {
  it('is absent until the Candidate confirms a Processing Policy', () => {
    const consent = null

    const granted = hasProcessingConsentForPolicy({ consent, policy })

    expect(granted).toBe(false)
  })

  it('covers the Processing Policy the Candidate confirmed', () => {
    const consent = { grantedAt: 1, policy: { ...policy, purposes: [...policy.purposes] } }

    const granted = hasProcessingConsentForPolicy({ consent, policy })

    expect(granted).toBe(true)
  })

  it.each([
    ['another provider', { provider: 'Other provider' }],
    ['another version', { version: '2' }],
    ['another retention policy', { retentionPolicy: '30 days' }],
    ['another storage behavior', { storageBehavior: 'Server' }],
    ['an added purpose', { purposes: [...policy.purposes, 'Train'] }],
    ['reordered purposes', { purposes: ['Write', 'Extract'] }],
    ['another transmitted data category', { transmittedDataCategories: ['Evidence'] }],
  ] as const)('requires new consent when the active policy has %s', (_change, activeChange) => {
    const consent = { grantedAt: 1, policy }

    const granted = hasProcessingConsentForPolicy({ consent, policy: { ...policy, ...activeChange } })

    expect(granted).toBe(false)
  })
})
