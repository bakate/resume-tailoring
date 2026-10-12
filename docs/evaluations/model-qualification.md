# Model Configuration Qualification

A Qualified Model Configuration is qualified by the **provider-neutral qualification runner**
(`apps/web/src/model-evaluation/model-qualification-runner.ts`). The runner takes a candidate configuration, runs the
live evaluations of today's production pipeline through the production operation adapters and the AI SDK call wrapper,
and applies five independent gates to what they observed. It never imports a provider package and never branches on
the provider: `pnpm check:architecture` enforces `model-qualification-is-provider-neutral`, and a test qualifies a
configuration of a provider registered only in that test.

## Recording a candidate

```sh
OPENAI_API_KEY=... pnpm test:evaluation:record openai-structured
OPENAI_API_KEY=... pnpm test:evaluation:record openai-writing
```

The candidates, each with the same provider's configuration for the other role, are declared in
`modelConfigurationCandidates` (`model-configurations.ts`). The command runs every live source for the candidate's role,
then writes:

- its observations into `recorded-live-model-evaluation-runs.ts`, under dataset `resume-tailoring-live-v1`, replacing an
  earlier run of the very same configuration;
- its JSON report into `docs/evaluations/qualification-reports/<candidate>.json`.

The run is recorded whether or not the candidate qualifies; `isQualifiedModelConfiguration` only accepts a passing one.
The provider key comes from the local environment only (`languageModelApiKeyVariables`) and signs calls; it never
enters a recorded run or a report. Observations hold counts, latencies, token usage, fixture identifiers and
content-free observed values (outcomes and the names of failed checks), never a prompt, a model answer or
Candidate-like content.

The live evaluations still run on their own, against the configuration the environment validates:

```sh
OPENAI_API_KEY=... pnpm test:evaluation
```

## Live sources and their gates

Every model call a source makes with the configuration under test adds one observation with its latency and token
usage, measured by the call wrapper, whatever the provider. A call made with the companion configuration of the other
role is never counted. Each source adds its own checks:

| Live evaluation | Source | Roles | Extraction recall | Multilingual fidelity | p95 latency | Provenance safety |
| --- | --- | --- | --- | --- | --- | --- |
| `openai-job-posting-extractor.evaluation.test.ts` | `job-posting-extraction` | structured | generic duties collapse, emphasis central, mandatory critical, distinct capabilities | French excerpts copied, never translated | each call | — |
| `openai-job-match-evidence-matcher.evaluation.test.ts` | `match-evidence` | structured | expected coverage, expected Adjacent Evidence, no trap covered | cross-language cases | each call | — |
| `cross-segment-document-qualification.evaluation.test.ts` corpus | `cross-segment-extraction` | structured | held-out requirements cited across technology, general management and sales | French excerpts copied | each call | — |
| `prompt-injection.evaluation.test.ts` | `prompt-injection` | structured | no injected requirement, skill or entry; Kubernetes stays uncovered; no coverage or Match Score raised | — | each call | injected content in the Source Profile or a Candidate Fact |
| `section-preparation-qualification.evaluation.test.ts` | `section-preparation` | both | each run prepared, within the preparation wall-time budget | — | each call; for writing, each Resume Section from its first writing call to its last call, retries included | fields citing no fact or an unknown fact, and fields the field validator rejected that reached the document |
| `front-end-audit.evaluation.test.ts` | `front-end-audit` | both | the audited requirements covered | — | each call | same as section preparation, on the French and English documents |

Notes on the mapping:

- The cross-segment document qualification renders reference documents and calls no model, so its corpus reaches
  qualification through the live extractor. Its PDF and provenance checks of reference documents stay in
  `pnpm test:qualification`.
- A trap covered by Match Evidence is a recall failure, not an unsupported Resume Claim; the live evaluation itself
  still fails on any trap violation.
- The front-end audit's writing defects (pronouns, title agreement, contract types, skill groups, education year) stay
  assertions of the live evaluation; they are not gates.
- The former `resume-writing-en` fixture is replaced by section writing, the production writing path, in the
  `section-preparation` and `front-end-audit` sources. The reformulator is not measured.

## Gates and thresholds of `resume-tailoring-live-v1`

The five gates keep their meaning: extraction recall, multilingual fidelity, p95 latency, cost and provenance safety
(zero unsupported Resume Claims, whatever the other gates). Thresholds are in `liveModelEvaluationThresholds`
(`model-evaluation-baselines.ts`), each with its reason:

| Gate | Structured | Writing | Reason |
| --- | ---: | ---: | --- |
| Extraction recall | 90% | 100% | Unchanged from reference-v1. |
| Multilingual fidelity | 100% | 100% | Unchanged from reference-v1. |
| p95 latency | 45,000 ms | 30,000 ms | Recalibrated: reference-v1 timed ~200-token fixtures. One structured call keeps the 45 s the Job Posting evaluation always allowed; writing shares the Resume Section budget of `sectionPreparationBudgets`. |
| Cost | not calibrated | not calibrated | Recalibrated: reference-v1 priced one pass over ~200-token fixtures. The first live recording (BAK-160) sets it against the ~$0.10 a Tailored Resume costs in production. Until then no live run qualifies. |
| Provenance safety | 0 | 0 | Zero tolerance. |

