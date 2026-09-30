# Semantic Match Evidence

## Problem Statement

Candidates with a clearly relevant background receive a Match Score near zero, and every Job Requirement appears as "not covered". A full-stack Candidate whose Source Profile describes end-to-end Next.js development, CI/CD with GitHub Actions, and Sentry monitoring sees "design, build and maintain web applications" and "contribute to cloud deployment and monitoring" marked as gaps. A production run showed the language model proposing seven Match Evidence links, all of them discarded, and seven relevant Candidate Facts, of which one was kept.

The cause is the deterministic evidence validation. It accepts a link only when the quoted Candidate Fact term and the quoted Job Requirement term are identical after normalization, or listed in a thirteen-entry alias table. It also requires the quoted requirement term to represent the complete requirement concept. Evidence expressed in different words therefore can never be proven. Successive fixes for French elisions, importance markers, and "and" inside concepts widen lexical matching one phrasing at a time without converging.

Two further effects compound the problem:

- The Job Posting extraction splits one sentence of generic duties into four or five "central" Job Requirements. This inflates the denominator and gives each fragment the weight of a real capability.
- When a Candidate lacks a requested technology but has a closely related one, the analysis shows only a bare gap and gives no useful signal.

The model evaluation contains one positive case and seven traps. It measures false coverage and never measures recall, so the regression went unnoticed.

## Solution

The language model judges whether Candidate Facts show the same capability as a Job Requirement, even in different words. The deterministic engine verifies each proposal structurally instead of lexically, following ADR-0015. Every accepted link still cites text that exists verbatim in both the Candidate Fact and the Job Requirement. The existing traps still reject negated facts, role titles offered as proof, and explicit durations or scales the fact does not reach.

Job Posting extraction returns one Job Requirement per assessable capability. Generic duties listed in one sentence become a single requirement, and "central" importance is reserved for what the Job Posting emphasizes.

When a requirement stays uncovered but the Candidate shows a related but distinct capability, the analysis reports it as Adjacent Evidence next to the gap. Adjacent Evidence never changes Requirement Coverage or the Match Score, and the Tailored Resume never claims the missing capability.

The non-fabrication promise continues to rest on Tailored Resume provenance (ADR-0001, ADR-0009). This specification changes how Match Evidence is accepted, not how resume content is validated.

## User Stories

1. As a Candidate, I want experience described in my own words to count toward a Job Requirement phrased differently, so that my Match Score reflects my real background.
2. As a Candidate, I want the Match Score for a clearly relevant posting to land in a credible or strong Match Band when my Source Document supports it, so that I trust the estimate.
3. As a Candidate, I want each covered requirement to point to the Candidate Facts that support it, so that I can see why the analysis considers it covered.
4. As a Candidate, I want the cited supporting text to come verbatim from my Source Document, so that I can recognize my own experience in the explanation.
5. As a Candidate, I want a requirement for another technology in my domain to stay uncovered, so that the analysis never overstates my qualifications.
6. As a Candidate, I want the related capability I do have shown next to such a gap, so that I understand what I can put forward instead.
7. As a Candidate, I want a behavioral requirement that my roles only imply to count as partially covered at most, so that the score stays honest.
8. As a Candidate, I want a requirement with an explicit duration or scale to stay uncovered when my facts do not state enough, so that numbers are never assumed.
9. As a Candidate, I want a negated fact never to count as evidence, so that "no experience with X" is not read as experience with X.
10. As a Candidate, I want a job title alone never to prove a capability, so that coverage rests on what I did.
11. As a Candidate, I want generic duties from one sentence of the posting grouped into one requirement, so that they do not outweigh the real technical requirements.
12. As a Candidate, I want only the requirements the posting emphasizes marked as central, so that the gaps shown first are the ones that matter.
13. As a Candidate, I want my Tailored Resume to highlight the facts closest to an uncovered requirement without naming the missing capability, so that my resume is well aimed and still truthful.
14. As a Candidate, I want one invalid evidence proposal discarded without losing the rest of the analysis, so that one model mistake does not erase valid coverage.
15. As a product maintainer, I want the model evaluation to measure recall on positive cases as well as rejection of traps, so that over-strict validation fails the evaluation before release.
16. As a product maintainer, I want privacy-safe counts of proposed and kept evidence and relevance links, so that I can monitor acceptance in production without Candidate content.
17. As a product maintainer, I want the alias table and lexical-equality rules removed, so that no one maintains phrasing lists again.

## Implementation Decisions

