# Frictionless Candidate Intake

## Problem Statement

The preview-first journey (ADR-0014) removed the mandatory analysis checkpoint, but reaching the first Tailored Resume preview still feels like work. A walkthrough of the released application after BAK-60 shows:

- **Too many actions before value.** The Candidate starts a Candidate Session, grants Processing Consent in a separate card, chooses paste or upload for the Source Document, chooses again for the Job Posting, and then generates. That is five to seven deliberate actions before any result.
- **The promise is hidden.** The landing page shows a title and a start button, but no example of the result and no indication of the time involved. Nothing tells the Candidate that the task takes minutes, not an afternoon.
- **Cramped inputs.** Paste areas render as one or two lines, because `minRows` has no effect without `autosize`. Uploading uses a small file field behind a method toggle, with no drag-and-drop.
- **Unexplained elements.** Three static phase cards stay under the form for the whole journey, the Processing Policy card stays visible after consent only to confirm it, and internal vocabulary reaches the Candidate ("Session Candidat", "Collecte des Sources", "La phase d'orchestration actuelle est affichée sans pourcentage estimé").
- **Weak progress feedback.** A generic skeleton is inserted above the form, shifts the layout, and does not show which real phase is running or what remains.

Branch `bakate/lock-intake-during-generation` already fixes two defects outside this specification: intake fields stayed editable during preparation, and any edit silently cancelled generation; empty analysis and source disclosures rendered before any result existed.

## Solution

Make the landing page the intake. On arrival, the Candidate sees the promise, a sample result, and the measured typical duration, directly above two generous side-by-side drop zones, one for the Source Document and one for the Job Posting. Each zone accepts a dropped file, a picked file, or pasted text without a method choice. The Candidate Session opens automatically on first input.

One primary action, "Generate my resume", carries Processing Consent. The concise Processing Policy summary sits directly beside it, with full details on demand. After the click, the intake collapses into a progress view that lists the real preparation phases, marks each completed phase, and shows elapsed time. The Tailored Resume preview then replaces the progress view.

The normal path becomes: provide two inputs, then click once.

## User Stories

1. As a Candidate, I want to understand on arrival what I will get, what it costs me, and how long it takes, so that I decide to start without reading documentation.
2. As a Candidate, I want to see an example of the resulting document before providing anything, so that the promise is concrete.
3. As a Candidate, I want the typical preparation time shown from measured data, so that I trust the promise and it never overstates speed.
4. As a Candidate, I want to begin by dropping or pasting my resume immediately, without first starting a session, so that my first action is useful.
5. As a Candidate, I want to drag and drop a PDF or DOCX resume onto a large target, so that uploading is obvious and quick.
6. As a Candidate, I want to paste text into the same zone without choosing a mode first, so that pasting does not cost an extra click.
7. As a Candidate, I want paste areas large enough to review what I pasted, so that I can check my input before generating.
8. As a Candidate, I want a selected file shown with its name and a remove action, so that I can confirm or replace it.
9. As a Candidate, I want my resume and the Job Posting side by side on desktop and stacked on mobile, so that the two inputs read as one step.
10. As a Candidate, I want the concise Processing Policy next to the generate action, and generating to count as my Processing Consent, so that consent is informed without a separate ceremony.
11. As a Candidate, I want renewed consent requested at the generate action when the Processing Policy changes materially, so that processing never silently changes.
12. As a Candidate, I want the Processing Policy to stay reachable without occupying the page after consent, so that the page shows only what I need.
13. As a Candidate, I want the generate action enabled only when both inputs are present, and a clear reason shown otherwise, so that I never submit an incomplete request.
14. As a Candidate, I want the intake replaced by a progress view during preparation, so that I cannot change inputs mid-preparation and the page does not jump.
15. As a Candidate, I want the progress view to list the real phases with completed ones marked and elapsed time shown, so that I know the work is advancing without fake percentages.
16. As a Candidate, I want the preview to appear in place of the progress view with focus moved to it, so that I land directly on the result.
17. As a Candidate, I want every visible element to relate to my current step, so that nothing appears without a reason.
18. As a Candidate, I want plain language in French and English instead of internal terms, so that I understand each label.
19. As a Candidate, I want a discreet "Delete my data" action always available, so that privacy control stays at hand without dominating the page.
20. As a Candidate, I want reduced motion, keyboard operation, and screen-reader announcements kept throughout the new layout, so that the faster path stays accessible.
21. As a product maintainer, I want privacy-safe preparation-duration measurements, so that the displayed promise follows observed performance.

