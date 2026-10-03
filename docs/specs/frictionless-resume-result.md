# Frictionless Resume Result

## Problem Statement

The Candidate Journey now reaches a Tailored Resume preview with two inputs and one action, but the last step still breaks the promise. A walkthrough of the released application after BAK-65 shows:

- **The Candidate cannot download the resume.** The Candidate name is never extracted (`readLocalResumeContacts` always sets `identity: null`), so every freshly generated resume is blocked on `missing-identity`. When identity is missing, the renderer withholds the PDF bytes entirely, so the Candidate sees no page preview at all. They also see two red alerts, "Add your full name" and the generic "The PDF could not be produced or validated", even though the second one comes from an independent render failure. The only recovery path is a modal hidden behind "Edit resume".
- **The result screen is overloaded.** The hero, session controls, result workspace, intake, two disclosures, and three phase cards all stack on one page. The result is sandwiched between marketing and intake. A manual "Check page count" button and a permanent "Propose a shorter version" button compete with the download action, and three readiness messages repeat each other ("page count unavailable", "Add your name", "Check page count before export").
- **The preview is rebuilt for nothing.** Opening the editor disables the preview. Closing it re-enables the preview, and because `enabled` is a dependency of the render effect, it re-runs the render and shows the "Preparing PDF preview" skeleton even when nothing was edited.
- **The name reaches the model.** `minimizeSensitiveContent` redacts email, phone, URL, address, and date of birth from text sent for extraction, but not the name. This contradicts the editor copy, which promises that identity is never sent for rewording.
- **Render failures are opaque.** A timeout, a Lambda cold start, a Puppeteer failure, or an access rejection all produce the same message, with no automatic recovery and no measurement.

## Solution

Move the result to its own route, `/resume`, and make it about one thing: reading and downloading the Tailored Resume. Clicking "Generate my resume" navigates there immediately. The route shows the progress view, then the preview with a single primary Download action.

Detect the Candidate name locally, as email and phone already are, and redact it from text sent to the model. Show it in a "Full name" field directly above the Download action, marked as detected and editable. Always render the preview, so a missing name only blocks the download.

Keep the last preview visible while the editor is open, and re-render only when the document content actually changed. Retry transient render failures once silently, and record privacy-safe failure categories.

## User Stories

1. As a Candidate, I want to land on a dedicated result page after clicking "Generate my resume", so that I see only my resume and what I can do with it.
2. As a Candidate, I want the preparation progress shown on that result page, so that the click immediately takes me where my result will appear.
3. As a Candidate, I want a failed preparation to offer a way back to my documents, so that I can fix my input without losing it.
4. As a Candidate, I want the result page to survive a reload within my Candidate Session, so that refreshing never loses my resume.
5. As a Candidate, I want visiting the result page without a result to take me to the intake, so that I never see an empty result screen.
6. As a Candidate, I want the preview and the Download action at the top of the result page, so that the main outcome needs no searching.
7. As a Candidate, I want editing, changing the Job Posting, and the Match Analysis available as secondary actions, so that they stay reachable without competing with the download.
8. As a Candidate, I want the page count checked automatically, so that I never have to request a check.
9. As a Candidate, I want "Propose a shorter version" offered only when my resume overflows, so that the action appears when it solves a real problem.
10. As a Candidate, I want my name detected from my resume, so that I do not retype information I already supplied.
11. As a Candidate, I want the detected name shown next to the Download action and marked as detected, so that I can verify and correct it in place.
12. As a Candidate, I want an empty name field in the same place when no name was detected, so that the fix takes one gesture.
13. As a Candidate, I want to see my full resume preview even before my name is set, so that I can review the result immediately.
14. As a Candidate, I want only the download blocked while a required name or contact is missing, with one clear explanation, so that I know exactly what to do.
15. As a Candidate, I want my name kept out of text sent to the Language Model Provider, so that the privacy promise in the editor is true.
16. As a Candidate, I want the preview to stay visible while I edit, so that I keep my context.
17. As a Candidate, I want closing the editor without changes to leave the preview untouched, so that I do not wait for nothing.
18. As a Candidate, I want typing my name to refresh the preview once when I finish, so that the preview does not flicker on every keystroke.
19. As a Candidate, I want a transient render failure retried automatically, so that a cold start does not look like an error.
20. As a Candidate, I want a persistent render failure explained with a retry action, so that I can recover.
21. As a Candidate, I want my photo kept for the duration of my Candidate Session, so that a reload or a round trip to the intake does not remove it.
22. As a Candidate, I want "Change job posting" to keep my analyzed resume and clear the previous Job Posting, so that I can tailor the same resume to another opportunity quickly.
23. As a Candidate returning to the intake with a generated result, I want a banner linking to my latest resume, so that I do not lose it.
24. As a product maintainer, I want privacy-safe render failure categories, so that I can find out why rendering fails in production.

## Implementation Decisions

