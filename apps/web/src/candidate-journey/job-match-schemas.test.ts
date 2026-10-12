import { describe, expect, it } from 'vitest'

import { matchEvidenceRequestSchema } from './job-match-schemas'

describe('Match Evidence request', () => {
  // Job-match normalization replaces an unsupported capability name with the requirement value
  // and the rationale with the source excerpt, so both can outgrow what extraction allows.
  it('accepts a requirement whose capability name and rationale were normalized from the posting', () => {
    const sourceExcerpt = `Contribute to Digital Marketing processes owned by CDI Marketing team. ${'x'.repeat(400)}`
    const value = 'Contribute to Revenue Forecast process owned by CDI Finance. '.repeat(8).trim()

    const parsed = matchEvidenceRequestSchema.safeParse({
      candidateFacts: [],
      requirements: [{
        capability: { dimension: 'ownership', name: value },
        id: 'job-requirement-11',
        importance: 'complementary',
        importanceRationale: sourceExcerpt,
        sourceExcerpt,
        value,
      }],
    })

    expect(parsed.success).toBe(true)
  })
})