## Implementation Decisions

- Open the Candidate Session automatically when the Candidate provides the first input, or on arrival when a restorable session exists. Remove the "Start a Candidate Session" action. Deletion moves to a secondary header action with the existing confirmation dialog.
- Treat the generate action as the Processing Consent confirmation for the current Processing Policy version, which satisfies the existing CONTEXT.md definition (confirmation before the first model operation). Show the policy summary adjacent to the action, with details in a disclosure. Record consent before the first model call, in the same interaction. The consent-renewal rules for material policy changes do not change. Remove the persistent Processing Policy card.
- Replace each method toggle and `FileInput` with a single intake zone per document built on `@mantine/dropzone`, which ADR-0012 allows. The zone accepts drop, file picking, and paste. The source accepts PDF and DOCX; the Job Posting accepts PDF and TXT. Existing limits and explicit rejections remain unchanged. Paste areas use `autosize` with a comfortable minimum height.
- Render the intake as a two-column grid from the `md` breakpoint and as one column below it. Keep the resume language override as a secondary, optional control.
- Show the progress view in place of the intake for the duration of an operation. It uses the existing `preparationPhase` values (extracting-source, extracting-posting, matching, writing, validating) as an ordered list, where a source reused from the Candidate Session appears as already completed. Elapsed time is local UI state. Do not display a percentage. Keep the existing live-region announcements.
- Remove the static phase cards once a Candidate Session is open. Rewrite the Candidate-facing FR and EN copy in plain language, keep the CONTEXT.md vocabulary in code, and avoid internal orchestration terms in the UI.
- Add a privacy-safe preparation-duration counter to the existing analytics, using coarse duration buckets per phase and in total with no Candidate content. Display the promise ("usually under N minutes") from a documented configuration value derived from measurements. Until measurements exist, show the phase list without a duration figure.
- Show the landing-page sample as a synthetic resume thumbnail rendered from existing structured-resume fixtures. Never use real Candidate data.
- Keep the XState Candidate Session, the Language Model Gateway, provenance, matching, invalidation, and recovery behavior unchanged. This is a presentation and interaction change plus one analytics counter.

## Testing Decisions

- Extend the rendered-application smoke tests at the existing Candidate Journey browser seam. Rewrite the `openUnconsentedIntake`/`givenCombinedIntake` harness steps for the new path: no start-session action, no separate consent action.
- Verify that the normal path reaches a validated preview with two inputs and one action, and that no model request occurs before the generate action.
- Verify drop, file picking, and paste in each zone. Verify that unsupported and oversized files are rejected with explicit messages and without silent truncation.
- Verify that a material Processing Policy change requires renewed confirmation at the generate action.
- Verify that the progress view replaces the intake, marks completed phases, never shows a percentage, and moves focus to the preview on completion.
- Verify that no result disclosure, phase card, or policy card appears without a corresponding state.
- Keep the mobile, keyboard, and reduced-motion integration tests, and extend them to the drop zones and the progress view.
- Cover the duration counter with the existing privacy-safe analytics tests, asserting that only bucketed durations and phase names are emitted.

## Out of Scope

- Accounts, saved base resumes across sessions, LinkedIn URL import, and Job Posting URL scraping.
- A visual identity redesign. CibleCV informs interaction density only; its colors and style are not adopted.
- Changes to matching, writing, validation, or PDF rendering.
- Cancelling an in-flight preparation (possible follow-up).

## Further Notes

- Source: walkthrough of the released journey after BAK-60, compared with CibleCV's four-step intake.
- Related specifications: `docs/specs/preview-first-resume-tailoring.md` and ADR-0014. This specification refines the intake and progress presentation without changing their product decisions.
- Proposed split into implementation issues:
  1. Promise-first landing with an automatic Candidate Session and a plain-language copy pass.
  2. Generous side-by-side drop-and-paste intake.
  3. Processing Consent carried by the generate action.
  4. Phase progress view in place of the intake.
  5. Privacy-safe preparation-duration measurement and a measured time promise (it blocks the duration figure in issue 1, not the rest).
