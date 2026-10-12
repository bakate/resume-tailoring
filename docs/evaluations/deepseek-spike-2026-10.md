# DeepSeek Schema Conformance Spike — 2026-10-12

Issue: BAK-171, for the BAK-164 specification (make DeepSeek the active Language Model Provider, ADR BAK-156).

## Question

DeepSeek offers JSON mode only (`response_format: json_object`). It does not enforce the schema and can return empty content. Can it still hold the product's quality bar, provenance first, before the AI SDK work (BAK-157) and the provider work (BAK-166, BAK-167) are built on it?

## Verdict

**Go with changes to BAK-166 and BAK-167.** Schema conformance and provenance hold on all three operations. One default would break production: DeepSeek counts reasoning tokens inside `max_tokens`. Under the production output budget, explainable match evidence on the real-sized resume came back empty or truncated in 7 of 8 runs. A retry with the same request never recovered it.

## Method

- Script: `scripts/spikes/deepseek-conformance.mjs`. It is throwaway and not imported by `apps/web/src`, CI or `pnpm check`. Run it from the repository root:
  `pnpm dlx tsx@4.20.3 --env-file=.env.local scripts/spikes/deepseek-conformance.mjs <out-dir-outside-the-repo> [runs] [operation]`
- The production adapters are called unchanged: `requestOpenAiJobPostingExtraction`, `requestOpenAiJobMatchEvidence` and `createOpenAiResumeSectionWriter`. Each accepts an injected `fetch`. The script's `fetch` turns the Responses API body into a DeepSeek `chat/completions` call:
  - the developer instructions become the system message;
  - the JSON Schema of `text.format` is appended to the system message, with a placeholder example built from that schema and the word "json";
  - `response_format: { type: 'json_object' }` is set, and the production output budget is kept as `max_tokens`.
  
  The answer is then mapped back to the Responses envelope. The production instructions, zod schemas and parsers therefore decide conformance.
- Section writing runs the production `prepareResumeSections` on the real-sized resume, so the writer gets the real section plan, budgets and inputs. Field validation and the coherence check are stubbed as passing. This spike measures the writer, not the safety net behind it.
- Retry rule under test: a non-conformant answer is retried once with the same request.
- Effort mapping from the production configuration: the structured role's `low` stays `low`, and the writing role's `medium` becomes `high`. DeepSeek accepts only `low`, `high` and `max`. Thinking is on by default. Two variants test thinking disabled and a raised budget.
- The key came from the local `DEEPSEEK_API_KEY` only. It was never committed or logged.
- Run on 2026-10-12, 14:58–15:09 UTC (off-peak), with 20 runs per operation and variant, and 26 section writes per model.

### Corpora (synthetic, fictional or anonymized only)

| Operation | Inputs |
| --- | --- |
| Job Posting extraction | `real-sized-resume-corpus.ts` posting ×4, `front-end-audit-corpus.ts` posting ×4, 12 `cross-segment-corpus.ts` fixtures (technology, general management and sales, 4 each) |
| Match evidence | `real-sized-resume-corpus.ts` facts and requirements ×8, 12 `cross-segment-corpus.ts` fixtures. Their ids are prefixed `source-fact-` / `job-requirement-` to meet the production id contract. |
| Section writing | `real-sized-resume-corpus.ts` (anonymized twelve-year platform career, 13 sections), two preparations per model |

No real Candidate content was sent.

## Results

### Schema conformance

"Non-conformant" covers empty, unparseable and schema-invalid answers. In the "First attempt" and "After one retry" columns, the count is out of the first attempts.

| Operation | Model and effort | First attempt non-conformant | After one retry | Cause |
| --- | --- | --- | --- | --- |
| Extraction | flash, low | 0 / 20 | 0 | — |
| Extraction | flash, thinking off | 0 / 20 | 0 | — |
| Match evidence | flash, low, **production budget 8,000** | **7 / 20** (4 empty, 3 unparseable) | **7** | all `finish_reason: length`, all on the real-sized resume (7 of 8); reasoning used the whole budget |
| Match evidence | flash, low, `max_tokens` 32,000 | 0 / 20 | 0 | — |
| Match evidence | flash, thinking off | 2 / 20 (schema-invalid) | 0 | an extra key in `relevance[].factMatch` (`unrecognized_keys`, rejected by `z.strictObject`) |
| Section writing | flash, high | 0 / 26 | 0 | — |
| Section writing | v4-pro, high | 0 / 26 | 0 | — |

