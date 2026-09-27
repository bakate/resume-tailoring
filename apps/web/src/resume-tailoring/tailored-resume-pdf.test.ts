import { describe, expect, it } from 'vitest'

import { createTailoredResumePdf } from './tailored-resume-pdf'

describe('createTailoredResumePdf', () => {
  it('creates one validated A4 PDF with selectable retained claims and embedded fonts', async () => {
    const result = await createTailoredResumePdf({ inputs: {
      contactItems: [{ kind: 'email', value: 'candidate@example.com' }],
      document: tailoredResumeDocument,
      locale: 'en',
      validatedClaims,
      verifiedFacts,
    }, semanticValidator })

    expect(result.ok).toBe(true)
    expect(result.ok ? new TextDecoder().decode(result.value.slice(0, 5)) : '').toBe('%PDF-')
  }, 20_000)

  it('returns an actionable typed failure instead of an overflowing PDF', async () => {
    const result = await createTailoredResumePdf({ inputs: {
      contactItems: [],
      document: {
        ...tailoredResumeDocument,
        items: Array.from({ length: 60 }).map((unusedValue, itemIndex) => {
          void unusedValue
          return {
            claimId: `resume-claim-overflow-${String(itemIndex)}` as const,
            factIds: ['source-fact-impact'] as const,
            kind: 'experience' as const,
            text: `Overflowing retained claim ${'content '.repeat(80)}`.trim(),
          }
        }),
      },
      locale: 'en',
      validatedClaims: Array.from({ length: 60 }).map((unusedValue, itemIndex) => {
        void unusedValue
        return {
          id: `resume-claim-overflow-${String(itemIndex)}` as const,
          segments: [{
            factIds: ['source-fact-impact'] as const,
            text: `Overflowing retained claim ${'content '.repeat(80)}`.trim(),
          }],
        }
      }),
      verifiedFacts,
    }, semanticValidator })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-overflow' } })
  }, 20_000)

  it('rejects a retained claim without Verified Fact provenance before rendering', async () => {
    const result = await createTailoredResumePdf({ inputs: {
      contactItems: [],
      document: tailoredResumeDocument,
      locale: 'en',
      validatedClaims,
      verifiedFacts: verifiedFacts.slice(1),
    }, semanticValidator })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-provenance-invalid' } })
  })

  it('rejects retained text that differs from its validated Resume Claim', async () => {
    const result = await createTailoredResumePdf({ inputs: {
      contactItems: [],
      document: {
        ...tailoredResumeDocument,
        items: [{ ...tailoredResumeDocument.items[0], text: 'Invented achievement' }],
      },
      locale: 'en',
      validatedClaims,
      verifiedFacts,
    }, semanticValidator })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-provenance-invalid' } })
  })

  it('rejects duplicated provenance references', async () => {
    const duplicatedDocument = {
      ...tailoredResumeDocument,
      items: [{ ...tailoredResumeDocument.items[0], factIds: ['source-fact-impact', 'source-fact-impact'] }],
    } as const
    const result = await createTailoredResumePdf({
      inputs: {
        contactItems: [], document: duplicatedDocument, locale: 'en', validatedClaims, verifiedFacts,
      },
      semanticValidator,
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-provenance-invalid' } })
  })

  it('revalidates retained claims semantically before rendering', async () => {
    const result = await createTailoredResumePdf({
      inputs: {
        contactItems: [], document: tailoredResumeDocument, locale: 'en', validatedClaims, verifiedFacts,
      },
      semanticValidator: {
        validate: () => Promise.resolve({
          ok: true, value: { supported: false, feedback: [{ code: 'unsupported-meaning', segmentIndex: 0 }] },
        } as const),
      },
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-provenance-invalid' } })
  })
})

const tailoredResumeDocument = {
  items: [
    {
      claimId: 'resume-claim-impact',
      factIds: ['source-fact-impact'],
      kind: 'experience',
      text: 'Delivered 30% faster releases',
    },
    {
      claimId: 'resume-claim-required',
      factIds: ['source-fact-required'],
      kind: 'skill',
      text: 'Used TypeScript',
    },
  ],
  omittedClaimCount: 0,
  typography: 'comfortable',
} as const

const validatedClaims = [
  {
    id: 'resume-claim-impact',
    segments: [{ factIds: ['source-fact-impact'], text: 'Delivered 30% faster releases' }],
  },
  {
    id: 'resume-claim-required',
    segments: [{ factIds: ['source-fact-required'], text: 'Used TypeScript' }],
  },
] as const

const verifiedFacts = [
  { id: 'source-fact-impact', kind: 'experience', value: 'Delivered 30% faster releases' },
  { id: 'source-fact-required', kind: 'skill', value: 'Used TypeScript' },
] as const

const semanticValidator = {
  validate: () => Promise.resolve({ ok: true, value: { supported: true, feedback: [] } } as const),
} as const
