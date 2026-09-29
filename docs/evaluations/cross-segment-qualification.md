# Cross-Segment Qualification Harness

The deterministic qualification corpus is `cross-segment-qualification-v1` in
`apps/web/src/model-evaluation/cross-segment-corpus.ts`. It contains 70 reviewed
Candidate/Job Posting pairs: 30 technology, 20 general-management, and 20 sales.
Each fixture records the Source Document, Job Posting, expected Job Requirements and
importance, Match Evidence proposals, prohibited fact/requirement relationships, the
Critical Requirement Reserve, an acceptable Match Score range, and deterministic
writing/provenance/PDF outcomes.

The 30 technology fixtures are explicit rather than generated repetitions. They cover
software engineering, data, security, DevOps/SRE, Tech Lead, Engineering Manager, Head
of Engineering, CTO, and Sales Engineer scenarios in French and English. Scenario tags
also mark short and long postings, overloaded wishlists, duplicate requirements,
strong and partial matches, unsuitable profiles, ambiguities, practical constraints,
hybrid roles, and critical gaps.

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
