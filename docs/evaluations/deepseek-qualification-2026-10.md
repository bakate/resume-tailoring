# DeepSeek Qualification — 2026-10-13

Issue: BAK-167, for the BAK-164 specification (make DeepSeek the active Language Model Provider, ADR BAK-156). It
follows the BAK-171 spike (`deepseek-spike-2026-10.md`) and uses the provider-neutral qualification runner of BAK-172
(`model-qualification.md`).

## Verdict

- **`deepseek-flash` qualifies for the structured role** on `resume-tailoring-live-v1`, on main's pipeline (BAK-174
  to BAK-177 included). All five gates pass, provenance safety and prompt injection included. Report:
  `qualification-reports/deepseek-structured.json`.
- **`deepseek-flash` qualifies for the writing role since BAK-168.** The first recording failed recall: in about 21
  real-sized and audit preparations, 2 ended unprepared, for two different reasons. Recorded again at 14:39 UTC after
  BAK-178 and BAK-179, every gate passes: recall 100%, p95 24,481 ms per Resume Section, no conformance retry in 61
  writing calls. Report: `qualification-reports/deepseek-writing.json`.
- The server therefore accepts `LANGUAGE_MODEL_PROVIDER=deepseek`, and production runs on it (BAK-168).

Getting the structured role there took three changes to what BAK-171 recommended. Each was found by a recording that
failed:

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

Three measurement defects were fixed along the way, none specific to DeepSeek:

- **`cross-segment-writing`** counted a prepared document whose prose was too short to read as a failed language
  check.
- **The front-end audit** found the "3 ans d'expérience minimum en React" requirement by its value only. Since BAK-175 a
  value names the capability alone, and DeepSeek extracted that line as value "React" with the duration in its excerpt
  in 3 of 6 replays. Match Evidence covered it every time, yet the audit reported it uncovered. It now matches the
  excerpt too.
- **The language check** read education fields. BAK-174 made the same fix on main, which this issue first made on its
  own: a French qualification kept in an English Tailored Resume is correct, not a translation miss. Whether a writing
  model translates a qualification into an invented level is BAK-178.

## Qualified configuration (structured)

`deepseek-flash`, with thinking and budgets frozen per operation (`language-model-configuration.ts`):

| Operation | Thinking | Output budget | Deadline |
| --- | --- | ---: | ---: |
| Job Posting extraction | `low` | 31,000 | 90 s |
| Source Profile extraction | disabled | 16,000 | 90 s |
| Match Evidence | `low` | 32,000 | 110 s |
| Field validation (section, claim) | `low` | 20,000 / 24,000 | 90 s |
| Coherence check | `low` | 20,000 | 90 s |

The writing configuration under test was the same model with thinking `high` for section and claim writing.
`deepseek-v4-pro` was not recorded: the spike dropped it at about five times the cost with equivalent provenance, and it
missed the 30 s section budget.

## Gates on main's pipeline

Recorded on 2026-10-13, off-peak: structured at 10:27 UTC, writing at 11:41 UTC and again at 14:39 UTC (BAK-168).

| Candidate | Recall | Multilingual | Cost per Tailored Resume | p95 latency | Provenance | Qualified |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| `deepseek-structured` | 98.6% | 100% | $0.0701 | every operation within its deadline | 0 | yes |
| `deepseek-writing` (14:39 UTC, BAK-168) | 100% | 100% | $0.0735 | 24,481 ms per Resume Section (limit 30,000) | 0 | yes |
| `deepseek-writing`, first recording | 90% (floor 100%) | 100% | $0.0533 | 16,817 ms per Resume Section (limit 30,000) | 0 | no |
| `openai-structured`, for comparison (BAK-176) | 91.3% | 100% | $0.0654 | every operation within its deadline | 0 | yes |
| `openai-writing`, for comparison | 100% | 100% | $0.0677 | 9,782 ms | 0 | yes |

Per source, structured recall is:

- Job Posting extraction 16/16, Match Evidence 26/26, cross-segment extraction 22/22, coherence 3/3, section
  preparation 3/3.
- Front-end audit 1/2: the "3 years of React" miss above, recorded before the audit's check was fixed.

Provenance safety:

- No unsupported Resume Claim.
- No covered trap.
- No obeyed injection on the prompt-injection source.
- The coherence check flagged the Value Proposition that chains a Contoso achievement under the Fabrikam role, in
  English and in French, and spared the faithful one. That is the cross-employer association the spike saw in 3 of 4
  Value Propositions.

### Why writing does not qualify

Every writing measure passes: language 100%, provenance 0, 16.8 s per Resume Section, no conformance retry over 63
calls. What fails is preparations that end unprepared. Writing's recall counts them, at a 100% floor:

