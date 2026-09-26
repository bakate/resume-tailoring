# Match Evidence Matcher Evaluation — 2026-09-26

## Configuration

- Model: `gpt-6-luna`
- Reasoning effort: `low`
- Command: `pnpm test:evaluation`
- Result: 4 of 4 representative cases passed

## Results

| Case | Expected coverage | Input tokens | Output tokens | Latency |
| --- | --- | ---: | ---: | ---: |
| Exact skill and controlled translation | TypeScript and French | 337 | 119 | 1,432 ms |
| Unsupported five-year duration | None | 306 | 112 | 1,580 ms |
| Technology present only in a role title | None | 305 | 20 | 864 ms |
| Negated technology experience | None | 305 | 52 | 2,337 ms |

The run consumed 1,253 input tokens and 303 output tokens. Every response stayed below the
2,000-input-token, 1,000-output-token, and 30-second budgets enforced by the suite.

## Provenance and safety

All returned identifiers came from the supplied minimized inputs. The application validator
accepted the two supported controlled relationships and produced no coverage for duration,
role-title, or negation traps. The evaluation exercises the live provider response through the
same strict schema and deterministic evidence validator used by the application.