No answer was empty with `finish_reason: stop`. Every empty answer came from the budget.

### Provenance

| Operation | Check | flash | v4-pro |
| --- | --- | --- | --- |
| Extraction | requirements whose `sourceExcerpt` is absent from the posting | 0 / 111 (low), 0 / 97 (off) | — |
| Match evidence | fact matches citing an unknown fact or requirement | 0 / 863 | — |
| Match evidence | fact excerpts not verbatim in their fact | 0 (thinking on), 2 / 345 (thinking off). The matching engine discards them. | — |
| Section writing | fields citing no fact, or a fact absent from the input | 0 / 162 | 0 / 162 |
| Section writing | fields with a word absent from their cited facts (manual read) | 1 / 162 | 1 / 162 |

A manual read of every field against its cited facts gives this picture:

- **Experiences, skills, education, languages, projects, certifications.** Both models stay close to verbatim: role, employer and dates are copied, and achievements are lightly condensed. Nothing unsupported was found, and no em dash appeared.
- **Value Proposition**, the riskiest section and the one OpenAI rewrote after validation in 2 of 6 baseline runs:
  - flash: "maintained an open-source Terraform provider", supported by the cited project fact.
  - v4-pro: "a record of building and operating Kubernetes platforms on AWS at scale" adds a mild "at scale".
  - Both models chain achievements from Fabrikam (Staff Platform Engineer) and Contoso (Senior SRE) under the Staff Platform Engineer opener without naming Contoso, in 3 of 4 Value Propositions. Each proposition is backed by a cited fact, so field validation would accept it. It is a `mixed-association` that only the coherence check can catch.
- **Comparison with OpenAI.** Recorded OpenAI baseline outputs for this corpus do not exist: `section-preparation-latency-2026-10-01.md` kept outcomes, not text, and no OpenAI key was available for this spike. The comparison therefore stops at outcomes. OpenAI's Value Proposition failed validation in 2 of 6 runs. DeepSeek's Value Propositions carry the same class of risk, a cross-employer association, without inventing facts.

### Match evidence quality on the real-sized resume

The fixture expects 9 requirements with evidence and 1 Adjacent Evidence (service mesh).

| Variant | Requirements with evidence per run | Adjacent Evidence per run | Fact matches per run |
| --- | --- | --- | --- |
| flash, low, 32,000 | 9 in 8 / 8 runs | 1 in 8 / 8 | 38–66 |
| flash, thinking off | 9 in 5 / 8 runs, 8 in 3 | 0–2 | 21–54 |

Production makes two judgments per match and keeps the strongest. That softens the thinking-off misses but does not remove them.

### Tokens and latency per call (representative inputs)

The representative inputs are the real-sized and front-end postings, and the real-sized facts and resume.

| Operation | Model and effort | Prompt tokens | Completion tokens (of which reasoning) | p50 latency | p95 latency |
| --- | --- | --- | --- | --- | --- |
| Extraction | flash, low | 1,138 | 5,141 | 22.6 s | 39.5 s |
| Extraction | flash, off | 1,113 | 822 | 3.2 s | 4.2 s |
| Match evidence | flash, low, 32,000 | 5,529 | 12,919 | 40.7 s | **82.1 s** |
| Match evidence | flash, off | 5,504 | 2,467 | 7.9 s | 10.4 s |
| Section writing | flash, high | 2,611 | 1,220 (925) | 4.3 s | 24.9 s |
| Section writing | v4-pro, high | 2,662 | 1,832 (1,475) | 10.0 s | **59.0 s** |

Reasoning effort `low` is not small on DeepSeek: extraction reasoned 900 to 10,600 tokens for the same posting.

Section p95 by kind, against the 30 s budget of `sectionPreparationBudgets`:

