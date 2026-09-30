# Cross-Segment Qualification Harness

The deterministic qualification corpus is `cross-segment-qualification-v1` in
`apps/web/src/model-evaluation/cross-segment-corpus.ts`. It contains 70 reviewed
Candidate/Job Posting pairs: 30 technology, 20 general-management, and 20
reviewed sales and commercial scenarios sourced from
`apps/web/src/model-evaluation/sales-commercial-corpus.ts`.
Each fixture records the Source Document, Job Posting, expected Job Requirements and
importance, Match Evidence proposals, prohibited fact/requirement relationships, the
Critical Requirement Reserve, an acceptable Match Score range, and deterministic
writing/provenance/PDF outcomes.
The twenty general-management fixtures are explicitly reviewed scenarios: ten French
and ten English examples spanning operations, finance, HR, program leadership, and
cross-functional execution. Their annotations also record practical constraints,
ambiguity type, profile seniority, transferable capabilities, wishlist-heavy postings,
partial matches, and critical gaps.

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

`qualifyCrossSegmentCorpus` reports independent matching gates globally and for each
role family: 95% extraction recall and precision, 98% Match Evidence precision, 90%
valid-evidence recall, at most five points mean Match Score error, and at most ten
points error for any scenario. The matching assertions execute the provider-neutral
deterministic matching engine; no live model provider call is needed. The development
split qualifies. The held-out split is asserted separately and currently fails in the
technology role family (see the BAK-60 qualification record); it is marked `it.fails`
rather than tuned.

`qualifyCrossSegmentDocuments` measures the two document gates that were previously
fixture booleans: zero unsupported resume claims and 100% valid exportable PDFs. For
each scenario it writes a reference document from the scenario's Candidate Facts,
checks every professional field with the application claim validator, and renders it
through the production Puppeteer renderer (A4, embedded fonts, reading order, at most
two pages, export eligibility). It does not measure live writing quality; that remains
the job of the live model evaluation and the human reference review.

Run every deterministic and rendered qualification gate with:

```sh
pnpm test:qualification
```

Run the independent general-management qualification with:

```sh
pnpm --filter @resume-tailoring/web exec vitest run src/model-evaluation/general-management-qualification.test.ts
```
