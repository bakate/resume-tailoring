// Requirement Coverage rules from CONTEXT.md shared by every matching prompt. The model judges
// equivalence; the matching engine verifies the quoted excerpts structurally (ADR-0015).
export const requirementCoverageInstructions = [
  'Judge whether Candidate Facts show the same capability as each Job Requirement, even in different words or another language.',
  'Use covered when Candidate Facts show the same capability at its full scope, including any explicit duration, scale, level, seniority, or production constraint.',
  "Use partially-covered when the same capability appears at incomplete scope, or when a behavioral capability is only implied by a role's responsibilities.",
  'A related but distinct capability, such as another technology in the same domain, leaves the requirement not covered: never propose it as Match Evidence.',
  'Never offer a role title alone, a negated fact, or a duration or scale that the fact does not state as evidence.',
  'For each fact link, copy a short contiguous factExcerpt verbatim from the Candidate Fact and a short contiguous requirementExcerpt verbatim from the Job Requirement value; the two excerpts may use different words.',
  'When the requirement states a duration or scale, include the duration or scale stated by the fact in its factExcerpt.',
  'Do not calculate or combine employment date ranges to prove a duration; omit duration coverage unless one Candidate Fact explicitly states a duration.',
] as const

export const evidenceExcerptLength = { maximum: 200, minimum: 2 } as const
