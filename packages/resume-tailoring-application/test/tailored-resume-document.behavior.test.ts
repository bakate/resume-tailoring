import { assert, describe, expect, it } from 'vitest'

import {
  prepareTailoredResumeDocument,
} from '@resume-tailoring/application/tailored-resume-document'
import type {
  JobRequirement,
  MatchAnalysis,
  ResumeClaim,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

describe('Tailored Resume document', () => {
  it('preserves every validated Resume Claim verbatim when the page budget allows it', () => {
    const system = createSystemUnderTest()

    system.prepareTailoredResumeDocument()

    system.expectEveryResumeClaimToBeRetainedVerbatim()
  })

  it('reduces overflowing content in the required, impact, preferred, detail order', () => {
    const system = createSystemUnderTest()

    system.givenResumeClaimsExceedOnePage()
    system.prepareTailoredResumeDocument()

    system.expectHigherPriorityClaimsToBeRetainedFirst()
  })
})

function createSystemUnderTest() {
  return new TailoredResumeDocumentTestSystem()
}

class TailoredResumeDocumentTestSystem {
  #claims: readonly ResumeClaim[] = defaultClaims
  #document: ReturnType<typeof prepareTailoredResumeDocument> | undefined

  givenResumeClaimsExceedOnePage() {
    this.#claims = overflowingClaims
  }

  prepareTailoredResumeDocument() {
    this.#document = prepareTailoredResumeDocument({
      claims: this.#claims,
      facts: verifiedFacts,
      matchAnalysis,
      requirements,
    })
  }

  expectEveryResumeClaimToBeRetainedVerbatim() {
    expect(this.#readDocument().items.map(({ text }) => text)).toEqual([
      'Delivered 30% faster releases',
      'Used TypeScript',
    ])
    expect(this.#readDocument().omittedClaimCount).toBe(0)
  }

  expectHigherPriorityClaimsToBeRetainedFirst() {
    const document = this.#readDocument()
    expect(document.items.map(({ claimId }) => claimId)).toEqual([
      'resume-claim-required',
      'resume-claim-impact',
      'resume-claim-preferred',
    ])
    expect(document.omittedClaimCount).toBe(1)
  }

  #readDocument() {
    expect(this.#document, 'Expected the Tailored Resume document to be prepared').toBeDefined()
    assert(this.#document !== undefined)
    assert(this.#document !== null)
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
  createFact({ id: 'source-fact-detail', kind: 'education', value: 'Computer science degree' }),
] as const satisfies readonly SourceProfileFact[]

const matchAnalysis = {
  evidence: [
    { requirementId: 'job-requirement-required', factIds: ['source-fact-required'] },
    { requirementId: 'job-requirement-preferred', factIds: ['source-fact-preferred'] },
  ],
  gapAnalysis: { uncoveredRequiredRequirementIds: [] },
  generationEligibility: 'eligible',
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
