# Section preparation latency on a real-sized resume (BAK-71, 2026-10-01)

Scope: model qualification for section-by-section preparation of the Tailored Resume (ADR-0016, spec
[Section-by-Section Resume Preparation](../specs/section-by-section-resume-preparation.md)). It
checks that a real-sized resume finishes, so a latency regression fails evaluation before release
instead of timing out for a Candidate.

**Verdict: not qualified, but not because of latency.** Both latency budgets pass with wide margins.
The slowest Resume Section took 20.3 s against 30 s, and the slowest preparation 33.2 s against
90 s. The outcomes gate fails: 2 of 6 preparations reached a fully validated set of sections and
were then rejected by the final coherence check (`coherent: false`). A Candidate with a real-sized
resume no longer times out, but would get `unsupported-content` in about one preparation in three.
No writing model or reasoning-effort change is recommended. See
[Recommendation](#recommendation).

## Configuration under test

| Role | Model | Reasoning effort | Used for |
| --- | --- | --- | --- |
| Writing | `gpt-6-sol` | medium | `resume-section-writing` |
| Structured | `gpt-6-luna` | low | `resume-section-validation`, `resume-document-coherence` |

The evaluation reads both roles from `validateServerEnvironment`, the same configuration the
section routes read, and records them in its JSON report. The table shows today's only accepted
values.

## Budgets

| Gate | Budget | Rationale |
| --- | --- | --- |
| Per-section p95 latency, per Resume Section of the plan | 30,000 ms | A third of the 90-second per-request timeout. A section near it is one slow retry away from timing out. |
| Whole-preparation wall time, slowest run | 90,000 ms | The per-request timeout the single writing call hit twice in production (BAK-67). No request limits the whole preparation, but the sections together should finish in less time than the one call they replace was given. |
| Outcomes | Every run `prepared` | The preparation guard reaches `prepared` only when every section is validated and the coherence check passed. A fast run without a Tailored Resume is not a pass. |

The budgets live in `sectionPreparationBudgets` (`apps/web/src/model-evaluation/model-evaluation-baselines.ts`).

## Method

- **Fixture** `real-sized-platform-engineer-v1` (`real-sized-resume-corpus.ts`): an anonymized
  twelve-year platform engineering career with fictitious sample organizations. It has:
  - seven experiences with 1 to 6 achievements each;
  - 23 skills, 2 education entries, 3 languages, 2 projects and 2 certifications;
  - a matching Principal Platform Engineer Job Posting with 10 Job Requirements, 9 with Match
    Evidence and 1 with Adjacent Evidence.

  The section plan has 13 Resume Sections: the Value Proposition, seven experiences, skills,
  education, languages, projects and certifications.
- **Pipeline:** `prepareResumeSections` runs the production `resumePreparationMachine`. This
  includes the deterministic plan, at most four concurrent sections, one rewrite for a
  rewritable failure, no retry for a timeout, and the final coherence check.
- **Measurement:** the evaluation wraps the section models and records, without Candidate content:
  - for each Resume Section, by its plan key (`experiences.3`, `skills`, …), its duration, its
    writing call count, and its tokens split between the writing and structured roles;
  - the coherence check's duration and tokens;
  - each run's wall time and outcome.

  The production telemetry is not used for gating because it carries only the section kind, which
  would pool the seven experiences and let one slow experience pass.
- **What a section's latency includes:** time runs from the first writing call to the last call
  for that section. That covers writing, structured validation, and a rewrite when one happens.
  It is stricter than the writing role's latency alone.
- **Not measured:** the browser-to-route HTTP hop. The adapters are called directly, so a
  Candidate waits slightly longer than the recorded wall time.
- **Runs:** three sequential preparations. Each section's p95 is taken over its three samples,
  which is its slowest sample. With so few runs this is a conservative bound, not a statistical
  p95.

## Results

Two live sessions of three runs each, on 2026-10-01 with `pnpm --filter @resume-tailoring/web exec
vitest run src/model-evaluation/section-preparation-qualification.evaluation.test.ts`. The
coherence verdict was added to the measurement after session 1.

### Gates

| Gate | Session 1 | Session 2 | Budget | Status |
| --- | --- | --- | --- | --- |
| Slowest Resume Section (p95 over 3 samples) | 14.0 s (`value-proposition`) | 20.3 s (`value-proposition`) | 30 s | Passed |
| Slowest preparation wall time | 33.2 s | 32.1 s | 90 s | Passed |
| Runs `prepared` | 2 of 3 | 2 of 3 | 3 of 3 | **Failed** |

### Latency of each Resume Section (p95 over 3 samples, ms)

| Resume Section | Session 1 | Session 2 |
| --- | --- | --- |
| `value-proposition` | 13,976 | 20,263 |
| `experiences.0` | 11,572 | 10,022 |
| `experiences.1` | 13,283 | 10,130 |
| `experiences.2` | 9,999 | 9,205 |
| `experiences.3` | 9,240 | 9,306 |
| `experiences.4` | 8,430 | 10,025 |
| `experiences.5` | 10,904 | 5,418 |
| `experiences.6` | 6,451 | 5,362 |
| `skills` | 12,542 | 13,457 |
| `education` | 11,575 | 4,513 |
| `languages` | 4,364 | 4,588 |
| `projects` | 10,283 | 6,124 |
| `certifications` | 4,595 | 4,290 |

### Runs

| Session | Run | Outcome | Wall time | Coherence check | Coherence verdict | Rewritten sections |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 1 | prepared | 32.4 s | 2.4 s | not recorded | none |
| 1 | 2 | **failed** | 30.5 s | 2.7 s | not recorded (every section validated) | none |
| 1 | 3 | prepared | 33.2 s | 3.2 s | not recorded | `value-proposition` |
| 2 | 1 | prepared | 32.1 s | 4.4 s | coherent, language matches | none |
| 2 | 2 | prepared | 30.8 s | 0.9 s | coherent, language matches | `value-proposition` |
| 2 | 3 | **failed** | 31.7 s | 4.7 s | **incoherent**, language matches | none |

In session 1's failed run all 13 sections were validated on their first write. The failure
therefore came from the coherence check as well; its verdict was not yet recorded.

### Tokens (three runs)

| Role | Session 1 input | Session 1 output | Session 2 input | Session 2 output |
| --- | --- | --- | --- | --- |
| Writing (`gpt-6-sol`, medium) | 57,176 | 16,509 | 57,176 | 15,969 |
| Structured (`gpt-6-luna`, low), validation and coherence | 45,618 | 6,644 | 45,140 | 7,306 |

At the configured prices a preparation costs about $0.10: about $0.09 for writing and $0.003 for
the structured role.

### Observations

- **Value Proposition:** it is the slowest section. It receives every Candidate Fact (5,210
  input tokens against about 1,000 for an experience), and in 2 of 6 runs it was rewritten after
  failing validation. That rewrite is what took it to 20.3 s.
- **Waves:** 13 sections at 4 concurrent make the wall time about 31 to 33 s, 1.6 to 2.4 times
  the slowest section. Concurrency is not the bottleneck.
- **Variance:** a section's latency varies up to about 2.8 times between runs (`education`:
  4.1 to 11.6 s, with a near-constant token count). That variance comes from the model service,
  not from the input.

