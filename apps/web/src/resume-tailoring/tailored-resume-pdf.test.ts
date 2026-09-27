import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
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

  it('rejects a target role absent from the reviewed Job Posting content', () => {
    const parsedRequest = resumePdfRequestSchema.safeParse({
      ...inputs,
      jobPostingContent: 'TypeScript is required.',
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

  it.each([
    { photoDataUrl: undefined, variant: 'without a Candidate photo' },
    {
      photoDataUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
      variant: 'with a Candidate photo',
    },
  ])('creates a validated French PDF $variant', async ({ photoDataUrl }) => {
    const result = await createTailoredResumePdf({
      inputs: createFrenchInputs({ photoDataUrl }),
      semanticValidator,
    })

    expect(result.ok).toBe(true)
    expect(result.ok ? new TextDecoder().decode(result.value.slice(0, 5)) : '').toBe('%PDF-')
    if (result.ok) await expectFrenchSelectableText({ pdfBytes: result.value })
  }, 20_000)

  it.each([
    {
      extractedTextItems: [
        'Senior FullStack Developer', 'candidate@example.com', 'Used TypeScript',
      ],
      variant: 'missing retained content',
    },
    {
      extractedTextItems: [
        'Senior FullStack Developer', 'candidate@example.com',
        'Used TypeScript', 'Delivered 30% faster releases',
      ],
      variant: 'reordered retained content',
    },
    {
      extractedTextItems: [
        'candidate@example.com', 'Delivered 30% faster releases', 'Used TypeScript',
      ],
      variant: 'missing target role title',
    },
    {
      extractedTextItems: [
        'candidate@example.com', 'Senior FullStack Developer',
        'Delivered 30% faster releases', 'Used TypeScript',
      ],
      variant: 'reordered target role title',
    },
  ])('rejects $variant extracted from the PDF', async ({ extractedTextItems }) => {
    const result = await createTailoredResumePdf({
      inputs,
      pdfTextReader: { read: () => Promise.resolve(extractedTextItems) },
      semanticValidator,
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-content-mismatch' } })
  }, 20_000)

  it('does not start Chromium when the render was already aborted', async () => {
    const renderController = new AbortController()
    renderController.abort()

    const result = await createTailoredResumePdf({
      inputs,
      semanticValidator,
      signal: renderController.signal,
    })

    expect(result).toEqual({ ok: false, error: { type: 'resume-pdf-rendering-unavailable' } })
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
  jobPostingContent: 'Role: Senior FullStack Developer',
  locale: 'en',
  targetRole: {
    sourceExcerpt: 'Role: Senior FullStack Developer',
    value: 'Senior FullStack Developer',
  },
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

function createFrenchInputs({ photoDataUrl }: Readonly<{
  photoDataUrl: string | undefined
}>): TailoredResumePdfInputs {
  return {
    contactItems: [
      { kind: 'email', value: 'synthetic-candidate@example.invalid' },
      { kind: 'phone', value: '+1 202 555 0100' },
    ],
    jobPostingContent: '',
    locale: 'fr',
    targetRole: null,
    ...(photoDataUrl === undefined ? {} : { photoDataUrl }),
    source: frenchSource,
  }
}

const frenchSource = {
  claims: [
    {
      id: 'resume-claim-c62808ee-c7e7-4950-a01d-c05d2500d9e5',
      segments: [{
        factIds: ['source-fact-2c292560-50de-4650-b4c9-38cba4105158'],
        text: 'Connaissance de HTML5.',
      }],
    },
    {
      id: 'resume-claim-abf8c32a-8fe8-4ed8-991a-391cdac73103',
      segments: [
        {
          factIds: ['source-fact-cd05dd47-6b03-4dda-8bd5-913449ebc75e'],
          text: 'Maîtrise de RxJS',
        },
        {
          factIds: ['source-fact-b941446b-c8ea-4adf-a28e-78d063f2d88f'],
          text: ', utilisé pour la gestion d’état chez Bloomflow.',
        },
      ],
    },
  ],
  evidence: [
    {
      factIds: ['source-fact-2c292560-50de-4650-b4c9-38cba4105158'],
      requirementId: 'job-requirement-88e3cc3b-2007-4209-a263-e9bd1c464944',
    },
    {
      factIds: [
        'source-fact-b941446b-c8ea-4adf-a28e-78d063f2d88f',
        'source-fact-cd05dd47-6b03-4dda-8bd5-913449ebc75e',
      ],
      requirementId: 'job-requirement-a950f68f-54d3-4fd6-8de2-62fa2b7d7385',
    },
  ],
  requirements: [
    {
      classification: 'preferred',
      id: 'job-requirement-88e3cc3b-2007-4209-a263-e9bd1c464944',
    },
    {
      classification: 'preferred',
      id: 'job-requirement-a950f68f-54d3-4fd6-8de2-62fa2b7d7385',
    },
  ],
  verifiedFacts: [
    {
      id: 'source-fact-2c292560-50de-4650-b4c9-38cba4105158',
      kind: 'skill',
      value: 'Bakate BA connaît HTML5.',
    },
    {
      id: 'source-fact-b941446b-c8ea-4adf-a28e-78d063f2d88f',
      kind: 'experience',
      value: "Bakate BA a utilisé RxJS pour la gestion d'état chez Bloomflow.",
    },
    {
      id: 'source-fact-cd05dd47-6b03-4dda-8bd5-913449ebc75e',
      kind: 'skill',
      value: 'Bakate BA maîtrise RxJS.',
    },
  ],
} as const satisfies TailoredResumePdfInputs['source']

async function expectFrenchSelectableText({ pdfBytes }: Readonly<{ pdfBytes: Uint8Array }>) {
  const loadingTask = getDocument({ data: pdfBytes.slice(), useSystemFonts: false })
  try {
    const pdfDocument = await loadingTask.promise
    const pdfPage = await pdfDocument.getPage(1)
    const textContent = await pdfPage.getTextContent()
    const selectableText = textContent.items.flatMap((item) => 'str' in item ? [item.str] : [])
      .join(' ')

    expect(selectableText).toContain('CV adapté')
    expect(selectableText).toContain('Points clés sélectionnés')
    expect(selectableText).toContain('synthetic-candidate@example.invalid')
    expect(selectableText).toContain('Connaissance de HTML5.')
    expect(selectableText).toContain('Maîtrise de RxJS, utilisé pour la gestion d')
  } finally {
    await loadingTask.destroy()
  }
}

const semanticValidator = {
  validate: () => Promise.resolve({ ok: true, value: { supported: true, feedback: [] } } as const),
} as const