| Model | Value Proposition | Experiences | Skills | Preparation wall time |
| --- | --- | --- | --- | --- |
| flash | 25.5 s | 17.5 s | 12.4 s | about 25 s |
| v4-pro | **84.9 s** | **59.0 s** | **37.4 s** | about 85 s |

The OpenAI baseline was a 20.3 s Value Proposition and 30.5–33.2 s per preparation. v4-pro misses the 30 s section budget, and its Value Proposition is 5 s away from the 90 s request timeout.

### Cost per Tailored Resume

Prices (USD per 1M tokens):

| Model | Cache hit | Cache miss | Output |
| --- | --- | --- | --- |
| flash | $0.003–0.006 | $0.15–0.30 | $0.60–1.20 |
| v4-pro | $0.022–0.044 | $0.66–1.32 | $1.98–3.96 |

Each range runs off-peak to peak. Peak hours are 01:00–04:00 and 06:00–10:00 UTC on weekdays.

The extrapolation assumes one extraction and two match evidence judgments (the three intake and matching requests), plus 21 section requests on average and 30 at p90. Every section request is costed as a measured write, because validation and coherence were not measured. Under "v4-pro writing", half the section requests are v4-pro writes and half are flash.

In the table, "Off-peak, as measured" uses the cache hits observed. Those are inflated, because the spike repeats identical inputs. "Peak, no cache hit" is the upper bound.

| Configuration | Off-peak, as measured | Peak, no cache hit |
| --- | --- | --- |
| flash everywhere, intake thinking off | $0.020 (p90 $0.027) | $0.058 (p90 $0.078) |
| flash everywhere, intake thinking low with 32,000 | $0.035 (p90 $0.042) | $0.088 (p90 $0.108) |
| v4-pro writing, flash elsewhere, intake thinking low with 32,000 | $0.066 (p90 $0.086) | $0.178 (p90 $0.236) |

For reference, the OpenAI baseline was about $0.10 for one 13-section preparation alone (`section-preparation-latency-2026-10-01.md`).

## Recommendation

**Go with changes.**

1. **BAK-166: size `max_tokens` for reasoning.** DeepSeek counts reasoning inside `max_tokens`. The production budgets (8,000 for matching, 16,000 for writing, 20,000 for extraction) are output budgets sized for OpenAI. Give match evidence at least 32,000, and review the other two against the measured reasoning (up to 10,600 tokens on extraction at `low`).
2. **BAK-166: classify `finish_reason: length` as its own failure, and do not retry it unchanged.** Every failure at the production budget was a truncation, and 7 of 7 identical retries failed again. Keep the single retry for a schema-invalid answer: both thinking-off schema failures recovered on retry.
3. **BAK-166: keep the client-side `z.strictObject` parse as the conformance gate.** The schema and example in the system message were enough for 0 empty and 0 unparseable answers whenever the budget sufficed. The only schema failures were extra keys, which the strict parse catches.
4. **BAK-167: qualify flash for the writing role, not v4-pro.**
   - Provenance was equivalent: 0 uncited or unknown facts and 1 embellished field each.
   - flash meets the 30 s section budget. v4-pro misses it on every long section and nearly reaches the 90 s timeout.
   - flash costs about a fifth as much.
5. **BAK-167: qualify the structured role on flash with thinking `low`, and decide the match evidence budget and timeout together.** Thinking off is about 4× cheaper and 8× faster, but it lost a requirement in 3 of 8 matches. Thinking on with 32,000 was exact in 8 of 8, at a p95 of 82 s, close to the 90 s timeout. Extraction was 0 / 20 non-conformant and fully source-backed with thinking off, so it can run off.
6. **BAK-167: qualify field validation and the coherence check on DeepSeek before go-live.** They were stubbed here, yet they are the only net for the cross-employer associations seen in 3 of 4 Value Propositions.
7. **BAK-167: re-measure cost on real traffic.** The cache-hit rate here is inflated by repeated inputs. Budget against the peak, no-cache-hit bound, about $0.06 to $0.11 per Tailored Resume on flash.
