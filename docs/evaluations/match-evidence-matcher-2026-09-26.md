# Match Evidence Matcher Evaluation — 2026-09-26

## Configuration

- Model: `gpt-6-luna`
- Reasoning effort: `low`
- Command: `pnpm test:evaluation`
- Result: 7 of 7 representative cases passed

## Results

| Case | Expected coverage | Input tokens | Output tokens | Latency |
| --- | --- | ---: | ---: | ---: |
| Exact skill and controlled translation | TypeScript and French | 337 | 118 | 2,444 ms |
| Unsupported five-year duration | None | 306 | 92 | 2,121 ms |
| Technology present only in a role title | None | 305 | 184 | 2,397 ms |
| Negated technology experience | None | 305 | 50 | 1,322 ms |
| React offered as proof of React Native | None | 301 | 210 | 2,706 ms |
| Java duration offered as TypeScript duration | None | 312 | 128 | 1,876 ms |
| Java seniority offered as TypeScript seniority | None | 313 | 140 | 2,071 ms |

The run consumed 2,179 input tokens and 922 output tokens. Every response stayed below the
2,000-input-token, 1,000-output-token, and 30-second budgets enforced by the suite.

## Provenance and safety

All returned identifiers came from the supplied minimized inputs. The application validator
accepted the two supported controlled relationships and produced no coverage for duration,
role-title, negation, React Native, cross-skill duration, or cross-skill seniority traps. The
evaluation exercises the live provider response through the
same strict schema and deterministic evidence validator used by the application.
