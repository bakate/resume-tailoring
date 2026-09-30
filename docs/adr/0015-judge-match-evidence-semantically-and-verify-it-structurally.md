# Judge match evidence semantically and verify it structurally

This amends ADR-0010. The deterministic engine no longer requires a proposed Match Evidence link to use the same normalized term on both sides, nor to quote the complete requirement concept. The model judges whether Candidate Facts show the same capability, even in different words. The engine verifies the proposal structurally: identifiers exist, each cited excerpt appears verbatim in its Candidate Fact and Job Requirement, and deterministic traps still reject the link. These traps are a negated fact, a role title alone, and an explicit duration or scale that the fact does not reach.

Lexical proof made reformulated evidence unprovable. A full-stack Next.js record could never cover "design, build and maintain web applications", so real Candidates scored near zero. Widening the alias table one phrasing at a time did not converge. The non-fabrication promise is enforced where it matters, on every generated Resume Field through provenance (ADR-0001, ADR-0009). The Match Score is an advisory estimate. It therefore accepts judged equivalence, but only with cited, verifiable evidence.

## Considered Options

- Keep lexical proof and extend aliases: precise but unbounded, and recall stays near zero.
- Let the model estimate a global score without requirement-to-fact links: fluid but unexplainable, and it cannot be checked.

## Consequences

Evaluation must measure recall on positive cases as well as rejection of traps. Related but distinct capabilities are reported as Adjacent Evidence. They never change Requirement Coverage, and the Tailored Resume never claims them.