- Evidence validation in the resume matching engine checks, for each proposed link, that:
  - the Job Requirement and Candidate Fact identifiers exist;
  - each fact is cited at most once per requirement;
  - the quoted fact excerpt appears verbatim, after the existing text normalization, in the Candidate Fact;
  - the quoted requirement excerpt appears verbatim in the Job Requirement;
  - the fact is not negated;
  - the fact is not a role title offered as proof;
  - an explicit duration or scale in the requirement is reached by an explicit duration or scale in the fact.

  Normalized term equality, the complete-concept rule, and the controlled-term alias table are removed. Relevance validation for Tailored Resume selection follows the same structural rules. Each proposal is still accepted or rejected individually.
- Qualitative constraints (level, seniority, production) keep the current covered-versus-partially-covered rule. A qualifier in the requirement that the fact does not show downgrades the link to partially covered instead of rejecting it.
- The match proposal contract's quoted terms become evidence excerpts: short contiguous text from each side, with no requirement that they be equivalent strings. The exact-versus-controlled relationship field is removed.
- The match proposal contract gains an Adjacent Evidence list. Each entry holds a requirement identifier, the Candidate Fact identifiers, and a verbatim excerpt per fact, validated with the same structural rules. An Adjacent Evidence entry for a covered or partially covered requirement is discarded.
- Matching instructions state the Requirement Coverage rules from CONTEXT.md:
  - the same capability in different words is covered;
  - a behavioral capability that a role only implies is partially covered at most;
  - a related but distinct capability, such as another technology in the same domain, is Adjacent Evidence, never coverage.
- Job Posting extraction instructions replace "atomic requirements" with one Job Requirement per assessable capability. Generic duties listed together form one requirement. Central importance is reserved for responsibilities the Job Posting emphasizes, and critical importance keeps its explicit-wording rule.
- The Match Analysis carries Adjacent Evidence per uncovered Job Requirement. The Gap Analysis presentation shows it next to the gap in plain FR and EN copy. The Match Score, Match Band, Critical Requirement Reserve, and Generation Eligibility calculations are unchanged.
- The resume writing input receives the Adjacent Evidence facts as relevant. Writing instructions allow highlighting them and forbid naming the uncovered capability. The resume validation step already rejects unsupported terminology.
- The existing privacy-safe sanitization metric adds proposed and kept Adjacent Evidence counts.
- The legacy match-analysis route shares the engine, so it inherits the new validation. It gets no Adjacent Evidence presentation.

## Testing Decisions

- Tests exercise external behavior: given Candidate Facts, Job Requirements, and a proposal, they assert the resulting Match Analysis. They never assert private validation helpers.
- The resume matching engine tests are the primary seam, following the existing engine test file:
  - a reformulated capability is accepted with verbatim excerpts;
  - a fabricated excerpt is rejected;
  - a negation, a role title, and an unmet duration or scale are rejected;
  - a missing qualifier downgrades a link to partial coverage;
  - Adjacent Evidence never changes the Match Score.
- The candidate-journey job match behavior tests in the application package cover:
  - individual rejection with the rest kept;
  - Adjacent Evidence reaching the Match Analysis;
  - Adjacent Evidence facts reaching resume writing as relevant facts.
- The OpenAI job match adapter contract tests cover the new proposal schema and the strict structured-output contract test added for the writing schema.
- The live model evaluation adds positive synthetic cases, including web application development proven by end-to-end Next.js work and cloud deployment proven by CI/CD and monitoring. It adds an Adjacent Evidence case for Java, JEE, and Angular against TypeScript and React. The evaluation passes only when at least 80 percent of expected coverage is found and no trap receives coverage. Results are recorded in a new dated evaluation report.
- The held-out `technology-29` qualification case from BAK-61, currently marked as an expected failure, must pass without the expected-failure marker.
- The existing cross-segment, general-management, and sales qualification corpora must still pass. Expected outcomes are updated only where the new Requirement Coverage rules deliberately change them, and each change is justified in the evaluation report.
- The rendered-application smoke test checks that a gap with Adjacent Evidence shows the related capability and that its copy never presents it as coverage.

## Out of Scope

- Changes to Tailored Resume provenance or resume validation rules.
- The Match Score formula, Match Band thresholds, and importance weights.
- Embeddings or any semantic-similarity scoring without cited evidence.
- The frictionless candidate intake specification, which follows this one.
- A Candidate-facing global score produced directly by the model.

## Further Notes

- Decision record: ADR-0015, which amends ADR-0010. Glossary terms updated in CONTEXT.md: Job Requirement, Requirement Coverage, Match Evidence, and Adjacent Evidence.
- BAK-61 (match single requirement concepts that contain "and") is superseded by this specification.
- Comparison: CibleCV computes its score entirely by model judgment and has no requirement-to-fact links or post-generation fact check. This specification keeps that fluidity for coverage judgment while keeping cited, verifiable evidence and resume provenance.
- Production evidence: the sanitization metric recorded seven proposed and zero kept evidence links, and seven proposed and one kept relevance link, for a full-stack Source Profile against a full-stack Job Posting.
