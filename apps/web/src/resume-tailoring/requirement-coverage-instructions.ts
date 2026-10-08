// Requirement Coverage rules from CONTEXT.md shared by every matching prompt. The model judges
// equivalence; the matching engine verifies the quoted excerpts structurally.
export const requirementCoverageInstructions = [
  'Judge whether Candidate Facts show the same capability as each Job Requirement, even in different words or another language.',
  'Use covered when Candidate Facts show the same capability at its full scope, including any explicit duration, scale, level, seniority, or production constraint.',
  "Use partially-covered when the same capability appears at incomplete scope, or when a behavioral capability is only implied by a role's responsibilities.",
  'A related but distinct capability, such as another technology in the same domain, leaves the requirement not covered: never propose it as Match Evidence.',
  'A tool that exists to carry out the requested practice shows that practice itself, even listed alone as a skill: Jest or Vitest show unit tests, Cypress or Playwright end-to-end tests. Cover the requirement with it; it is never Adjacent Evidence.',
  'Never offer a role title alone, a negated fact, or a duration or scale that the fact does not state as evidence.',
  'For each fact link, copy a short contiguous factExcerpt verbatim from the Candidate Fact and a short contiguous requirementExcerpt verbatim from the Job Requirement value; the two excerpts may use different words.',
  'Copy each excerpt as one unbroken run of its text, never words joined across a gap: from "Écrire des tests unitaires et end-to-end", cite "tests unitaires" or "end-to-end", never "tests end-to-end".',
  'When the requirement states a duration or scale, include the duration or scale stated by the fact in its factExcerpt.',
  'Do not calculate or combine employment date ranges to prove a duration; omit duration coverage unless one Candidate Fact explicitly states a duration.',
  'A fact such as "React: 67 months of dated experience" states a duration already calculated from the Candidate\'s dated experiences: cite it, with that duration in its factExcerpt, for a duration requirement on that skill.',
] as const

export const evidenceExcerptLength = { maximum: 200, minimum: 2 } as const
