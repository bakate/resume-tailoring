# Job Requirement Extraction Evaluation — 2026-09-30

Ticket: BAK-65, child of the Semantic Match Evidence specification (BAK-63).

## Status

**The live model evaluation was not executed.** No `OPENAI_API_KEY` was available in the
implementation environment. The cases below are implemented and fail fast with an explicit
"must be configured for live evaluation" message when credentials are missing. Record the live
results in this report before release.

- Suite: `apps/web/src/candidate-journey/openai-job-posting-extractor.evaluation.test.ts`
- Command: `pnpm --filter @resume-tailoring/web exec vitest run --maxWorkers=1 src/candidate-journey/openai-job-posting-extractor.evaluation.test.ts`
- Configuration: `OPENAI_STRUCTURED_MODEL` (currently `gpt-6-luna`), reasoning effort `low`

## Changes under evaluation

- The Job Posting extraction instructions no longer request atomic requirements. They request
  one Job Requirement per assessable capability. Generic duties listed together form one
  requirement, and distinct technical capabilities stay separate even when they share a sentence.
- Every requirement still copies its value and source excerpt exactly from the Job Posting. The
  application still rejects an extraction whose excerpt is not in the Job Posting, or whose value
  is not in its excerpt.
- Central importance is reserved for responsibilities the Job Posting emphasizes. Generic or
  secondary duties that the posting only lists are complementary.
- The legacy job requirement extractor gets the same grouping rule in place of "split compound
  passages into indivisible requirements".

### Requirement Importance normalization

Before this change, the Job Match discarded the model's importance. It recomputed importance from
the source excerpt: preference wording gave complementary, mandatory wording gave critical, and
everything else became central. Prompt changes alone could not keep central for emphasized
responsibilities.

The Job Match now applies these rules:

| Source excerpt wording | Model proposal | Requirement Importance |
| --- | --- | --- |
| Preference wording (for example "is a plus", "souhaité") | Any | Complementary |
| Mandatory wording (for example "required", "obligatoire") | Any | Critical |
| Neither | Complementary | Complementary |
| Neither | Central or critical | Central |

Critical keeps its explicit-wording rule, so the model cannot make a requirement critical without
mandatory wording. Complementary keeps its preference rule. The only new outcome is the third
row: a listed but not emphasized duty is weighted one instead of two.

Effect on the Match Score denominator: grouping one sentence of four or five generic duties
turns eight to ten weight points (four or five central requirements weighted two) into a single
requirement. That requirement weighs one when complementary, or two when the posting emphasizes
it. Complementary influence stays capped at 25 percent. The Match Score formula, importance
weights, and Match Band thresholds are unchanged. The behavior test "reserves central importance
for responsibilities the Job Posting emphasizes" covers these rules.

## Cases

| Case | Expectation |
| --- | --- |
| One sentence of generic duties yields one requirement (EN) | "define features", "ensure quality", and "collaborate with product managers" are cited by exactly one requirement, whose excerpt contains all three and which is complementary. The emphasized core mission is central, and "Strong TypeScript experience is required" is critical. |
| Une phrase de missions génériques produit une seule exigence (FR) | Same expectations for "définirez les fonctionnalités, garantirez la qualité et collaborerez avec les product managers". The "mission principale" is central, and "La maîtrise de React est obligatoire" is critical. |
| Distinct technical capabilities in one sentence stay separate | "Production experience with PostgreSQL, Kafka and Kubernetes is required" yields exactly one requirement per technology, each critical. |

Each case runs the live extractor through the application Job Match, so results include the same
source-backing checks and importance normalization the Candidate sees. Each case also enforces a
single provider request and a 45-second latency budget.

## Qualification corpora

`pnpm test:qualification` passed: 5 files and 16 tests, including the cross-segment
(development and held-out splits), general-management, sales-commercial, and document PDF
qualification suites.

**No expected requirement count was changed.** The corpora replay recorded extractions, one
requirement per scenario with its own excerpt and an explicitly reviewed importance. They
exercise the matching workflow directly and never pass through the Job Posting extraction
instructions or the Job Match importance normalization. None of their scenarios contains a
sentence of grouped generic duties. Their expected requirement counts, Match Scores, and
Requirement Groups are therefore unaffected.

## Verification

- `pnpm check` passed: architecture, test conventions, interactive tokens, lint, typecheck,
  package tests, and production build.
- `pnpm test:qualification` passed.
- Live model evaluation: **not executed** (no credentials available).