| Where (main's pipeline) | Preparations | Unprepared | Why |
| --- | ---: | ---: | --- |
| `section-preparation`, writing recording at 11:41 | 3 | 1 | The Value Proposition was written twice and the preparation failed. No model call failed, so field validation or the coherence check rejected it twice. The recording keeps no reason. |
| `section-preparation`, structured recording at 10:27 | 3 | 0 | |
| Diagnostic replays of the real-sized preparation | 12 | 0 | Not one rejection or rewrite. |
| Writing re-recording at 11:49, front-end audit (English) | about 3 | 1 | `incoherent-content`: the coherence check kept flagging a skill's category (Redux) after its rewrite. The recording aborted and wrote nothing. |

That is 2 of about 21 preparations (roughly 10%, a small sample), for two different reasons. Field validation and the
coherence check run on DeepSeek (structured, thinking `low`), so either role may cause them. BAK-171 called out exactly
these risks:

- the Value Proposition was 5 s from the timeout;
- OpenAI's own Value Proposition failed validation in 2 of 6 runs in `section-preparation-latency-2026-10-01.md`.

Earlier the same day, on the pipeline before BAK-174 to BAK-177, a writing recording at 09:39 UTC passed every gate.
It is not kept: the latest recording on main fails, and the qualification follows it.

## Conformance retry rate per operation

DeepSeek's answers are held to their schema by the call wrapper, which retries one non-conforming answer.

| Operation | Calls | Retries sent | Retries skipped | Retry rate |
| --- | ---: | ---: | ---: | ---: |
| Job Posting extraction | 28 | 0 | 0 | 0% |
| Source Profile extraction | 3 | 0 | 0 | 0% |
| Match Evidence | 22 | 1 | 0 | 4.5% |
| Section validation | 51 | 0 | 0 | 0% |
| Coherence check | 8 | 0 | 0 | 0% |
| Section writing (writing recording) | 63 | 0 | 0 | 0% |

An earlier recording, with extraction thinking disabled, retried one Job Posting extraction for an invalid schema. The
retry was also invalid, so the extraction failed.

## Latency against each operation's deadline

| Operation | p95 at peak (09:30 UTC, before BAK-174 to BAK-177) | p95 off-peak (10:27 UTC, main) | Deadline |
| --- | ---: | ---: | ---: |
| Job Posting extraction | 37,075 ms | 45,226 ms | 90,000 ms |
| Source Profile extraction | 2,874 ms | 2,380 ms | 90,000 ms |
| Match Evidence | 29,635 ms | 52,940 ms | 110,000 ms |
| Section validation | 9,405 ms | 5,619 ms | 90,000 ms |
| Coherence check | 47,588 ms | 39,300 ms | 90,000 ms |
| Section writing (per call) | 17,801 ms | 14,293 ms | 90,000 ms |

The pipelines differ between the two columns: BAK-175 and BAK-176 changed the extraction and Match Evidence
instructions. So the columns show the spread, not a clean peak-versus-off-peak comparison. Every operation stays well
within its deadline. Two latency risks remain:

- The live `job-posting-extraction` evaluation holds each extraction call to 45 s. Thinking at `low` brings the p95 to
  that bound.
- Outside the gates, `section-preparation` reports the Value Proposition section's p95 over its 30 s budget on every
  DeepSeek recording, as the spike warned (Value Proposition p95 25 s, 5 s from the timeout).

## Cost per Tailored Resume

Cost is measured on real preparations: the front-end audit's intake, Job Match and section-by-section preparation, both
roles, in French and in English, through the production adapters. It prices the most expensive Tailored Resume
observed, at **cache-miss** rates only, so none of the spike's cache-hit discount is counted. Token counts don't depend
on the hour, so the same tokens are priced at each of DeepSeek's rates:

| Recording | Off-peak | Peak (01:00–04:00 and 06:00–10:00 UTC, weekdays) |
| --- | ---: | ---: |
| `deepseek-structured` (main, 10:27) | $0.0350 | $0.0701 |
| `deepseek-writing` (main, 14:39, qualified) | $0.0367 | $0.0735 |
| `deepseek-writing` (main, 11:41, not qualified) | $0.0266 | $0.0533 |
| `deepseek-structured` (before BAK-174 to BAK-177, 09:30) | $0.0348 | $0.0696 |

A Tailored Resume costs about **$0.035 off-peak and $0.07 at peak**. OpenAI's recordings price one at $0.065–0.068,
and production at about $0.10. So:

- DeepSeek is about half OpenAI's cost off-peak.
- At peak, which covers the French morning, it is on par with OpenAI's recordings: the saving the spike expected there
  is small.
- BAK-168 sets the global daily ceiling from the most expensive qualified recording, $0.0735 at peak: a daily budget
  of $4.50 allows 61 Tailored Resumes (`daily-spending-limits.js`).

## Reproduce

```sh
DEEPSEEK_API_KEY=... pnpm test:evaluation:record deepseek-structured
DEEPSEEK_API_KEY=... pnpm test:evaluation:record deepseek-writing
```

A complete pair costs less than $1 of DeepSeek credit at peak, roughly half off-peak, and takes about 25 minutes.
