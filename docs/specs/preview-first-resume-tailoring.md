# Preview-First Resume Tailoring and Document Quality

## Problem Statement

A Candidate wants to supply an existing resume and a Job Posting and receive an honest resume ready to submit. The released experience instead exposes processing details, analysis panels, and a long list of editable fields before the document. Even optional controls feel like required work because they dominate the page.

The resulting document also falls short of the complete-resume promise in [BAK-37](https://linear.app/bakate-projects/issue/BAK-37/spec-three-phase-resume-tailoring-mvp). The active composition path copies Candidate Facts instead of writing a Value Proposition, repeats skill categories as content, and renders dates, organizations, roles, and achievements as equivalent bullets. The active export path uses browser printing without establishing the required one-or-two-page PDF contract. A Candidate must reconstruct the document manually before applying.

These are partly existing acceptance failures, not solely new product requirements. This specification corrects the document-quality gaps and replaces the mandatory stop at Match Analysis with automatic progression to a reviewable result.

## Solution

Present one intake surface for the Source Document and Job Posting. After Processing Consent, one generation action performs Source Intake, Job Match, and Tailored Resume Preparation. These remain internal phases with understandable progress feedback, not three mandatory approval screens.

Make the resume preview the primary result. The product writes a concise Value Proposition, preserves coherent experience entries, selects relevant achievements, condenses less relevant history, and groups skills without redundant content. Every professional statement remains grounded in Candidate evidence. The Candidate can download a validated PDF or optionally edit a section, inspect Match Analysis, or restore omitted source content.

Isolated unsafe information is omitted and disclosed without blocking a faithful, usable result. Ask a targeted question before preview only when continuing would make the document misleading or unusable. When no relevant evidence exists, explain the mismatch and offer a clearly non-tailored Normalized Resume.

Keep the existing sober editorial identity and borrow CibleCV's coherent document structure and optional editing. Preserve the current privacy, provenance, matching, and shared preview/PDF guarantees. Cover-letter generation remains a later, on-demand feature.

## User Stories

1. As a Candidate, I want to provide my Source Document and Job Posting in one intake surface, so that I can begin without navigating separate approval stages.
2. As a Candidate, I want to upload a text-based PDF or DOCX resume, so that I can reuse my existing professional document.
3. As a Candidate, I want to paste professional text, so that an unavailable file format does not prevent me from continuing.
4. As a Candidate, I want to paste a Job Posting or upload a text-based PDF or TXT posting, so that I can use the opportunity description I already have.
5. As a Candidate, I want empty, oversized, encrypted, scanned, or unsupported inputs explained explicitly, so that I know how to recover without silent truncation.
6. As a Candidate, I want a concise Processing Policy before the first model operation, so that I understand who processes which content and for what purpose.
7. As a Candidate, I want Processing Consent reused within the active policy, so that I do not repeat consent for every operation.
8. As a Candidate, I want renewed consent after a material policy change, so that processing never silently changes provider or purpose.
9. As a Candidate, I want identity and contact information preserved locally, so that it can appear in the resume without unnecessary model transmission.
10. As a Candidate, I want one generation action after providing the inputs and consent, so that I reach a resume preview without intermediate validation clicks.
11. As a Candidate, I want extraction and matching to run automatically, so that I do not review every Candidate Fact or Job Requirement.
12. As a Candidate, I want real progress feedback during preparation, so that I understand that work is continuing without misleading percentages.
13. As a Candidate, I want an isolated Critical Ambiguity excluded and disclosed, so that safe content remains usable without a global review.
14. As a Candidate, I want a targeted question only when an ambiguity prevents a faithful, usable document, so that interruptions remain consequential.
15. As a Candidate, I want absent Job Requirements reported as gaps rather than mandatory questions, so that applying does not require an exhaustive enrichment questionnaire.
16. As a Candidate, I want optional Source Profile inspection and correction, so that I can address extraction mistakes without making inspection part of the normal path.
17. As a Candidate, I want French or English proposed from the Job Posting with an optional override, so that language selection does not introduce another mandatory checkpoint.
18. As a Candidate, I want preparation failures to preserve my inputs and last stable result, so that I can retry without restarting.
19. As a Candidate, I want an interrupted session restored to a recoverable state, so that reloading does not destroy my work.
20. As a Candidate, I want the resume preview to be the primary result, so that I can immediately judge the document I came to create.
21. As a Candidate, I want a written Value Proposition rather than a list of extracted fragments, so that a recruiter can understand my relevance quickly.
22. As a Candidate, I want the Value Proposition grounded in my strongest relevant evidence, so that it is specific without exaggerating my qualifications.
23. As a Candidate, I want the Target Role to come from the Job Posting, so that the heading reflects the opportunity rather than an invented title.
24. As a Candidate, I want tailoring to emphasize supported capabilities relevant to the opportunity, so that a broad professional profile can make a focused application.
25. As a Candidate, I want historical role titles, seniority, and responsibilities preserved faithfully, so that stronger positioning does not rewrite my employment history.
26. As a Candidate, I want each experience to retain its role, organization, dates, context, and achievements together, so that the recruiter can understand what I did and where.
27. As a Candidate, I want relevant achievements selected and reformulated, so that the document demonstrates value instead of reproducing every extracted sentence.
28. As a Candidate, I want less relevant experiences condensed while retaining an intelligible chronology, so that the resume stays concise without misleading omissions.
29. As a Candidate, I want older experience retained briefly when needed for context, so that important career continuity is not lost.
30. As a Candidate, I want supported but low-value achievements and skills omitted when necessary, so that relevant evidence and readability take precedence over exhaustive inclusion.
31. As a Candidate, I want skills grouped by category, so that categories organize the information instead of becoming repeated bullets.
32. As a Candidate, I want duplicate skill items and repeated paraphrases of the same achievement removed, so that every line contributes useful information.
33. As a Candidate, I want a capability allowed in the summary, skills, and an experience when each occurrence serves a distinct purpose, so that deduplication does not remove useful evidence.
34. As a Candidate, I want supported education, languages, projects, and certifications represented distinctly when appropriate, so that the resume preserves their meaning.
35. As a Candidate, I want names, organizations, and qualifications preserved during translation, so that changing the document language does not alter facts.
36. As a Candidate, I want no invented qualifications, outcomes, responsibilities, or levels, so that I can stand behind every professional statement.
37. As a Candidate, I want unsupported terminology to remain in Gap Analysis, so that matching keywords never fabricate experience.
38. As a Candidate, I want Match Analysis accessible alongside the result, so that I can understand the opportunity without approving the analysis before generation.
39. As a Candidate, I want strengths, priority gaps, critical reserves, and Practical Constraints available in secondary analysis, so that a concise result does not remove transparency.
40. As a Candidate, I want detailed provenance available on demand, so that I can inspect support without seeing the internal evidence model everywhere.
41. As a Candidate, I want low coverage to warn without blocking a supported Tailored Resume, so that the decision to apply remains mine.
42. As a Candidate, I want a brief explanation when no relevant evidence exists, so that the product does not pretend it can tailor unsupported content.
43. As a Candidate, I want the option to generate a Normalized Resume in that case, so that I can still obtain a usable general document clearly labeled as not tailored to the posting.
44. As a Candidate, I want the full Source Profile preserved after tailoring, so that selection and condensation do not destroy my original evidence.
45. As a Candidate, I want a secondary view of omitted content, so that I can restore supported elements without reviewing every omission in advance.
46. As a Candidate, I want a section-level edit action from the preview, so that I can correct a meaningful block instead of navigating hundreds of generic fields.
47. As a Candidate, I want edits reflected in the preview, so that I can assess their effect on the actual document.
48. As a Candidate, I want local contact corrections without model processing, so that personal information remains private and inexpensive to change.
49. As a Candidate, I want professional edits validated at the affected content, so that one correction does not reopen a global approval ceremony.
50. As a Candidate, I want to explicitly confirm a genuine new statement as a Candidate Fact, so that I can add real missing evidence without weakening provenance.
51. As a Candidate, I want unsupported edits to prevent export until resolved, so that an unsafe change cannot silently enter the PDF.
52. As a Candidate, I want to reorder sections and hide or restore entries, so that I retain control over the final presentation.
53. As a Candidate, I want a separate section-editing view on mobile, so that editing stays usable on a small screen.
54. As a Candidate, I want restored content preserved even when it creates overflow, so that the application does not silently undo my decision.
55. As a Candidate, I want an explicit action to condense an overflowing resume to two pages, so that I can recover without manually rewriting everything.
56. As a Candidate, I want to preview a condensation proposal before replacing my draft, so that I can assess its changes.
57. As a Candidate, I want rejection or failure of a condensation proposal to preserve my draft, so that exploring a shorter version is reversible.
58. As a Candidate, I want to choose content to remove if condensation is insufficient, so that the product does not make hidden deletions on my behalf.
59. As a Candidate, I want readable typography preserved during overflow recovery, so that fitting two pages never means producing an unreadable document.
60. As a Candidate, I want export blocked while the document exceeds two pages, so that the downloadable result meets the agreed document standard.
61. As a Candidate, I want one readable page by default and a second when meaningful evidence requires it, so that concision does not erase relevant senior experience.
62. As a Candidate, I want a single-column PDF with selectable text and a natural reading order, so that recruiters and ATS software can read it.
63. As a Candidate, I want the PDF to match the current validated preview in content, order, and layout, so that I download the result I reviewed.
64. As a Candidate, I want a full name and one contact method required before export, so that the resume can be used for an application.
65. As a Candidate, I want city, professional links, and photo to remain optional, so that generation does not demand unnecessary personal information.
66. As a Candidate, I want regeneration to warn before replacing manual edits, so that my corrections are not discarded silently.
67. As a Candidate, I want source and Job Posting changes to invalidate stale results, so that documents from different evidence or opportunities are not mixed.
68. As a Candidate, I want to reuse my Source Profile for another Job Posting during the browser-local session, so that I do not repeat extraction unnecessarily.
69. As a Candidate, I want keyboard operation, accessible announcements, and reduced-motion support throughout the journey, so that the simpler flow remains accessible.
70. As a Candidate, I want a usable mobile preview and export, so that the complete journey works without a desktop.
71. As a Candidate, I want my content kept in the 24-hour browser-local Candidate Session with an immediate deletion action, so that convenience does not introduce persistent server storage.
72. As a Candidate, I want to report whether the downloaded document is usable without structural rewriting, so that product quality is judged by the actual outcome.
73. As a product maintainer, I want complete reference documents reviewed by a human, so that green automated checks cannot disguise unusable resumes.
74. As a product maintainer, I want short profiles, dense senior careers, career changes, and weak matches represented in reference reviews, so that quality is not judged from one favorable example.
75. As a product maintainer, I want the observed flat rendering, duplicate categories, and exhaustive editing captured as regressions, so that the same failures cannot return unnoticed.

## Implementation Decisions

- Retain the modular monolith, domain/application separation, provider-neutral matching engine, Language Model Gateway, XState Candidate Session orchestration, and Mantine interactive UI. This is a repair and focused evolution of the existing system, not a CibleCV architecture migration.
- Extend the existing domain-named Candidate Journey interface to coordinate the combined input request and automatic progression through extraction, matching, writing, validation, and preview. Keep internal machine state and processing mechanics out of the public UI contract. Purely visual disclosures and focus remain UI concerns.
- Apply ADR-0014 in place of BAK-37's explicit post-analysis generation checkpoint. Keep Processing Consent before the first model operation, and make language override optional in intake. Require no normal-path action between generation and preview.
- Keep real phase feedback, accessible progress announcements, one automatic retry at most for transient failures, last-stable-result recovery, and versioned browser-local persistence. Preserve existing source, posting, locale, and contact invalidation rules.
- Deepen the structured Tailored Resume model so experiences retain named semantic fields and achievements, skills retain groups and items, and the Value Proposition is written prose. Candidate Facts remain provenance units underneath the document rather than its presentation model.
- Use the existing writing-model role for actual editorial preparation and condensation. Model-backed output must retain field-level provenance and be validated before display or export. Referencing an existing fact identifier alone does not establish that a new statement's meaning is supported.
- Select and reformulate supported evidence for relevance. Preserve historical role meanings, dates, responsibilities, qualifications, and actual seniority. The Target Role remains sourced from the Job Posting under the existing fallback rule; it is not a historical employment claim.
- Preserve Relevant Experience, Context Experience, and Earlier Experience distinctions. Favor useful evidence and intelligible chronology over exhaustive inclusion. Keep the full Source Profile for inspection and restoration.
- Group skills and remove redundant information while allowing purposeful repetition across different sections. Do not enforce global keyword uniqueness or treat distinct roles using the same technology as duplicate experiences.
- Isolate unsafe facts when a faithful document can still be prepared, and disclose their omission. A targeted pre-preview question is reserved for cases where omission would make the result misleading or unusable. Keep optional enrichment outside the required path.
- Preserve deterministic matching, Generation Eligibility, Match Score meaning, critical reserves, and Practical Constraints. Present analysis through secondary disclosures. Low coverage does not block generation; no relevant evidence produces a mismatch explanation and an explicit option for a Normalized Resume.
- Keep the Normalized Resume distinct from a Tailored Resume in result labeling and generation semantics. Apply the same factual, contact, readability, and export-quality requirements without claiming relevance to the Job Posting.
- Replace the exhaustive field editor with preview-first, optional section editing. Keep local contacts local, and validate professional changes at their affected fields. Preserve the existing explicit addition of genuine Candidate Facts and warning before regeneration replaces manual edits.
- Keep restored evidence in the current draft. On overflow, offer a condensation proposal and preview it before replacement. Rejection or failure retains the draft. If the proposal cannot resolve overflow readably, let the Candidate choose removals. Temporary proposal review does not introduce persistent draft history or automatic merging.
- Apply the shared semantic HTML and validated PDF decisions in ADR-0004 and ADR-0008 to the active journey. Preview and export must use the same current document and rendering contract, with pinned Chromium/Puppeteer, A4 dimensions, embedded fonts, selectable text, and natural reading order. Native browser printing alone does not satisfy this contract.
- Enforce one page by default and two when relevant evidence requires it. Prevent silent content deletion and illegible typography to achieve the page limit. Block export for unresolved unsupported edits, missing required identity/contact information, or page overflow; explain the applicable recovery at the affected content or document level.
- Preserve one ATS-first, single-column template and the sober editorial identity. Use CibleCV as evidence for coherent document grouping and optional editing, not as a mandate for its colors, multiple templates, storage, scoring, or separate renderers.
- Keep original input support and limits: text-based PDF/DOCX or pasted professional sources, a maximum of five Source Document pages, pasted or PDF/TXT Job Postings, French/English output, and explicit rejection of unsupported or empty input without silent truncation.
- Preserve the 24-hour browser-local Candidate Session, stateless model processing, versioned Processing Policy, local sensitive contact handling, and privacy-safe operational counters. No new storage or account system is required.

## Testing Decisions

- Use the existing Candidate Journey public interface as the primary behavior seam, extending the current source-intake and job-match behavior harnesses. Drive domain-named actions and assert observable snapshots and outcomes. Do not test XState nodes, helper calls, private data structures, or prompt wording as product behavior.
- Prefer this active seam over the older ResumeTailoringWorkflow seam mentioned in the general testing guide; ADR-0011 and the active Candidate Journey behavior tests provide the applicable prior art. Do not create a second orchestration API solely for testing.
- Keep Given, Action, and Then structure, one caller-visible action per Action phase, local system-under-test factories, guarded outcome readers, and domain-named assertions. Use deterministic in-memory adapters and recorded provider fixtures; live model calls are not required in the default test suite.
- At the journey seam, verify one generation request reaches a validated preview after consent; ambiguity isolation and targeted blocking; low-coverage generation; the no-evidence Normalized Resume option; supported edits and new facts; restored content; accept/reject/failure of condensation; invalidation; and recovery without data loss.
- Use the rendered web application as the transport and interaction seam. Extend the existing Candidate Journey browser tests to verify combined intake, absence of intermediate normal-path approvals, preview-first layout, optional analysis and section editing, mobile editor navigation, keyboard/focus behavior, live announcements, and overflow recovery. Replace assertions that require three visible approval stages with the accepted observable journey.
- Reuse and strengthen the existing semantic document and PDF contract tests where browser layout and export behavior genuinely differ from application behavior. Verify grouped experience metadata, prose summary, skill grouping, selectable text, embedded fonts, A4 pagination, reading order, and equality of the current preview and exported content. Test actual export from the active journey, not only an unused renderer.
- Keep adapter contract tests limited to varying production boundaries: document reading, structured/writing model outputs, persistence, and PDF generation. Preserve matching-engine public-interface tests rather than duplicating its algorithms in UI tests.
- Use regression fixtures reflecting the supplied screenshots: repeated Front-end categories, dates and employer names rendered as bullets, unrelated fragments in the summary, and long generic editors preceding preview. Assert the resulting semantic document and candidate-visible behavior, not exact generated prose.
- Distinguish editorial deduplication from keyword removal. Cover a technology repeated appropriately across summary, skills, and an achievement; duplicate skills in one group; repeated paraphrases of one achievement; and similar but genuinely distinct achievements across roles.
- Test overflow using restored content that crosses the two-page budget. Verify additions persist, the proposed condensation is separately reviewable, rejecting it preserves the draft, insufficient condensation leads to Candidate-selected removal, and export remains blocked until a readable valid document is available.
- Require human review of complete generated documents for factual accuracy, relevance, selection, writing quality, hierarchy, and readability. Include a short profile, a dense senior career, a career change, and weak correspondence. A document that requires substantial rewriting or structural reconstruction fails acceptance even when automated tests pass.
- Preserve BAK-37's cross-segment corpus and per-role-family quality gates: at least 95 percent critical/mandatory requirement recall, 95 percent requirement precision, 98 percent Match Evidence precision, 90 percent valid-evidence recall, at most five points mean score error and ten points for any scenario, zero unsupported resume claims, and valid exportable qualification PDFs in every scenario. Keep development and held-out qualification data separate.
- Release acceptance requires the normal one-action path, complete grouped resume content, readable one-or-two-page PDF fidelity, supported claims, safe restoration/condensation, and human-reviewed usability without structural rewriting. Run the established architecture, convention, lint, type-check, behavior, evaluation, browser, and production-build checks before release. Green checks alone do not replace the document review.

## Out of Scope

- Cover-letter generation in this refactor. A later feature may generate one on demand after the resume is dependable; it must not delay initial resume generation.
- Accounts, authentication, cross-device history, persistent server storage of Candidate content, application tracking, collaboration, and persistent draft-version history.
- Reproducing the arbitrary visual layout of an uploaded resume, cloning CibleCV's visual identity, multiple templates, theme selection, or a precision mobile layout editor.
- DOCX export, OCR, scanned-document support, Job Posting URL scraping, LinkedIn URL scraping, and third-party job-board integrations.
- Automatic application submission, interview coaching, recruiter communication, hiring-probability predictions, or employer-side Candidate ranking.
- Unsupported professional claims, inferred qualifications or seniority, hidden role-specific matching branches, new scoring formulas, and additional output languages.
- Silent provider failover, raw model token display, fake progress percentages, automatic merging of generated changes into manual edits, and historical session migration.
- Third-page exports or shrinking typography below readable limits to bypass the document budget.

## Further Notes

- Source specification: [BAK-37 — Three-Phase Resume Tailoring MVP](https://linear.app/bakate-projects/issue/BAK-37/spec-three-phase-resume-tailoring-mvp). This follow-up supersedes its mandatory post-analysis generation checkpoint and default analysis-first presentation. It clarifies selective writing, optional section editing, Normalized Resume fallback, restoration, and overflow recovery. Unchanged privacy, matching, source-format, and quality constraints remain applicable.
- The thirteen product decisions were explicitly accepted during the design interview. The testing strategy implements the accepted normal-path, document-fidelity, provenance, regression, and human-review criteria through existing seams.
- Dependencies: the existing Candidate Journey, structured Source Profile, Language Model Gateway, matching engine, browser-local persistence, and semantic PDF foundations established by BAK-37. No additional product decision or external service is a prerequisite. The completed status of earlier tickets is not evidence that their current output satisfies this specification.
- Architectural basis: ADR-0001 and ADR-0009 for provenance and structured documents; ADR-0002 and ADR-0003 for private stateless processing; ADR-0004 and ADR-0008 for shared rendering and readable pagination; ADR-0006 and ADR-0013 for model roles and gateway policy; ADR-0007 for collective attestation; ADR-0010 for matching isolation; ADR-0011 and ADR-0012 for orchestration and interactive UI; ADR-0014 for generation before optional review.
- Reference: [CibleCV](https://github.com/bakate/cible-cv/tree/18bcbc37aee33cf19c4f0dc9e00a7afbb00fb4d3). Its grouped resume data and optional section editing inform this design. Its model-generated score, weaker provenance validation, source truncation, and separate preview/PDF rendering are not adopted.
- Preserve the original supplied screenshots as regression references when implementing the qualification cases. Do not publish personal source documents or contact details in the issue tracker or test corpus; use anonymized or synthetic equivalents for reproducible tests.
- The primary outcome remains whether a downloaded resume can be used to apply without structural rewriting. Implementation work should be split into deliverables linked to this specification; publishing this spec does not itself implement or release the feature.
