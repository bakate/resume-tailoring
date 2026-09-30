# Write and validate the Tailored Resume section by section

This amends ADR-0014. Tailored Resume Preparation no longer writes the whole Tailored Resume in one model call. A deterministic plan lists the Resume Sections that the Candidate Facts support. Each section is written by its own writing call, which receives only the Candidate Facts it may cite. It is validated on its own and then revealed in the preview. One final check reads the assembled document for cross-section coherence and language, and export waits for it.

A single call that returned the complete document grew with the length of the resume. A real-sized resume timed out twice at 90 seconds, and the Candidate saw nothing before the error. Section calls stay small, run in parallel, and fail or retry independently.

## Considered Options

- Stream the single writing call into the preview: shows progress, but reveals text before validation, contrary to ADR-0001, and does not shorten total time.
- Keep one call and raise timeouts or lower reasoning effort: no progressive result, and it only moves the limit.

## Consequences

The preview never shows a Resume Field before it is validated (ADR-0001 unchanged). Cross-section checks move to a final coherence check over the assembled document. Writing instructions and structured-output schemas are split per section kind. Model qualification must measure per-section and whole-preparation latency on a real-sized resume.
