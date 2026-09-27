# Model Configuration Qualification

Run the live reference suite with:

```sh
OPENAI_API_KEY=... pnpm test:evaluation
```

The suite prints one JSON qualification report for each model role. Preserve that output when
changing a model identifier, reasoning effort, prompt, dataset, pricing, or threshold. Each report
contains the exact configuration, dataset identifier, fixture observations, token cost, latency,
and five independent gates. A single unsupported Resume Claim fails provenance safety regardless
of every other score.

## Reference dataset

Dataset `resume-tailoring-reference-v1` covers:

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

## Fallback policy

Fallback environment variables are fail-closed. A model/effort pair is accepted only when it is
listed for the same role and `resume-tailoring-reference-v1` in
`qualified-model-configurations.ts`. Add a fallback to that registry only after its JSON report
passes the same live suite; a primary-model result is not transferable to a different fallback
configuration.
