# Section-by-Section Resume Preparation

## Problem Statement

A Candidate with a real-sized Source Document asks for a Tailored Resume and never gets one. A production run sent one 46,330-character resume writing request to the writing role (`gpt-6-sol`, medium reasoning). It timed out at 90 seconds, was retried, and timed out again. The Candidate waited three minutes and got an error, even though Source Intake and Job Match had succeeded (six Match Evidence links and seven relevant Candidate Facts kept).

Tailored Resume Preparation makes one writing call that returns the complete Tailored Resume as a single strictly structured document: every Resume Field with its identifier and Candidate Fact references. Nothing is returned until the whole document is generated, so the time grows with the length of the resume. The writing role was qualified on small fixtures only (p95 of 2.6 seconds), not on a complete resume. A single field-by-field validation call then follows.

Two further effects compound the problem:

- The Candidate sees nothing for the whole duration. There is no sign that anything is progressing.
- Retrying repeats the entire document. One slow or failed part forces everything to be written again.

## Solution

Tailored Resume Preparation writes and validates the Tailored Resume one Resume Section at a time. A deterministic section plan lists the sections the Candidate Facts support: the Value Proposition, one section per experience, then skills, education, languages, projects, and certifications. Each section is written by its own small writing call, containing only the Candidate Facts it may cite. Calls run in parallel, up to a concurrency limit.

Each written section is validated on its own, with the existing deterministic structure checks and a field-level validation call. It then appears in the preview. Sections still being written show a placeholder. No text reaches the preview before validation, so ADR-0001 is unchanged: every Resume Field shown is supported by its Candidate Facts.

When every section is validated, one last check reads the assembled document for cross-section coherence and language. Export stays blocked until it passes. A section that fails is retried on its own; validated sections are kept.

## User Stories

1. As a Candidate, I want my Tailored Resume to start appearing within seconds, so that I know preparation is working.
2. As a Candidate, I want each section to appear as soon as it is ready, so that I can start reading while the rest is written.
3. As a Candidate, I want to see which sections are still being written, so that I know what is missing.
4. As a Candidate, I want every section I see to be already checked against my Candidate Facts, so that I never read wording that disappears later.
5. As a Candidate, I want a real-sized resume to finish, so that a long career history does not make preparation fail.
6. As a Candidate, I want one failed section retried without losing the others, so that one model error does not cost me the whole resume.
7. As a Candidate, I want to download only once the whole resume is checked, so that my PDF is never partial or inconsistent.
8. As a Candidate, I want a reload during preparation to keep the validated sections, so that I do not start again.
9. As a Candidate, I want each experience written with the right emphasis (Relevant, Context, or Earlier Experience), so that the resume is still aimed at the Job Posting.
10. As a Candidate, I want the Value Proposition to reflect my strongest relevant evidence, so that it does not read as generic.
11. As a product maintainer, I want privacy-safe durations per section and for the whole preparation, so that I can see where time is spent without Candidate content.
12. As a product maintainer, I want the writing role qualified on a real-sized resume, so that latency regressions fail evaluation before release.

## Implementation Decisions

- **Section plan.** Resume preparation derives a deterministic section plan from the attested Candidate Facts: `value-proposition`, one `experience` entry per `experiences.N`, then each non-empty section among `skills`, `education`, `languages`, `projects`, and `certifications`. The plan is stored with the preparation revision.
- **Section writing input.** Each call receives only what the section may cite: its own Candidate Facts, the Target Role, the Job Requirement values, the relevant fact identifiers (including Adjacent Evidence facts), the locale, and the purpose. The Value Proposition receives the relevant Candidate Facts from every section. The full Job Posting text and the Match Analysis details are not sent.
- **Section writing contract.** One strict structured-output schema per section kind, each a slice of the current Professional Resume Document schema: Value Proposition paragraphs, one experience (with its chronology), skill groups, or section fields. Writing instructions are split to match. The existing rules stay: no terminology added only because the posting requests it, no transfer between employers, and no naming of an uncovered capability.
- **Experience chronology.** Each experience call decides whether the experience is Relevant, Context, or Earlier Experience from the Job Match, under the same rules as today.
- **Parallelism.** Sections are written in parallel, up to four concurrent calls. The Value Proposition starts with the experiences; it does not wait for them.
- **Section validation.** Each section passes the existing deterministic checks restricted to that section: unique field identifiers, non-empty text, known Candidate Fact identifiers, retained experience associations, and deduplicated skill items. It is then validated by the structured role against only the Candidate Facts it references. A validated section is stored in the Candidate Session under the preparation revision and published to the preview.
- **Final coherence check.** When all sections are validated, one call checks the assembled document for misleading chronology, redundant paraphrases across sections, incoherent skill categories, and language. It no longer re-validates each field. If it fails, preparation fails with `unsupported-content` as today, and the validated sections stay visible for correction.
- **Retries.** A section with a transient failure or a failed validation is rewritten once. Other sections are unaffected. Retrying after a failed preparation rewrites only the sections that are not yet validated. A timeout is not retried on the same request.
- **Preview.** The preview renders validated sections in the section order and a placeholder for each pending section. Export and layout assessment wait for the final coherence check.
- **Progress.** `PreparationPhase` reports per-section progress (planned, writing, validating, validated, failed) instead of the global `writing` and `validating`.
- **Normalized Resume.** The Normalized Resume uses the same pipeline with `purpose: normalized`.
- **Privacy-safe metrics.** Each section records its kind, duration, token counts, attempt count, and outcome, without Candidate content. Preparation records total wall time and section count.
- **Unchanged.** Provenance and validation rules (ADR-0001, ADR-0009), Generation Eligibility, the Match Analysis, the Lambda deployment, and the request deadline.

## Testing Decisions

- Tests exercise external behavior through the Candidate Journey, following the existing structured-resume and job-match behavior tests. They never assert the section planner or validation helpers directly.
- Candidate Journey behavior tests cover:
  - sections published one by one as each is validated, with placeholders for the others;
  - a section that fails validation retried alone while validated sections remain;
  - a reload during preparation keeping validated sections and resuming only the pending ones;
  - export blocked until the final coherence check passes;
  - a failed final coherence check that leaves validated sections visible with `correct-content` recovery;
  - each section input limited to that section's Candidate Facts.
- Adapter contract tests cover each per-section schema under strict structured output and the per-section writing instructions.
- The rendered-application smoke test shows a section appearing while another is still a placeholder, then the complete preview and download.
- The model qualification adds a real-sized anonymized resume fixture (at least six experiences). The writing role must write every section within a per-section p95 latency budget, and the whole preparation within a wall-time budget. Results go into a new dated evaluation report.

## Out of Scope

- Streaming model tokens into the preview.
- Changes to provenance, Resume Field validation rules, or Generation Eligibility.
- Changes to the Lambda deployment, invoke mode, or timeout.
- Changing the writing model or its reasoning effort (a later decision if the evaluation requires it).
- Section editing, which already validates per section.

## Further Notes

- Decision record: ADR-0016, "Write and validate the Tailored Resume section by section", which amends ADR-0014. It records that the preview reveals validated sections progressively and never shows unvalidated text.
- Glossary term added to `CONTEXT.md`: Resume Section.
- Production evidence: two consecutive 90-second timeouts on `resume-document-writing` with a 46,330-character request, after a successful Job Match.
