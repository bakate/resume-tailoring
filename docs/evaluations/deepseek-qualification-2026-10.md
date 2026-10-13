# DeepSeek Qualification — 2026-10-13

Issue: BAK-167, for the BAK-164 specification (make DeepSeek the active Language Model Provider, ADR BAK-156). It
follows the BAK-171 spike (`deepseek-spike-2026-10.md`) and uses the provider-neutral qualification runner of BAK-172
(`model-qualification.md`).

## Verdict

**`deepseek-flash` qualifies for both model roles** on `resume-tailoring-live-v1`. All five gates pass, provenance
safety and prompt injection included. Reports: `qualification-reports/deepseek-structured.json` and
`qualification-reports/deepseek-writing.json`.

Getting there took three changes to what BAK-171 recommended. Each was found by a recording that failed:

1. **Job Posting extraction thinks at `low`, not disabled.** Without thinking, recall was about 60% over three runs of
   the `job-posting-extraction` source (9/16, 11/16, 9/16). Generic duties came back one requirement per phrase, and
   importance wasn't read from the wording. At `low` it was about 94% (13/16, 16/16, 16/16), for 15–21 s and under
   4,000 tokens a call. The spike had checked conformance and source-backing only, never these recall rules.
2. **The extraction instructions require values in the Job Posting's language.** Without thinking, DeepSeek translated
   the French audit posting's requirement values into English in 6 of 15 replays, while copying the excerpts verbatim.
   The application then found no source-backed requirement and refused the whole extraction. That would be an outage
   for French Candidates. After the change: 0 of 15.
3. **Structured latency is gated per operation.** Each operation's p95 must stay within its own qualified deadline,
   instead of one 45 s figure over every structured call. Match Evidence has a 110 s deadline (BAK-166).

Two measurement defects were fixed along the way, neither specific to DeepSeek:

- `cross-segment-writing` counted a prepared document whose prose was too short to read as a failed language check.
- The language check read education fields. Section writing preserves a qualification and its institution "without
  invented levels", so an English Tailored Resume that keeps "Licence professionnelle …, Université de Lille" is
  correct, not a translation miss. Whether a writing model translates a qualification into an invented equivalent
  level is BAK-178.

## Qualified configurations

`deepseek-flash` for both roles, with thinking and budgets frozen per operation (`language-model-configuration.ts`):

| Operation | Role | Thinking | Output budget | Deadline |
| --- | --- | --- | ---: | ---: |
| Job Posting extraction | structured | `low` | 31,000 | 90 s |
| Source Profile extraction | structured | disabled | 16,000 | 90 s |
| Match Evidence | structured | `low` | 32,000 | 110 s |
| Field validation (section, claim) | structured | `low` | 20,000 / 24,000 | 90 s |
| Coherence check | structured | `low` | 20,000 | 90 s |
| Section writing | writing | `high` | 20,000 | 90 s |
| Claim writing | writing | `high` | 16,000 | 90 s |

`deepseek-v4-pro` was not recorded: the spike dropped it at about five times the cost with equivalent provenance, and
it missed the 30 s section budget. `deepseek-flash` is therefore the cheapest, and only, passing writing model.

## Gates

Recorded on 2026-10-13: structured at 09:30 UTC, writing at 09:39 UTC. Both were at peak hours.

| Candidate | Recall | Multilingual | Cost per Tailored Resume | p95 latency | Provenance | Qualified |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| `deepseek-structured` | 94.4% | 100% | $0.0696 | every operation within its deadline | 0 | yes |
| `deepseek-writing` | 100% | 100% | $0.0673 | 17,801 ms per Resume Section (limit 30,000) | 0 | yes |
| `openai-structured`, for comparison (BAK-176) | 91.3% | 100% | $0.0654 | every operation within its deadline | 0 | yes |
| `openai-writing`, for comparison | 100% | 100% | $0.0677 | 9,782 ms | 0 | yes |

Per source, structured recall is:

- Job Posting extraction 13/16: "PostgreSQL, Kafka and Kubernetes is required" still yielded no critical requirement
  per technology. BAK-175 has since changed the extraction instructions for this.
- Match Evidence 25/26: one Adjacent Evidence case missed.
- Cross-segment extraction 22/22, coherence 3/3, section preparation 3/3, front-end audit 2/2.

Provenance safety:

- No unsupported Resume Claim.
- No covered trap.
- No obeyed injection on the prompt-injection source.
- The coherence check flagged the Value Proposition that chains a Contoso achievement under the Fabrikam role, in
  English and in French, and spared the faithful one. That is the cross-employer association the spike saw in 3 of 4
  Value Propositions.

## Conformance retry rate per operation

DeepSeek's answers are held to their schema by the call wrapper, which retries one non-conforming answer:

| Operation | Calls | Retries sent | Retries skipped | Retry rate |
| --- | ---: | ---: | ---: | ---: |
| Job Posting extraction | 28 | 0 | 0 | 0% |
| Source Profile extraction | 3 | 0 | 0 | 0% |
| Match Evidence | 22 | 0 | 0 | 0% |
| Section validation | 53 | 0 | 0 | 0% |
| Coherence check | 8 | 0 | 0 | 0% |
| Section writing | 66 | 0 | 0 | 0% |

An earlier recording, with extraction thinking disabled, retried one Job Posting extraction for an invalid schema. The
retry was also invalid, so the extraction failed.

## Latency against each operation's deadline

| Operation | p95 | Deadline |
| --- | ---: | ---: |
| Job Posting extraction | 37,075 ms | 90,000 ms |
| Source Profile extraction | 2,874 ms | 90,000 ms |
| Match Evidence | 29,635 ms | 110,000 ms |
| Section validation | 9,405 ms | 90,000 ms |
| Coherence check | 47,588 ms | 90,000 ms |
| Section writing (per call) | 17,801 ms | 90,000 ms |

Match Evidence's p95 is 29.6 s against its 110 s deadline, far from the 82 s the spike measured off-peak on the same
settings. Two more points:

- The live `job-posting-extraction` evaluation also holds each extraction call to 45 s. Its 37 s p95 at `low` passes,
  but with little headroom.
- Outside the gates, `section-preparation` still reports the **Value Proposition section's p95 over its 30 s budget**,
  and once the whole preparation over its 90 s wall time. These are live-run checks of `sectionPreparationBudgets`, not
  gates. They are the latency risk to watch on DeepSeek, as the spike warned (Value Proposition p95 25 s, 5 s from the
  timeout).

## Cost per Tailored Resume

Cost is measured on real preparations: the front-end audit's intake, Job Match and section-by-section preparation, both
roles, in French and in English, through the production adapters. It prices the most expensive Tailored Resume
observed, at **cache-miss** rates only, so none of the spike's cache-hit discount is counted. Token counts don't
depend on the hour, so the same tokens are priced at each of DeepSeek's rates:

| Recording | Off-peak | Peak (01:00–04:00 and 06:00–10:00 UTC, weekdays) |
| --- | ---: | ---: |
| `deepseek-structured` (its own front-end audit) | $0.0348 | $0.0696 |
| `deepseek-writing` (its own front-end audit) | $0.0337 | $0.0673 |

The cost gate reads the peak, cache-miss rate, against $0.12. A Tailored Resume costs about **$0.035 off-peak and
$0.07 at peak**. OpenAI's recordings price one at $0.065–0.068, and production at about $0.10. So:

- DeepSeek is about half OpenAI's cost off-peak.
- At peak, which covers the French morning, it is on par with OpenAI's recordings: the saving the spike expected
  there is small.
- BAK-168 sets its budget from these numbers.

Latency was measured at peak only. No off-peak recording was made on the qualified configuration.

## Recorded before BAK-174 to BAK-177

These recordings ran on the pipeline as of BAK-166 plus this issue's changes. Four changes merged to main the same
morning, before this issue:

- the extraction instructions give each technical capability listed in one sentence its own critical requirement
  (BAK-175);
- Match Evidence coverage instructions and validation changed (BAK-176);
- a Resume Section is timed by its own calls, without the wait before its coherence rewrite (BAK-177);
- education and certifications are left out of the language check (BAK-174).

A Qualified Model Configuration is matched on its settings, not its prompts, so these recordings still qualify
`deepseek-flash`. A recording keeps no prompt or answer, so they cannot be replayed on the new prompts. Re-recording both
candidates measures DeepSeek on main's pipeline. It takes about 25 minutes and less than $1 of DeepSeek credit at peak,
roughly half off-peak.

## Reproduce

```sh
DEEPSEEK_API_KEY=... pnpm test:evaluation:record deepseek-structured
DEEPSEEK_API_KEY=... pnpm test:evaluation:record deepseek-writing
```
