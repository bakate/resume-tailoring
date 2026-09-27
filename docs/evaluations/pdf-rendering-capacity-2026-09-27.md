# PDF rendering capacity baseline

## Decision

Keep PDF rendering synchronous in the modular monolith at a target concurrency of two renders.
The measured target load stayed within a 1.5-second p95 latency budget, a 1.75 GiB peak
resident-memory budget, and zero timeout and rendering-failure budgets. A separate worker and
queue would add operational complexity without addressing a budget that this baseline persistently
breaches.

Extract a PDF worker only when the target-concurrency scenario breaches at least one of those
budgets in three consecutive runs on the production-sized runtime. A single noisy run is not enough
evidence. Concurrency four is a scaling warning, not the current target: its measured p95 latency
ranged from 1.26 to 5.73 seconds and peak resident memory ranged from 2.73 to 2.85 GiB.

## Measured results

Each calibration run started after one warm-up render.

| Recorded at | Target concurrency | Completed renders | p95 latency | Peak resident memory | Timeout rate | Rendering failure rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09-27T09:39:19.712Z | 1 | 12 | 881 ms | 901.9 MiB | 0% | 0% |
| 2026-09-27T09:39:19.712Z | 2 | 12 | 1,030 ms | 1,523.5 MiB | 0% | 0% |
| 2026-09-27T09:39:19.712Z | 4 | 12 | 5,734 ms | 2,794.4 MiB | 0% | 0% |
| 2026-09-27T09:45:24.180Z | 1 | 12 | 654 ms | 940.5 MiB | 0% | 0% |
| 2026-09-27T09:45:24.180Z | 2 | 12 | 807 ms | 1,640.6 MiB | 0% | 0% |
| 2026-09-27T09:45:24.180Z | 4 | 12 | 1,257 ms | 2,922.3 MiB | 0% | 0% |

The service-level budgets were set after these measurements. The latency budget rounds the worse
measured target p95 up from 1.03 to 1.5 seconds. The memory budget rounds the worse measured target
peak up from 1.60 to 1.75 GiB. The successful baseline establishes zero as the timeout and
rendering-failure budgets. The timeout deadline used by the scenario is 10 seconds.

## Scenario

Run the repeatable benchmark from the repository root:

```sh
pnpm benchmark:pdf
```

The command performs one unmeasured warm-up, then renders 12 representative one-page Tailored
Resumes at concurrency levels 1, 2, and 4. Each request follows the production
`createTailoredResumePdf` path, including Chromium launch, semantic HTML rendering, font embedding,
one-page validation, selectable-text validation, and Chromium shutdown. The semantic validator is
deterministic so the measurement isolates the synchronous renderer rather than OpenAI latency.

Peak resident memory includes the benchmark Node process and every descendant Chromium process.
The benchmark prints one machine-readable `PDF_CAPACITY_REPORT` JSON object and does not write PDF
bytes or request content to disk.

## Privacy-safe fixture

The fixture `synthetic-tailored-resume-v1` contains invented professional statements and reserved
`.invalid` contact values. It contains no Candidate content. The benchmark output includes only the
fixture identifier, runtime metadata, request counts, concurrency, latency, memory, timeout rate,
and rendering failure rate; it never logs or persists the rendered HTML or PDF.

## Environment

- Apple M1 Pro, 10 logical CPUs, 16 GiB memory
- macOS 26.6.2 (25G83), arm64
- Node.js 24.15.0
- Puppeteer 25.12.0 with its pinned Chromium runtime
