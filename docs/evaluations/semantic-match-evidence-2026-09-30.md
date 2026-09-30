# Semantic Match Evidence Evaluation — 2026-09-30

Issue: BAK-64, from the BAK-63 specification. Decision record: ADR-0015.

## Change under evaluation

The resume matching engine now checks Match Evidence and relevance links by structure, not by wording:

- Both identifiers must exist.
- A Candidate Fact may be cited at most once per Job Requirement.
- The quoted fact excerpt must appear verbatim in the Candidate Fact, and the quoted requirement excerpt must appear verbatim in the Job Requirement. Both sides go through the existing text normalization.
- The existing traps still reject a link: a negated fact, a role title offered as proof, and an explicit duration or scale that the fact does not reach.
- Normalized term equality, the complete-concept rule, and the controlled-term alias table are removed.
- A covered link is downgraded to partially covered when the Job Requirement names a qualitative qualifier (level, seniority, production) that the cited fact does not show.
- Each invalid proposal is discarded on its own, and the rest of the Match Analysis is kept.
- Candidate Facts cited by accepted Match Evidence also count as relevant.

The match proposal contract replaces `factTerm`, `requirementTerm` and `relationship` with `factExcerpt` and `requirementExcerpt`. The matching instructions state the Requirement Coverage rules from `CONTEXT.md`.

## Live model evaluation

- Suite: `apps/web/src/candidate-journey/openai-job-match-evidence-matcher.evaluation.test.ts`, run with `pnpm test:evaluation`
- Path under test: the production Job Match adapter (`createOpenAiJobMatchEvidenceMatcher`), then the engine's `validateRelevantFactProposals` and `analyzeResumeMatch`
- Pass rule: at least 80 percent of expected coverage is found as covered, and no trap gets more coverage than it allows

The suite replaces `resume-tailoring/openai-match-evidence-matcher.evaluation.test.ts`. That file had one positive case and seven traps, and it measured only false coverage. Every one of its cases is carried over.

| Case | Kind | Expectation |
| --- | --- | --- |
| Web application development proven by end-to-end Next.js work | positive | covered |
| Cloud deployment and monitoring proven by CI/CD and Sentry monitoring | positive | covered |
| Exact skill (`TS`) and translated language (`Français courant`) | positive | covered ×2 |
| REST API development proven by RESTful endpoint work | positive | covered |
| Automated testing proven by Playwright and Vitest work | positive | covered |
| French mentoring requirement proven by English coaching evidence | positive | covered |
| Java/JEE and Angular against TypeScript and React | trap | uncovered ×2 |
| Unsupported five-year duration | trap | partially covered at most |
| Technology present only in a role title | trap | uncovered |
| Negated technology experience | trap | uncovered |
| React offered as proof of React Native | trap | uncovered |
| Java duration offered as TypeScript duration | trap | partially covered at most |
| Java seniority offered as TypeScript seniority | trap | partially covered at most |
| Leadership inferred from a programming skill | trap | uncovered |
| React 17 offered as proof of React 18 | trap | uncovered |

The duration and seniority traps allow partial coverage. Under the Requirement Coverage rules, the same capability at incomplete scope is partially covered. They fail if they are marked covered.

### Result

**Not executed.** No `OPENAI_API_KEY` or `OPENAI_STRUCTURED_MODEL` was available in the implementation environment. The cases and pass gates are implemented. Recall, trap violations, token counts and latency are still to be recorded from the first credentialed run of `pnpm test:evaluation`, and must be appended here before release.

## Deterministic qualification corpora

`pnpm test:qualification` passed: 16 of 16 tests.

- **Cross-segment held-out corpus:** passes without the `it.fails` expected-failure marker. `technology-29` ("technical discovery and quota support") now gets its expected coverage. The complete-concept rule and the `and` clause split no longer block a single concept that contains "and". No held-out data was used for tuning: the fix follows from the specification.
- **Cross-segment development corpus:** passes, and so do the general-management and sales corpora.
- **Expected outcomes:** none of the corpora changed. The only harness change renames the proposal fields to the new excerpt contract.

## Deliberate changes to expected outcomes in engine-backed tests

These tests used to rely on lexical proof. They now follow ADR-0015:

| Test | Before | After | Justification |
| --- | --- | --- | --- |
| Engine: a term covering only part of the requirement concept (`anglais` in `anglais technique`) | rejected | accepted as an excerpt | The complete-concept rule is removed. Judging the scope is the model's job, and the evaluation covers it. |
| Engine: `TypeScript` claimed "exact" against `TS` | rejected | accepted with verbatim excerpts | The relationship field and the alias table are removed. |
| Engine: grouping `TS` with `TypeScript` capability names | grouped via alias table | the fixture uses `Typescript` (normalized duplicate) | The alias table is removed. Normalized duplicates are still grouped. |
| Engine and legacy workflow: covered evidence with an unmet duration, a negation, or a role title | whole analysis rejected | the invalid link is discarded and the rest of the analysis is kept | Individual rejection (user story 14). |
| Legacy workflow: Java seniority offered as TypeScript seniority | whole analysis rejected | partially covered | A missing qualifier downgrades coverage instead of rejecting it. |
| Legacy workflow: React as proof of React Native, React 17 as proof of React 18, leadership from a programming skill | rejected by lexical rules | removed from engine tests and added as live-evaluation traps | These are semantic judgments. The engine cannot make them without lexical rules, so the model evaluation enforces them. |
| Adapter: evidence whose fact had no matching relevance link | discarded | kept | Facts cited by accepted Match Evidence count as relevant. |

## Commands

| Command | Result |
| --- | --- |
| `pnpm check` | Passed |
| `pnpm test:qualification` | Passed (16/16), with no expected-failure marker |
| `pnpm test:e2e` | Passed (50/50, Chromium) |
| `pnpm test:evaluation` | Not executed: no OpenAI credentials |
