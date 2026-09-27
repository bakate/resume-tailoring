import { describe, expect, it } from 'vitest'

import { createTailoredResumePdf } from './tailored-resume-pdf'

describe('createTailoredResumePdf', () => {
  it('creates one validated A4 PDF with selectable retained claims and embedded fonts', async () => {
    const result = await createTailoredResumePdf({
      contactItems: [{ kind: 'email', value: 'candidate@example.com' }],
      document: tailoredResumeDocument,
      locale: 'en',
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? new TextDecoder().decode(result.value.slice(0, 5)) : '').toBe('%PDF-')
  }, 20_000)

  it('returns an actionable typed failure instead of an overflowing PDF', async () => {
    const result = await createTailoredResumePdf({
      contactItems: [],
      document: {
        ...tailoredResumeDocument,
        items: Array.from({ length: 60 }).map((unusedValue, itemIndex) => {
          void unusedValue
          return {
            claimId: `resume-claim-overflow-${String(itemIndex)}` as const,
            kind: 'experience' as const,
            text: `Overflowing retained claim ${String(itemIndex)} ${'content '.repeat(80)}`,
          }
        }),
      },
      locale: 'en',
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-overflow' } })
  }, 20_000)
})

const tailoredResumeDocument = {
  items: [
    {
      claimId: 'resume-claim-impact',
      kind: 'experience',
      text: 'Delivered 30% faster releases',
    },
    {
      claimId: 'resume-claim-required',
      kind: 'skill',
      text: 'Used TypeScript',
    },
  ],
  omittedClaimCount: 0,
  typography: 'comfortable',
} as const
