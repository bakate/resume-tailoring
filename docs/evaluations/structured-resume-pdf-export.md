# Structured resume PDF export (BAK-59)

## Rendering contract

`CandidateJourney.renderResumeDocument` accepts the current semantic document and
unresolved field identifiers. Its XState actor constructs the shared `ResumeDraft`
and owns its revision, invocation, cancellation, and result publication. Retrying
unchanged input retains the revision. The result contains a `ResumeLayoutAssessment`
(one page, two pages, overflow, or unavailable) and validated PDF bytes only when
export is eligible. Every request has an opaque revision. A later request,
Candidate Session replacement/deletion, or expiration rejects a late result.
The UI also removes a previously measured preview immediately on input changes.

The browser adapter posts to `/api/resume-document`. The route uses the existing
access and CSRF guards, validates structured input, limits document size, and
returns `no-store` responses. It never sends content to a model or persists it.
Rendering uses the Puppeteer-pinned browser, embedded Inter/Lora fonts, and the
same semantic HTML used by the accessible text view. Chromium generates A4
pages with margins on every page; PDF.js independently checks page count, A4
dimensions, selectable text, and reading order. Existing font validation is
reused. There is no content deletion, typography reduction, or browser printing.

The visual preview renders those exact PDF bytes with PDF.js, scaled to the
available width on desktop and mobile. The download uses the same in-memory
bytes. Canvas pages have accessible text, and the semantic document is available
in an expandable text view. Export is unavailable for unknown/stale layout,
overflow, missing name/contact, unresolved edits, or a failed preview. Errors
preserve the source and current editor draft; retry is explicit. Successful
Download telemetry is emitted only after the browser download handoff, never
after rendering alone. This measures handoff, not the operating system saving
onto disk.

Photo input is optional and local to the preview, accepts bounded PNG/JPEG/WebP,
and is disabled by default. It invalidates the rendering request. Contact and
photo data reach only the stateless PDF renderer, never the model gateway.

## Integration ownership

BAK-56 supplies the semantic document, fixtures, and observable assessment types.
BAK-59 implements rendering from the current journey-owned BAK-58 editor draft
and unresolved field identifiers. BAK-57 supplies validated generated prose and
the explicitly normalized alternative through combined intake. Editing, contact
changes, regeneration, or changed intake inputs invalidate pending renders. The
preview publishes matching measurements into the editor review; explicit layout
checks and condensation proposals also use the real renderer. Export is suspended
while the editor is open, validation is pending, or the prepared resume is outdated.
BAK-60 qualifies the final combined flow.

Normalized output uses the same renderer and contact/layout requirements. Its
header explicitly says it is not tailored and does not invent a Target Role.
The existing unsafe substring acceptance for changed professional fields is
replaced by exact evidence or the original accepted wording. The editor validates
changed sections through BAK-58; pending wording and repeated saves cannot bypass
export blocking. New statements require
explicit Candidate Fact confirmation.

## Verification coverage

- Shared grouped fixture: employer/date association, grouped skills, remaining
  sections, selectable text, embedded fonts, and A4 output.
- Real Chromium measurements: one page, two pages, and explicit overflow without
  mutating the submitted draft.
- French prose, apostrophe extraction boundaries, normalized labeling, and photo.
- Rendering failure, required contacts, unsupported fields, and stale responses.
- Active browser journey: actual PDF download, preview page count, normalized PDF,
  missing contacts, repeated unsupported saves, and retry after a failed render.

Model-backed editorial quality and final generation/editing integration remain
BAK-60 qualification responsibilities; rendering fixtures do not establish those
claims.
