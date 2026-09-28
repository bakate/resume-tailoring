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

  it('never silently removes required coverage when required claims exceed one page', async () => {
    const system = createSystemUnderTest()

    system.givenRequiredResumeClaimsExceedOnePage()
    await system.prepareTailoredResumeDocument()

    system.expectRequiredContentOverflowFailure()
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
  #document: Awaited<ReturnType<typeof prepareTailoredResumeDocument>> | undefined

  givenResumeClaimsExceedOnePage() {
    this.#claims = overflowingClaims
    this.#maximumItemCount = 2
  }

  givenRequiredResumeClaimsExceedOnePage() {
    this.#claims = overflowingRequiredClaims
    this.#maximumItemCount = 3
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
      fits: ({ document }) => Promise.resolve({
        ok: true, value: document.items.length <= this.#maximumItemCount,
      } as const),
    }
  }

  expectEveryResumeClaimToBeRetainedVerbatim() {
    expect(this.#readDocument().value.items.map(({ text }) => text)).toEqual([
      'Delivered 30% faster releases',
      'Used TypeScript',
    ])
    expect(this.#readDocument().value.omittedClaimCount).toBe(0)
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

  expectInvalidProvenanceFailure() {
    expect(this.#document).toEqual({
      ok: false,
      error: { type: 'tailored-resume-provenance-invalid' },
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
  createFact({ id: 'source-fact-detail', kind: 'education', value: 'Graduated in 2020' }),
] as const satisfies readonly SourceProfileFact[]

const matchAnalysis = {
  evidence: [
    { coverage: 'covered', requirementId: 'job-requirement-required', factIds: ['source-fact-required'] },
    { coverage: 'covered', requirementId: 'job-requirement-preferred', factIds: ['source-fact-preferred'] },
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
