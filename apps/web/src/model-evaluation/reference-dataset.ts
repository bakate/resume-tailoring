const verifiedTypeScriptFact = {
  id: 'source-fact-typescript',
  kind: 'skill',
  value: 'TypeScript',
} as const

const typeScriptRequirement = {
  classification: 'required',
  id: 'job-requirement-typescript',
  value: 'Maîtrise de TypeScript',
} as const

const englishTypeScriptRequirement = {
  classification: 'required',
  id: 'job-requirement-typescript-writing',
  value: 'Strong TypeScript experience',
} as const

const verifiedBillingPlatformFact = {
  id: 'source-fact-billing-platform',
  kind: 'experience',
  value: 'Built a billing platform with TypeScript',
} as const

const translationWritingInputs = {
  evidence: [{
    factIds: [verifiedBillingPlatformFact.id],
    requirementId: typeScriptRequirement.id,
  }],
  requirements: [typeScriptRequirement],
  locale: 'fr',
  verifiedFacts: [verifiedBillingPlatformFact],
} as const

const englishWritingInputs = {
  evidence: [{
    factIds: [verifiedBillingPlatformFact.id],
    requirementId: englishTypeScriptRequirement.id,
  }],
  requirements: [englishTypeScriptRequirement],
  locale: 'en',
  verifiedFacts: [verifiedBillingPlatformFact],
} as const

const validationFixtures = [
  createValidationFixture({
    id: 'validation-strengthened-seniority',
    claimText: 'Senior TypeScript engineer',
    strengtheningDimension: 'seniority',
  }),
  createValidationFixture({
    id: 'validation-strengthened-causality',
    claimText: 'TypeScript work caused revenue growth',
    strengtheningDimension: 'causality',
  }),
  createValidationFixture({
    id: 'validation-strengthened-scope',
    claimText: 'Led the company-wide TypeScript platform',
    strengtheningDimension: 'scope',
  }),
  createValidationFixture({
    id: 'validation-strengthened-dates',
    claimText: 'Used TypeScript from 2020 to 2026',
    strengtheningDimension: 'dates',
  }),
  createValidationFixture({
    id: 'validation-strengthened-quantity',
    claimText: 'Delivered 20 TypeScript services',
    strengtheningDimension: 'quantity',
  }),
  createValidationFixture({
    id: 'validation-strengthened-outcome',
    claimText: 'Used TypeScript and reduced latency by 50%',
    strengtheningDimension: 'outcome',
  }),
] as const

export const referenceModelEvaluationDataset = {
  id: 'resume-tailoring-reference-v1',
  fixtures: [
    {
      id: 'source-profile-extraction-en',
      capability: 'source-profile-extraction',
      role: 'structured',
      professionalContent: 'Built a billing platform with TypeScript. Speak French fluently.',
      expectedValues: ['Built a billing platform', 'TypeScript', 'French fluently'],
    },
    {
      id: 'job-requirement-extraction-fr',
      capability: 'job-requirement-extraction',
      role: 'structured',
      jobPostingContent: 'Vous devez maîtriser TypeScript. La pratique du français est appréciée.',
      expectedSourceExcerpts: [
        'Vous devez maîtriser TypeScript.',
        'La pratique du français est appréciée.',
      ],
    },
    {
      id: 'matching-controlled-translation',
      capability: 'matching',
      role: 'structured',
      requirements: [typeScriptRequirement],
      verifiedFacts: [verifiedTypeScriptFact],
      expectedRequirementIds: [typeScriptRequirement.id],
    },
    ...validationFixtures,
    {
      id: 'resume-claim-translation-fr',
      capability: 'translation',
      role: 'writing',
      writingInputs: translationWritingInputs,
      claim: {
        segments: [{
          text: verifiedBillingPlatformFact.value,
          factIds: [verifiedBillingPlatformFact.id],
        }],
      },
      expectedTerms: ['TypeScript'],
      expectedLocale: 'fr',
      reformulationRequest: 'Reformulate faithfully in French.',
    },
    {
      id: 'resume-writing-en',
      capability: 'resume-writing',
      role: 'writing',
      writingInputs: englishWritingInputs,
      expectedTerms: ['TypeScript', 'billing platform'],
      expectedLocale: 'en',
    },
  ],
} as const

type StrengtheningDimension = 'seniority' | 'causality' | 'scope' | 'dates' | 'quantity' | 'outcome'

function createValidationFixture({
  claimText,
  id,
  strengtheningDimension,
}: Readonly<{
  claimText: string
  id: string
  strengtheningDimension: StrengtheningDimension
}>) {
  return {
    id,
    capability: 'validation',
    role: 'structured',
    strengtheningDimension,
    claim: {
      id: `resume-claim-${id}` as const,
      segments: [{ text: claimText, factIds: [verifiedTypeScriptFact.id] }],
    },
    verifiedFacts: [verifiedTypeScriptFact],
    expectedSupported: false,
  } as const
}
