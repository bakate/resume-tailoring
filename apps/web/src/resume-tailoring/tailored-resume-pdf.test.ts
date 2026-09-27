import { describe, expect, it } from 'vitest'

import type { TailoredResumePdfInputs } from './tailored-resume-contract'
import { createTailoredResumePdf } from './tailored-resume-pdf'
import { resumePdfRequestSchema } from './tailored-resume-schemas'

describe('createTailoredResumePdf', () => {
  it('creates one validated A4 PDF from source data with selectable text and embedded fonts', async () => {
    const result = await createTailoredResumePdf({ inputs, semanticValidator })

    expect(result.ok).toBe(true)
    expect(result.ok ? new TextDecoder().decode(result.value.slice(0, 5)) : '').toBe('%PDF-')
  }, 20_000)

  it('derives the document server-side instead of accepting caller-selected items', () => {
    const parsedRequest = resumePdfRequestSchema.safeParse({
      ...inputs,
      document: {
        items: [],
        omittedClaimCount: 0,
        typography: 'dense',
      },
    })

    expect(parsedRequest.success).toBe(false)
  })

  it('returns an actionable typed failure when required content cannot fit', async () => {
    const result = await createTailoredResumePdf({
      inputs: { ...inputs, source: createOverflowingRequiredSource() },
      semanticValidator,
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-overflow' } })
  }, 20_000)

  it('rejects a Resume Claim without Verified Fact provenance before rendering', async () => {
    const result = await createTailoredResumePdf({
      inputs: {
        ...inputs,
        source: { ...inputs.source, verifiedFacts: inputs.source.verifiedFacts.slice(1) },
      },
      semanticValidator,
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-provenance-invalid' } })
  })

  it('rejects duplicated provenance references', async () => {
    const duplicatedClaim = {
      ...validatedClaims[0],
      segments: [{
        ...validatedClaims[0].segments[0],
        factIds: ['source-fact-impact', 'source-fact-impact'] as const,
      }],
    }
    const result = await createTailoredResumePdf({
      inputs: {
        ...inputs,
        source: { ...inputs.source, claims: [duplicatedClaim, validatedClaims[1]] },
      },
      semanticValidator,
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-provenance-invalid' } })
  })

  it('revalidates retained claims semantically before rendering', async () => {
    const result = await createTailoredResumePdf({
      inputs,
      semanticValidator: {
        validate: () => Promise.resolve({
          ok: true,
          value: {
            supported: false,
            feedback: [{ code: 'unsupported-meaning', segmentIndex: 0 }],
          },
        } as const),
      },
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-provenance-invalid' } })
  })
})

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

const inputs = {
  contactItems: [{ kind: 'email', value: 'candidate@example.com' }],
  locale: 'en',
  source: {
    claims: validatedClaims,
    evidence: [{
      factIds: ['source-fact-required'],
      requirementId: 'job-requirement-required',
    }],
    requirements: [{ classification: 'required', id: 'job-requirement-required' }],
    verifiedFacts,
  },
} as const satisfies TailoredResumePdfInputs

function createOverflowingRequiredSource(): TailoredResumePdfInputs['source'] {
  const claims = Array.from({ length: 24 }, (unusedValue, claimIndex) => {
    void unusedValue
    return {
      id: `resume-claim-required-${String(claimIndex)}` as const,
      segments: [{
        factIds: ['source-fact-required'] as const,
        text: `Required experience ${'content '.repeat(55)}`.trim(),
      }],
    }
  })
  return { ...inputs.source, claims }
}

const semanticValidator = {
  validate: () => Promise.resolve({ ok: true, value: { supported: true, feedback: [] } } as const),
} as const
