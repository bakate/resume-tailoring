# Adjacent Evidence Evaluation — 2026-09-30

Issue: BAK-66, from the BAK-63 specification. It builds on BAK-64 (structural Match Evidence verification). Decision record: BAK-106.

## Change under evaluation

When a Job Requirement stays uncovered but the Candidate has a related but distinct capability, the Match Analysis now reports that capability as Adjacent Evidence next to the gap:

- The match proposal contract has a new `adjacentEvidence` list. Each entry holds a requirement identifier and, for each cited Candidate Fact, the fact identifier and a verbatim `factExcerpt`.
- The engine checks each entry with the Match Evidence structural rules: both identifiers exist, a fact is cited at most once, the excerpt appears verbatim in the fact, and a negated fact or a role title offered as proof is rejected. An entry has no requirement excerpt and no duration or scale check, because it never claims coverage.
- An entry for a covered or partially covered requirement is discarded. This includes a requirement whose grouped duplicate or substitute is covered.
- Adjacent Evidence does not change the Match Score, the Match Band, the Critical Requirement Reserve, Generation Eligibility, or the Match Analysis relevant facts.
- The Gap Analysis shows the related facts next to the gap. The EN copy is "Related experience you can highlight instead (it does not meet this requirement)", and the FR copy is "Expérience proche à mettre en avant à la place (elle ne remplit pas cette exigence)".
- Resume writing receives Adjacent Evidence facts as relevant facts. The writing instructions let the writer highlight them and forbid naming the uncovered capability. Resume validation is unchanged.
- The privacy-safe sanitization metric adds `proposedAdjacentEvidence` and `keptAdjacentEvidence`. Both are counts only.
- The legacy match-analysis route uses the same engine, so it gets the same validation. It sends no Adjacent Evidence and shows none.

## Live model evaluation

- Suite: `apps/web/src/candidate-journey/openai-job-match-evidence-matcher.evaluation.test.ts`, run with `pnpm test:evaluation`
- Change: the "another technology in the same domain" trap is now the case "Java, JEE and Angular against TypeScript and React: Adjacent Evidence, never coverage". Both requirements must stay uncovered, and both must have Adjacent Evidence in the Match Analysis.
- Pass rule: the BAK-64 rule (at least 80 percent of expected coverage found, no trap over its allowed coverage), plus no missing expected Adjacent Evidence (`missingAdjacentEvidence` is empty)

| Case | Kind | Expectation |
| --- | --- | --- |
| Java/JEE and Angular against TypeScript and React | trap + Adjacent Evidence | uncovered ×2, Adjacent Evidence present ×2 |

All other cases are unchanged from the BAK-64 report (`semantic-match-evidence-2026-09-30.md`).

### Result

**The live run was not executed.** No OpenAI credentials (`OPENAI_API_KEY`, `OPENAI_STRUCTURED_MODEL`) were available in the implementation environment. The case is implemented and typechecked, and the deterministic path it relies on is covered by the engine, application, adapter contract and rendered-application tests below. Run `pnpm test:evaluation` with credentials before release and record the result here.

## Deterministic coverage

- Engine (`packages/resume-matching-engine/test/resume-matching-engine.test.ts`): Adjacent Evidence is reported next to an uncovered requirement and leaves the rest of the Match Analysis unchanged; it is discarded for covered and partially covered requirements; it is rejected for a fabricated excerpt, an unknown fact or requirement, a fact cited twice, a negated fact, and a role title.
- Candidate journey job match behavior (`packages/resume-tailoring-application/test/candidate-journey-job-match.behavior.test.ts`): Adjacent Evidence reaches the Match Analysis only for the uncovered requirement, and the Match Score is unchanged; resume writing receives Adjacent Evidence facts as relevant facts.
- Adapter contracts (`apps/web/src/candidate-journey/openai-job-match-adapters.contract.test.ts`, `openai-resume-document-models.contract.test.ts`, `structured-output-formats.contract.test.ts`, `browser-candidate-session-persistence.contract.test.ts`): proposal schema, per-entry sanitization, privacy-safe counts, strict structured output, writing instructions, and restoring sessions stored before Adjacent Evidence existed.
- Rendered application (`apps/web/test/candidate-journey.smoke.test.ts`): a gap with Adjacent Evidence shows the related capability, and its requirement stays "Uncovered" with no supporting Candidate Fact.
