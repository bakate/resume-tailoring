import { assert, describe, expect, it } from 'vitest'

import {
  prepareTailoredResumeDocument,
  prepareValidatedTailoredResumeDocument,
} from '@resume-tailoring/application/tailored-resume-document'
import type {
  TailoredResumeLayoutMeasurer,
} from '@resume-tailoring/application/tailored-resume-document'
import type {
  JobRequirement,
  MatchAnalysis,
  ResumeClaim,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

describe('Tailored Resume document', () => {
  it('preserves every validated Resume Claim verbatim when the page budget allows it', async () => {
    const system = createSystemUnderTest()

    await system.prepareTailoredResumeDocument()

    system.expectEveryResumeClaimToBeRetainedVerbatim()
  })

  it('reduces overflowing content in the required, impact, preferred, detail order', async () => {
    const system = createSystemUnderTest()

    system.givenResumeClaimsExceedOnePage()
    await system.prepareTailoredResumeDocument()

    system.expectHigherPriorityClaimsToBeRetainedFirst()
  })

  it('uses a second page instead of removing required coverage', async () => {
    const system = createSystemUnderTest()

    system.givenRequiredResumeClaimsExceedOnePage()
    await system.prepareTailoredResumeDocument()

    system.expectEveryRequiredClaimOnTwoPages()
  })

  it('uses a second page instead of removing two preferred requirements', async () => {
    const system = createSystemUnderTest()

    system.givenOnePageWouldRemoveTwoPreferredClaims()
    await system.prepareTailoredResumeDocument()

    system.expectEveryPreferredClaimOnTwoPages()
  })

  it('fails instead of producing more than two pages', async () => {
    const system = createSystemUnderTest()

    system.givenRequiredResumeClaimsExceedTwoPages()
    await system.prepareTailoredResumeDocument()

    system.expectRequiredContentOverflowFailure()
  })

  it('lets the layout measurer accept required content despite a conservative line estimate', async () => {
    const system = createSystemUnderTest()

    system.givenEstimatedRequiredLinesExceedTheBudgetButFitTwoPages()
    await system.prepareTailoredResumeDocument()

    system.expectEstimatedRequiredClaimsOnTwoPages()
  })

  it('does not use a second page for one oversized optional claim', async () => {
    const system = createSystemUnderTest()

    system.givenOnlyOptionalClaimNeedsSecondPage()
    await system.prepareTailoredResumeDocument()

    system.expectContentOverflowFailure()
  })

  it('reports a layout failure instead of silently returning an incomplete one-page document', async () => {
    const system = createSystemUnderTest()

    system.givenOnePageWouldRemoveTwoPreferredClaims()
    system.givenSecondPageMeasurementIsUnavailable()
    await system.prepareTailoredResumeDocument()

    system.expectLayoutUnavailableFailure()
  })

  it('rejects semantically unsupported retained claims through the document interface', async () => {
    const system = createSystemUnderTest()

    await system.prepareSemanticallyUnsupportedDocument()

    system.expectInvalidProvenanceFailure()
  })
})

function createSystemUnderTest() {
  return new TailoredResumeDocumentTestSystem()
}

class TailoredResumeDocumentTestSystem {
  #claims: readonly ResumeClaim[] = defaultClaims
  #maximumItemCount = Number.POSITIVE_INFINITY
  #unavailablePageCount: 1 | 2 | null = null
  #document: Awaited<ReturnType<typeof prepareTailoredResumeDocument>> | undefined

  givenResumeClaimsExceedOnePage() {
    this.#claims = overflowingClaims
    this.#maximumItemCount = 2
  }

  givenRequiredResumeClaimsExceedOnePage() {
    this.#claims = overflowingRequiredClaims
    this.#maximumItemCount = 3
  }

  givenOnePageWouldRemoveTwoPreferredClaims() {
    this.#claims = twoPagePreferredClaims
    this.#maximumItemCount = 2
  }

  givenRequiredResumeClaimsExceedTwoPages() {
    this.#claims = overflowingTwoPageRequiredClaims
    this.#maximumItemCount = 3
  }

  givenEstimatedRequiredLinesExceedTheBudgetButFitTwoPages() {
    this.#claims = overflowingTwoPageRequiredClaims
    this.#maximumItemCount = 4
  }

  givenOnlyOptionalClaimNeedsSecondPage() {
    this.#claims = [createLongClaim({
      id: 'resume-claim-detail', factId: 'source-fact-detail',
    })]
    this.#maximumItemCount = 0.5
  }

  givenSecondPageMeasurementIsUnavailable() {
    this.#unavailablePageCount = 2
  }

  async prepareTailoredResumeDocument() {
    this.#document = await prepareTailoredResumeDocument({
      inputs: this.#createInputs(), layoutMeasurer: this.#createLayoutMeasurer(),
    })
  }

  async prepareSemanticallyUnsupportedDocument() {
    this.#document = await prepareValidatedTailoredResumeDocument({
      inputs: this.#createInputs(),
      layoutMeasurer: this.#createLayoutMeasurer(),
      semanticValidator: {
        validate: () => Promise.resolve({
          ok: true,
          value: { supported: false, feedback: [{ code: 'unsupported-meaning' }] },
        } as const),
      },
    })
  }

  #createInputs() {
    return {
      claims: this.#claims,
      evidence: matchAnalysis.evidence,
      requirements,
      verifiedFacts,
    }
  }

  #createLayoutMeasurer(): TailoredResumeLayoutMeasurer {
    return {
      fits: ({ document }) => {
        if (document.pageCount === this.#unavailablePageCount) {
          return Promise.resolve({ ok: false } as const)
        }
        return Promise.resolve({
          ok: true, value: document.items.length <= this.#maximumItemCount * document.pageCount,
        } as const)
      },
    }
  }

  expectEveryResumeClaimToBeRetainedVerbatim() {
    expect(this.#readDocument().value.items.map(({ text }) => text)).toEqual([
      'Delivered 30% faster releases',
      'Used TypeScript',
    ])
    expect(this.#readDocument().value.omittedClaimCount).toBe(0)
    expect(this.#readDocument().value.pageCount).toBe(1)
  }

  expectHigherPriorityClaimsToBeRetainedFirst() {
    const document = this.#readDocument().value
    expect(document.items.map(({ claimId }) => claimId)).toEqual([
      'resume-claim-impact',
      'resume-claim-required',
    ])
    expect(document.omittedClaimCount).toBe(2)
  }

  expectRequiredContentOverflowFailure() {
    expect(this.#document).toEqual({
      ok: false,
      error: { type: 'tailored-resume-required-content-overflow' },
    })
  }

  expectEveryRequiredClaimOnTwoPages() {
    const document = this.#readDocument().value
    expect(document.items).toHaveLength(4)
    expect(document.omittedClaimCount).toBe(0)
    expect(document.pageCount).toBe(2)
  }

  expectEstimatedRequiredClaimsOnTwoPages() {
    const document = this.#readDocument().value
    expect(document.items).toHaveLength(7)
    expect(document.pageCount).toBe(2)
  }

  expectEveryPreferredClaimOnTwoPages() {
    const document = this.#readDocument().value
    expect(document.items.map(({ claimId }) => claimId)).toEqual([
      'resume-claim-impact',
      'resume-claim-required',
      'resume-claim-preferred-one',
      'resume-claim-preferred-two',
    ])
    expect(document.omittedClaimCount).toBe(0)
    expect(document.pageCount).toBe(2)
  }

  expectInvalidProvenanceFailure() {
    expect(this.#document).toEqual({
      ok: false,
      error: { type: 'tailored-resume-provenance-invalid' },
    })
  }

  expectContentOverflowFailure() {
    expect(this.#document).toEqual({
      ok: false,
      error: { type: 'tailored-resume-content-overflow' },
    })
  }

  expectLayoutUnavailableFailure() {
    expect(this.#document).toEqual({
      ok: false,
      error: { type: 'tailored-resume-layout-unavailable' },
    })
  }

  #readDocument() {
    expect(this.#document, 'Expected the Tailored Resume document to be prepared').toBeDefined()
    assert(this.#document !== undefined)
    assert(this.#document.ok)
    return this.#document
  }
}

const requirements = [
  {
    id: 'job-requirement-required',
    groupId: 'job-requirement-group-required',
    classification: 'required',
    sourceExcerpt: 'TypeScript is required',
    value: 'TypeScript',
  },
  {
    id: 'job-requirement-preferred',
    groupId: 'job-requirement-group-preferred',
    classification: 'preferred',
    sourceExcerpt: 'French is preferred',
    value: 'French',
  },
] as const satisfies readonly JobRequirement[]

const verifiedFacts = [
  createFact({ id: 'source-fact-required', kind: 'skill', value: 'TypeScript' }),
  createFact({ id: 'source-fact-impact', kind: 'experience', value: 'Improved releases by 30%' }),
  createFact({ id: 'source-fact-preferred', kind: 'language', value: 'French' }),
  createFact({
    id: 'source-fact-preferred-impact', kind: 'experience', value: 'Improved delivery by 30%',
  }),
  createFact({ id: 'source-fact-detail', kind: 'education', value: 'Graduated in 2020' }),
] as const satisfies readonly SourceProfileFact[]

const matchAnalysis = {
  evidence: [
    { coverage: 'covered', requirementId: 'job-requirement-required', factIds: ['source-fact-required'] },
    {
      coverage: 'covered',
      requirementId: 'job-requirement-preferred',
      factIds: ['source-fact-preferred', 'source-fact-preferred-impact'],
    },
  ],
  gapAnalysis: { partiallyCoveredRequiredRequirementIds: [], uncoveredRequiredRequirementIds: [] },
  generationEligibility: 'eligible',
  improvementOpportunities: [],
  matchScore: 100 as MatchAnalysis['matchScore'],
  relevantFactIds: verifiedFacts.map(({ id }) => id),
  warning: null,
} as const satisfies MatchAnalysis

const defaultClaims = [
  createClaim({ id: 'resume-claim-impact', factId: 'source-fact-impact', text: 'Delivered 30% faster releases' }),
  createClaim({ id: 'resume-claim-required', factId: 'source-fact-required', text: 'Used TypeScript' }),
] as const satisfies readonly ResumeClaim[]

const overflowingClaims = [
  createLongClaim({ id: 'resume-claim-detail', factId: 'source-fact-detail' }),
  createLongClaim({ id: 'resume-claim-preferred', factId: 'source-fact-preferred' }),
  createLongClaim({ id: 'resume-claim-impact', factId: 'source-fact-impact' }),
  createLongClaim({ id: 'resume-claim-required', factId: 'source-fact-required' }),
] as const satisfies readonly ResumeClaim[]

const overflowingRequiredClaims = [
  createLongClaim({ id: 'resume-claim-required-one', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-two', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-three', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-four', factId: 'source-fact-required' }),
] as const satisfies readonly ResumeClaim[]

const twoPagePreferredClaims = [
  createLongClaim({ id: 'resume-claim-impact', factId: 'source-fact-impact' }),
  createLongClaim({ id: 'resume-claim-required', factId: 'source-fact-required' }),
  createPreferredImpactClaim({ id: 'resume-claim-preferred-one' }),
  createPreferredImpactClaim({ id: 'resume-claim-preferred-two' }),
] as const satisfies readonly ResumeClaim[]

const overflowingTwoPageRequiredClaims = [
  createLongClaim({ id: 'resume-claim-required-one', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-two', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-three', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-four', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-five', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-six', factId: 'source-fact-required' }),
  createLongClaim({ id: 'resume-claim-required-seven', factId: 'source-fact-required' }),
] as const satisfies readonly ResumeClaim[]

function createFact({ id, kind, value }: Readonly<{
  id: SourceProfileFact['id']
  kind: SourceProfileFact['kind']
  value: string
}>): SourceProfileFact {
  return { id, kind, propositionKey: `proposition-${id}`, status: 'verified', value }
}

function createClaim({ id, factId, text }: Readonly<{
  id: ResumeClaim['id']
  factId: SourceProfileFact['id']
  text: string
}>): ResumeClaim {
  return { id, segments: [{ factIds: [factId], text }] }
}

function createLongClaim({ id, factId }: Readonly<{
  id: ResumeClaim['id']
  factId: SourceProfileFact['id']
}>) {
  return createClaim({ id, factId, text: `${id} ${'relevant detail '.repeat(44)}` })
}

function createPreferredImpactClaim({ id }: Readonly<{ id: ResumeClaim['id'] }>) {
  return createClaim({
    id,
    factId: 'source-fact-preferred-impact',
    text: `${id} Improved delivery by 30% ${'relevant detail '.repeat(150)}`,
  })
}
