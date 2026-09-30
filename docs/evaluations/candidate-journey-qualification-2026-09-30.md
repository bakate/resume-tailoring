# Candidate Journey qualification (BAK-60, 2026-09-30)

Scope: integration evidence for BAK-55 after BAK-56 to BAK-59 merged. This record does not
authorize a production deployment and does not change the BAK-55 specification.

**Verdict: not yet qualified.** Automated integration gates pass except the held-out technology
matching gates. Two gates remain pending: human reference review and the live-model evaluation.

## Gate summary

| Gate | Status | Evidence |
| --- | --- | --- |
| Rendered one-action journey to validated PDF | Passed | Browser integration suite |
| Real boundary connections (writer, edits, restore, overflow, condensation) | Passed | Browser integration suite, editing behavior tests |
| Scenario coverage (ambiguity, coverage, normalized, FR/EN, invalidation, reuse, reload, deletion) | Passed | Browser smoke and integration suites, combined-intake behavior tests |
| Keyboard, focus, announcements, reduced motion, mobile path | Passed on Chromium; **failing on WebKit and Firefox mobile** | See finding 6 |
| Screenshot regressions (anonymized) | Passed | Browser integration suite, HTML document tests |
| Development qualification, all role families | Passed | `pnpm test:qualification` |
| Held-out qualification, technology role family | **Failed** | See finding 3 |
| Held-out qualification, general management and sales | Passed | `pnpm test:qualification` |
| Zero unsupported claims and valid exportable PDFs, all 70 scenarios | Passed | Rendered document qualification |
| Live model evaluation (`pnpm test:evaluation`) | **Pending** | Needs `OPENAI_API_KEY`; not run |
| Human reference review (four profiles) | **Pending** | [Reference document review](reference-document-review.md) |
| Architecture, conventions, lint, type check, behavior, build | Passed | `pnpm check` |
| Privacy-safe journey, correction, download, usability telemetry | Passed | Telemetry behavior tests, browser analytics assertions |

## Evidence by acceptance criterion

### Rendered flow and normal path

`apps/web/test/candidate-journey.integration.test.ts` drives the real web application with
recorded model adapters and the real Puppeteer PDF renderer. It covers the full sequence:
start, consent, combined intake, one **Generate my resume** action, preview, a supported summary
correction validated at the affected field, then download.

The downloaded PDF is parsed with PDF.js. The suite asserts:

- the PDF contains the correction and not the replaced wording;
- the Match Analysis disclosure stays collapsed;
- no approval control exists in the normal path;
- the preview precedes the intake form.

A second test downloads without any professional edit.

### Boundary connections

- Writer output: the recorded writer document is grouped in the downloaded PDF and preview.
- Supported edits: a supported summary edit reaches the downloaded PDF.
- Restored content: a restored omitted achievement reaches the downloaded PDF.
- Measured overflow: restoring 36 omitted achievements produces real Chromium overflow.
  Export stays blocked and the restored content is kept.
- Condensation, covered in separate tests:
  - An accepted proposal replaces the draft with the proposal's wording, and the document fits.
  - A rejected proposal keeps the overflowing draft.
  - A failed proposal (writer unavailable) keeps the draft and shows the failure.
  - A contact change after the proposal discards the stale proposal without changing the draft.
  - When condensation is insufficient, the Candidate hides an experience, which stays
    restorable, and export becomes available.

### Scenarios

- Existing browser smoke tests cover:
  - nonblocking and blocking ambiguity;
  - low coverage, and no correspondence with a normalized PDF;
  - French preview;
  - interrupted generation after reload, retry after failure, and stable preview after failed
    regeneration;
  - deletion before generation.
- The new integration suite adds:
  - a posting change after a preview, which pauses export and removes the stale pages;
  - another opportunity in the same session, with one source extraction and two posting
    extractions;
  - a French PDF download;
  - deletion after a download, leaving no preview, no stored session, and nothing after reload.

### Accessibility and mobile

- The keyboard test runs under `prefers-reduced-motion: reduce`. It starts the session, grants
  consent and generates using keyboard activation only. It asserts:
  - the polite live region announces the validated result;
  - transitions are suppressed;
  - the editor opens with Enter and returns focus on Escape.
- A 412 px touch viewport runs the full intake, preview, full-screen section editing and export
  path. It asserts no horizontal scrolling and preview-first order.
- Cross-browser results are recorded below.

### Screenshot regressions

The anonymized fixture (Alex Morgan, Northwind, Contoso; synthetic) guards all four regressions:

- The downloaded PDF has one `Front-end` category label.
- Role, employer, dates and achievement appear together in reading order.
- No list item holds only an employer, a date or a category.
- The summary is a single prose paragraph, not a list item.
- No field editor precedes the preview.

The existing HTML document tests remain.

### Qualification process

- Matching gates run on the development split and on the untuned held-out split. The held-out
  split was never asserted before this ticket. Only a synthetic failure case was checked.
- The document gates previously read hardcoded `true` fixture booleans. They are now measured
  by rendering every scenario through the production renderer and validating field provenance.
  Results:

  | Split | Scenarios | Exportable | Unsupported fields | Page counts | Purposes | Languages |
  | --- | --- | --- | --- | --- | --- | --- |
  | Development | 48 | 48 | 0 | 48 × 1 | 45 tailored, 3 normalized | 38 EN, 10 FR |
  | Held-out | 22 | 22 | 0 | 22 × 1 | 21 tailored, 1 normalized | 17 EN, 5 FR |

- These reference documents are written deterministically from the scenario facts, so they
  prove the provenance validator and PDF contract, not live writing quality.

### Privacy-safe telemetry

- The active journey records only these allowlisted events: session opened, phase reached,
  correction, download (with match band), usability answer, deletion, and expiration.
- Behavior tests at the Candidate Journey seam assert that no event contains Candidate content.
- Browser tests capture `/api/analytics` payloads and assert the same.

## Findings

1. **Fixed — sensitive attribute presented as the Candidate name.** Combined intake used the
   first locally detected `personal-information` match as the resume identity. That detector
   only matches labeled sensitive attributes such as nationality, gender or marital status. A
   source line such as `Nationality: French` therefore became the name heading of the preview
   and PDF.
   - The identity now starts empty and is entered locally.
   - A regression test is in `combined-intake.behavior.test.ts`.
2. **Fixed — usability feedback and journey telemetry lost at the BAK-54 cutover.** The active
   journey never recorded opened, phase, deletion or expiration events. It had no "usable
   without structural rewriting" question. Download telemetry lived in the UI.
   - These are now journey actions.
   - After each download the Candidate can answer whether the PDF is usable without
     restructuring. Only the boolean and match band are recorded.
3. **Failed gate — held-out technology matching.**
   - Scenario `technology-29` (Sales Engineer, "technical discovery and quota support") scores
     0 instead of 100.
   - Cause: the matching engine treats `and` as a clause separator, so a single requirement
     concept containing `and` can never be proven.
   - Resulting technology held-out gates: Match Evidence precision 0.889, valid-evidence recall
     0.889, mean score error 10, maximum error 100.
   - This is not fixed here, because fixing it from a held-out scenario would tune on held-out
     data. The fix needs a development-split example first. The test is marked `it.fails`.
4. **Observation — preview pages require the name.** Names are never detected automatically.
   BAK-59 returns PDF bytes only for exportable documents. So after generation the Candidate
   sees an alert asking for the name, and the rendered pages appear only once it is entered;
   the text version is available before that. This follows the BAK-59 contract, so it is left
   for the product owner and recorded in the reference review.
5. **Observation — French apostrophes in extracted PDF text.** Copied text contains `ʼ` (U+02BC),
   sometimes spaced, instead of `’`. BAK-59 validation tolerates this. It is left for the
   French reference review.

6. **Pre-existing cross-browser failures.** The existing smoke tests fail outside Chromium on the
   BAK-59 baseline as well as on this branch:
   - focus does not return to **Edit resume** after Escape (WebKit desktop and mobile;
     intermittently Firefox mobile);
   - the interrupted-preparation notice does not appear after reload (WebKit desktop and mobile);
   - unresolved wording after reload is intermittent on Firefox mobile.

   The new integration suite runs on Chromium only. The keyboard and focus criterion is
   therefore not established for WebKit.

## Commands and results

| Command | Result |
| --- | --- |
| `pnpm check` | Passed |
| `pnpm test:qualification` | Passed; the held-out technology failure is expected via `it.fails` |
| `pnpm test:e2e` | Passed: 45 tests (27 existing smoke tests, 18 new integration tests) |
| `pnpm test:e2e:compatibility` | 156 passed, 6 failed; the same failures reproduce on an untouched `HEAD` checkout |
| `pnpm test:evaluation` | Not run: no `OPENAI_API_KEY` |

## Scope

No cover letters, templates, storage, accounts, DOCX, OCR, scraping or scoring changes were
introduced.