## Recommendation

- **Model and reasoning effort:** keep the writing role at `gpt-6-sol` with medium reasoning.
  The latency budgets pass with a 32% margin per section and a 63% margin on wall time, so
  section-by-section preparation fixes the BAK-67 timeout. Lowering reasoning effort would not
  address the remaining failure.
- **Coherence rejections need a separate investigation** before release. The investigation
  should decide whether the coherence check is right (sections independently repeating the same
  achievement, which per-section writing cannot see) or a false positive. ADR-0016 keeps the
  validated sections visible with `correct-content` recovery, but the Candidate cannot tell what
  to correct. Options for that decision:
  - record a content-free reason with the coherence verdict;
  - give the Value Proposition writer explicit guidance not to restate experience achievements
    word for word;
  - let a failed coherence check rewrite the implicated sections once.

## If the budgets fail in a later run

- If `experience` or `value-proposition` sections exceed the section budget, evaluate the writing
  role at `low` reasoning effort first. Reasoning effort is the cheapest change, and section
  inputs are now small.
- If only the wall time fails, look at waves first: 13 sections at 4 concurrent is 4 waves.
  Raising concurrency is a separate decision under ADR-0016.
- If a section times out or fails validation, that is a correctness finding, not only a latency
  finding. Review it before any model change.