A gate without a threshold reports `not-calibrated` and never passes. Cost always reads the configuration's
**upper-bound** rates: `pricing` lists every rate the provider charges (peak, off-peak, cache hit…), and the highest
input and output rates price every token, so a configuration is never qualified on an off-peak or cache-discounted
price.

Once the OpenAI configurations are recorded on `resume-tailoring-live-v1` (BAK-160), the reference-v1 recordings and
their dataset below are removed.

## Reference dataset (until BAK-160)

Dataset `resume-tailoring-reference-v1` was recorded by a live runner deleted with the legacy workflow (BAK-83), on the
pre-BAK-83 pipeline. It covers:

- Source Profile extraction;
- Job Requirement extraction;
- matching with controlled translation;
- semantic validation against strengthened seniority, causality, scope, dates, quantity, and
  outcomes;
- faithful French translation;
- resume writing.

The executable fixtures live in
`apps/web/src/model-evaluation/reference-dataset.ts`. Fixture identifiers are stable result keys;
changing a fixture requires a new dataset identifier so an older baseline cannot silently enforce
thresholds on different material.

## Recorded baselines

The initial baselines were recorded on 2026-09-27 for Standard processing and short-context text:

| Baseline | Role | Model | Reasoning | Recall | Multilingual | Cost | p95 latency |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| `structured-model-baseline-2026-09-27` | structured | `gpt-6-luna` | `low` | 100% | 100% | $0.0006324 | 2,786 ms |
| `writing-model-baseline-2026-09-27` | writing | `gpt-6-sol` | `medium` | 100% | 100% | $0.002872 | 2,626 ms |

The calibrated enforcement thresholds preserve measured headroom without collapsing metrics into
one score: structured recall 90%, multilingual fidelity 100%, structured cost $0.001, writing
cost $0.005, and p95 latency 10,000 ms for both roles. Per-fixture outputs and measurements are
stored in `recorded-model-evaluation-runs.ts`. Writing has no extraction fixture, so its
recall value is neutral; extraction quality is owned and gated by the structured role.

These are independent ceilings or floors, not an aggregate score. Provenance safety is always a
zero-tolerance gate. The code refuses to enforce the other four gates when the baseline dataset
does not match or no baseline exists.

Pricing recorded in the configurations is $0.10 input / $0.50 output per million tokens for
GPT-6 Luna and $2 input / $10 output for GPT-6 Sol. Sources:

- <https://developers.openai.com/api/docs/models/gpt-6-luna>
- <https://developers.openai.com/api/docs/models/gpt-6-sol>

## Qualified Model Configurations

A Qualified Model Configuration is a provider, a model, a model role and frozen provider options:
`{ provider: 'openai', model, role, providerOptions: { reasoningEffort, store: false, strictJsonSchema: true } }`.
`isQualifiedModelConfiguration` compares the whole configuration, provider and every provider option
included, nested ones such as per-operation output token budgets too, against the passing reports in
`qualified-model-configurations.ts`. Changing any option makes the configuration unqualified until it is recorded
again.

`LANGUAGE_MODEL_PROVIDER` selects the one active Language Model Provider (only `openai` exists; it is
the default when unset). Environment validation rejects a provider, a model or a reasoning effort that
no Qualified Model Configuration backs, so the per-role `OPENAI_*` settings stay frozen at their
qualified values. The active provider also determines the Processing Policy the landing serves.

A refused selection never reaches production:

- `deployment-environment.test.ts` validates the environment `template.yaml` deploys. It runs in
  `pnpm check`, which gates the production deployment.
- `scripts/check-production.sh` fails the deployment when the deployed landing states no Processing
  Policy.
- At runtime, a refused selection disables the Candidate Journey: the landing renders without a
  Processing Policy, and every model route answers `service-misconfigured`.

## Fallback policy

Fallback environment variables are fail-closed. A fallback is accepted only when its whole
configuration is qualified for the same role, on `resume-tailoring-reference-v1` or
`resume-tailoring-live-v1`, and it always uses the active provider: a fallback from another provider does not
type-check. Declare a fallback as a candidate and record it with `pnpm test:evaluation:record`; a primary-model result
is not transferable to a different fallback configuration.

## Transport

Model requests go through the AI SDK (`ai`, `@ai-sdk/openai` on the Responses API) since BAK-157.
The 2026-09-27 baselines were recorded through the previous hand-written transport. Requalifying both
roles through the AI SDK with `pnpm test:evaluation:record` is BAK-160; until then the 2026-09-27
baselines remain the recorded qualification.
