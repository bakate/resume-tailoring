# Cross-Segment Qualification Harness

The deterministic qualification corpus is `cross-segment-qualification-v1` in
`apps/web/src/model-evaluation/cross-segment-corpus.ts`. It contains 70 synthetic
Candidate/Job Posting pairs: 30 technology, 20 general-management, and 20 sales.
Each fixture records the Source Document, Job Posting, expected Job Requirements and
importance, Match Evidence proposals, prohibited fact/requirement relationships, the
Critical Requirement Reserve, an acceptable Match Score range, and deterministic
writing/provenance/PDF outcomes.
The twenty general-management fixtures are explicitly reviewed scenarios: ten French
and ten English examples spanning operations, finance, HR, program leadership, and
cross-functional execution. Their annotations also record practical constraints,
ambiguity type, profile seniority, transferable capabilities, wishlist-heavy postings,
partial matches, and critical gaps.

Development fixtures are kept separate from held-out fixtures in the fixture itself.
The harness selects one split explicitly and never mixes held-out records into the
development report. The default corpus has 48 development fixtures and 22 held-out
fixtures, with every role family represented in both partitions.

Run the deterministic qualification tests with:

```sh
pnpm --filter @resume-tailoring/web exec vitest run src/model-evaluation/cross-segment-qualification.test.ts
```

`qualifyCrossSegmentCorpus` reports independent gates globally and for each role
family. The thresholds follow the MVP specification: 95% extraction recall and
precision, 98% Match Evidence precision, 90% valid-evidence recall, at most five
points mean Match Score error, at most ten points error for any scenario, zero
unsupported Tailored Resume claims, and 100% valid exportable PDFs. The matching
assertions execute the provider-neutral deterministic matching engine; no live model
provider call is needed.

Run the independent general-management qualification with:

```sh
pnpm --filter @resume-tailoring/web exec vitest run src/model-evaluation/general-management-qualification.test.ts
```
