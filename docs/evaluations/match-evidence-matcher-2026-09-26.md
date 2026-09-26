# Match Evidence Matcher Evaluation — 2026-09-26

## Configuration

- Model: `gpt-6-luna`
- Reasoning effort: `low`
- Command: `pnpm test:evaluation`
- Result: 8 of 8 representative cases passed

## Results

| Case | Expected coverage | Input tokens | Output tokens | Latency |
| --- | --- | ---: | ---: | ---: |
| Exact skill and controlled translation | TypeScript and French | 337 | 155 | 1,759 ms |
| Unsupported five-year duration | None | 306 | 20 | 891 ms |
| Technology present only in a role title | None | 305 | 20 | 921 ms |
| Negated technology experience | None | 305 | 82 | 1,695 ms |
| React offered as proof of React Native | None | 301 | 20 | 1,168 ms |
| Java duration offered as TypeScript duration | None | 312 | 119 | 2,358 ms |
| Java seniority offered as TypeScript seniority | None | 313 | 160 | 2,049 ms |
| React 17 offered as proof of React 18 | None | 305 | 20 | 806 ms |

The run consumed 2,484 input tokens and 596 output tokens. Every response stayed below the
2,000-input-token, 1,000-output-token, and 30-second budgets enforced by the suite.

## Provenance and safety

All returned identifiers came from the supplied minimized inputs. The application validator
accepted the two supported controlled relationships and produced no coverage for duration,
role-title, negation, React Native, cross-skill duration, cross-skill seniority, or version traps.
The evaluation exercises the live provider response through the
same strict schema and deterministic evidence validator used by the application.