- **Dedicated route (ADR-0016).** Add a TanStack Router file route `/resume` behind the existing `DemoAccessGate`. `/` keeps the introduction, the combined intake, the source evidence disclosure, and the phase cards. `/resume` hosts the progress view, the Tailored Resume preview and its actions, and the Match Analysis disclosure. Both routes read the same XState Candidate Session (ADR-0011). Navigation is presentation: the generate action sends the existing event and then navigates. `/resume` redirects to `/` when the restored Candidate Session holds no result and no preparation is in progress. The path is language-neutral; the FR/EN choice stays in the UI.
- **Intake banner.** When `/` is visited with a restorable result, show a "Your latest resume is ready → View" banner above the intake. Do not redirect automatically.
- **Change job posting.** It navigates to `/`, keeps the analyzed Source Profile, and clears the Job Posting. Carrying manual edits over to a newly tailored resume is out of scope.
- **Displayable versus exportable.** Split the export assessment so that `missing-identity` and `missing-contact` block the download only. The server always returns the measured PDF for preview when rendering succeeds, and the client keeps a separate `exportable` flag. `unsupported-content` and `overflow` keep blocking the download. Remove the duplicate `assessEligibility` in favor of the single `readExportBlockers`. A missing field never produces the generic render failure alert.
- **Readiness messaging.** Show at most one blocking message, attached to the field or action that resolves it. The default `layout: unavailable` state shown before the first render completes is pending, not a failure, and displays no warning.
- **Local name detection.** Add a pure, local heuristic next to the contact detection in Source Intake:
  1. First non-empty line that looks like a name (2–4 words, capitalized or upper case, no digits, no `@`, no role keyword).
  2. Otherwise, such a line among the first lines near the detected contact details.
  3. Otherwise, nothing.

  Prefer no name over a wrong name. The result fills `identity` with a `detected` origin. This replaces the "identity starts empty" rule in `readLocalResumeContacts`.
- **Name redaction.** Once detected, `minimizeSensitiveContent` redacts every occurrence of the name from text sent to the model, with the same placeholder mechanism used for other contact details (ADR-0002 consequence).
- **Inline name field.** It sits above Download on `/resume`. When the name was detected, it is prefilled and labeled "Detected in your resume, check it". When nothing was detected, it is empty with the export explanation. It commits on blur or Enter, never on each keystroke. The editor's identity tab edits the same value.
- **Editor and preview.** While the editor is open, keep the last rendered preview and do not render. On close, render only when the content key (`document`, `unsupportedFieldIds`, `photoDataUrl`) differs from the last rendered one; `enabled` toggling alone must not trigger a render or the progress skeleton.
- **Page count and condensation.** Remove the manual "Check page count" action; automatic measurement after each change is the only source. Show "Propose a shorter version" only when the current assessment reports `overflow`, as the primary action of that state.
- **Render resilience.** Retry once, silently, on timeout, HTTP 5xx, or network failure. Do not retry 401/403, 400 schema rejection, or revision mismatch. After a final failure, show one explanation with "Retry". Emit a render failure analytics event that carries only the failure category and whether a retry occurred, never document content, names, or photos.
- **Photo persistence.** Move the optional photo from React-local state into the browser-local Candidate Session, with the same 24-hour expiry and deletion as other Candidate content (ADR-0002).
- Keep the Language Model Gateway, matching, writing, validation, provenance, and the PDF rendering contract (ADR-0004, ADR-0008) unchanged.

## Testing Decisions

- Extend the Candidate Journey browser integration tests:
  - generating navigates to `/resume`;
  - progress shows there and is replaced by the preview;
  - reloading `/resume` restores the result;
  - visiting `/resume` with an empty session lands on `/`;
  - `/` shows the banner when a result exists.
- Replace the `enterRequiredName` expectation. For a source with a detectable name, the preview and the Download action are available without editing. For a source without one, the preview renders, Download is disabled, the inline field explains why, and filling it enables Download.
- Unit-test the name heuristic on representative fixtures:
  - name first;
  - role title first;
  - upper-case name;
  - no name;
  - recommendation text containing another person's name.

  The heuristic must return nothing rather than a wrong guess.
- Assert that model-bound text contains no detected name occurrence.
- Assert that opening and closing the editor without changes issues no render request and shows no progress view, and that a real edit issues exactly one.
- Assert that typing in the inline name field issues one render after blur, not one per keystroke.
- Cover retry classification with the renderer adapter: transient categories retry once, deterministic ones do not. The analytics test asserts that only categories are emitted.
- Assert that the manual page-count action is gone and that "Propose a shorter version" appears only on overflow.

## Out of Scope

- Carrying manual editor changes into a resume tailored for another Job Posting.
- Model-based name extraction.
- Multiple templates, accounts, or cross-device recovery.
- Changes to matching, writing, or PDF rendering fidelity.

## Further Notes

- Related: `docs/specs/preview-first-resume-tailoring.md` (stories 9, 63, 64 still hold; only the source of the name and what the block covers change), `docs/specs/frictionless-candidate-intake.md`, ADR-0002, ADR-0011, ADR-0014, ADR-0016.
- Spec issue: BAK-77. Implementation issues, in delivery order:
  1. BAK-78: Keep the preview stable around the editor (no render on unchanged close; preview kept while editing).
  2. BAK-79: Local name detection, model-bound redaction, inline name field, and preview without export eligibility.
  3. BAK-80: Render resilience: transient retry and privacy-safe failure categories.
  4. BAK-81: Dedicated `/resume` route, result hierarchy, intake banner, change job posting, photo in the Candidate Session.

  Issue 3 does not depend on 1 or 2 and may ship first to diagnose production failures. Issue 4 depends on 1 and 2.
