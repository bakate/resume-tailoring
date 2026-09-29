# Three-Phase Resume Tailoring MVP

## Problem Statement

The current Candidate Journey requires excessive review across four visible steps and ends with a document containing only a Target Role, contact details, and a short list of selected claims. A Candidate cannot use that output as a complete resume for an application. The implementation performs real extraction, evidence matching, scoring, provenance validation, and PDF rendering, but its workflow and document model do not fulfill the MVP promise: upload an existing resume, evaluate one Job Posting, and receive an honest Tailored Resume ready to submit.

The current quality evidence is also concentrated on software-development scenarios. The product claims support for technology professionals, general management professionals, and sales professionals, but it cannot make that claim credibly until extraction, matching, scoring, and writing are qualified across those segments and hybrid roles such as DevOps, Tech Lead, CTO, and Sales Engineer.

## Solution

Replace the four-step journey with a dynamic three-phase Candidate Journey:

1. **Source Intake** accepts a text-based PDF, DOCX, or pasted professional text, obtains one Processing Consent, extracts a structured Source Profile in the background, and interrupts the Candidate only for Critical Ambiguities.
2. **Job Match** accepts a pasted or uploaded Job Posting, extracts and groups its requirements, validates Match Evidence, calculates an explainable Match Score, surfaces critical reserves and practical constraints, and presents the decision to generate.
3. **Tailored Resume Preparation** creates a complete one-or-two-page ATS-first resume, validates provenance for every professional field, allows controlled editing, previews the exact semantic document, and exports a validated PDF.

The Tailored Resume will contain identity and contact details, the Target Role, a concise Value Proposition, relevant and contextual experiences, skills, education, languages, and relevant projects or certifications. It will select and reformulate only supported Candidate evidence, align terminology with the Job Posting only when meaning is preserved, and retain field-level provenance internally.

The Candidate Journey will use real phase feedback rather than fake progress or unvalidated token streaming. A provider-neutral Language Model Gateway will keep the domain and product copy independent of the active provider while a versioned Processing Policy discloses the actual processor before content is transmitted.

## User Stories

1. As a Candidate, I want to upload my existing resume, so that I do not have to recreate my professional history manually.
2. As a Candidate, I want to paste professional text instead of uploading a file, so that I can continue when my document format is unavailable.
3. As a Candidate, I want the product to accept text-based PDF and DOCX resumes, so that I can use common resume formats.
4. As a Candidate, I want an explicit explanation when a scan or unreadable document is unsupported, so that I know how to continue.
5. As a Candidate, I want the product to reject empty or oversized inputs explicitly, so that content is never truncated silently.
6. As a Candidate, I want one concise Processing Policy before the first model-backed operation, so that I understand who processes which data and why.
7. As a Candidate, I want sensitive contact information removed before professional content reaches the model provider, so that unnecessary personal data remains private.
8. As a Candidate, I want my contact details preserved locally, so that they can still appear in my final resume.
9. As a Candidate, I want extraction to continue without a fact-by-fact review, so that the journey remains short.
10. As a Candidate, I want to be interrupted only when a Critical Ambiguity makes evidence unsafe to reuse, so that I correct only consequential issues.
11. As a Candidate, I want each Critical Ambiguity presented as a targeted question, so that I can resolve it without understanding the internal data model.
12. As a Candidate, I want one ambiguous fact to be isolated without blocking unrelated evidence, so that useful parts of my Source Profile remain available.
13. As a Candidate, I want the option to inspect my detailed Source Profile, so that I retain control without making inspection mandatory.
14. As a Candidate, I want experiences to retain organizations, roles, dates, context, and achievements, so that a complete resume can be reconstructed.
15. As a Candidate, I want skills, education, languages, projects, and certifications represented separately, so that the generated document preserves their meaning.
16. As a Candidate, I want to paste a Job Posting, so that I can evaluate the opportunity immediately.
17. As a Candidate, I want to upload a text-based Job Posting file, so that I do not need to reformat its content.
18. As a Candidate, I want navigation, employer branding, legal boilerplate, and repeated requirements removed from scoring, so that noisy postings do not distort the analysis.
19. As a Candidate, I want requirements backed by exact Job Posting excerpts, so that I can understand where the analysis came from.
20. As a Candidate, I want semantically duplicate requirements grouped, so that repetition does not inflate their importance.
21. As a Candidate, I want requirements classified as critical, central, or complementary with an explanation, so that the score remains understandable.
22. As a Candidate, I want long employer wishlists to have bounded influence, so that missing minor preferences does not destroy an otherwise credible match.
23. As a Candidate, I want evidence evaluated across technical expertise, execution, ownership, leadership, strategy, stakeholder communication, and operational risk, so that hybrid and senior roles are assessed fairly.
24. As a Candidate, I want partial coverage granted only for the same capability at incomplete scope, so that loosely related experience does not receive undeserved credit.
25. As a Candidate, I want the Match Score to describe evidence coverage rather than hiring probability, so that it does not make a false promise.
26. As a Candidate, I want a separate warning when a critical requirement is uncertain or unsupported, so that a high aggregate score does not hide a decisive gap.
27. As a Candidate, I want practical constraints reported outside the Match Score, so that location, authorization, availability, and compensation are not confused with professional evidence.
28. As a Candidate, I want to see my three strongest supported matches, so that I understand why the opportunity may be credible.
29. As a Candidate, I want to see my three most important gaps, so that I understand the risk before applying.
30. As a Candidate, I want the complete requirement and evidence analysis available on demand, so that transparency does not become mandatory clutter.
31. As a Candidate, I want a low Match Score to warn rather than block me when relevant evidence exists, so that the final decision remains mine.
32. As a Candidate, I want the product to refuse the label “Tailored Resume” when no relevant evidence exists, so that it does not pretend to adapt unsupported content.
33. As a Candidate, I want to add real missing professional evidence through a targeted prompt, so that an incomplete Source Document can be corrected honestly.
34. As a Candidate, I want a clear action to adapt my resume after reading the Match Analysis, so that generation occurs only when I choose to proceed.
35. As a Candidate, I want the proposed resume language inferred from the Job Posting, so that the document matches the application context.
36. As a Candidate, I want to override the proposed French or English language before generation, so that I remain in control.
37. As a Candidate, I want names, organizations, qualifications, and proper nouns preserved during translation, so that translation does not alter facts.
38. As a Candidate, I want a complete Tailored Resume rather than a list of highlights, so that the exported document can be submitted directly.
39. As a Candidate, I want my name and at least one contact method required before export, so that the resulting resume is usable.
40. As a Candidate, I want city, LinkedIn, GitHub, portfolio, and photo to remain optional, so that the product does not demand unnecessary personal information.
41. As a Candidate, I want a Target Role copied from the Job Posting rather than invented, so that the resume heading remains honest.
42. As a Candidate, I want a concise Value Proposition at the top of the resume, so that a recruiter can understand my relevance within the first thirty seconds.
43. As a Candidate, I want the Value Proposition supported by my strongest evidence, so that it avoids generic or inflated claims.
44. As a Candidate, I want exact Job Posting terminology used only when it preserves the meaning of my evidence, so that ATS alignment does not become fabrication.
45. As a Candidate, I want unsupported keywords shown only as gaps, so that they never leak into the Tailored Resume.
46. As a Candidate, I want relevant experiences detailed first, so that the document prioritizes evidence for the Target Role.
47. As a Candidate, I want recent context experiences retained in condensed form, so that the career chronology remains intelligible.
48. As a Candidate, I want earlier experiences retained as concise chronology when needed, so that tailoring does not imply a false career history.
49. As a Candidate, I want skills grouped and supported by evidence, so that the resume does not become a keyword inventory.
50. As a Candidate, I want one readable page by default and a second page only when evidence requires it, so that the document remains concise without discarding important senior experience.
51. As a Candidate, I want a single-column document with selectable text and standard section headings, so that recruiters and ATS software can read it naturally.
52. As a Candidate, I want preview and PDF export generated from the same semantic document, so that the downloaded result matches what I approved.
53. As a Candidate, I want to edit contact details locally, so that personal corrections never require model processing.
54. As a Candidate, I want to edit wording, reorder sections, and hide or restore entries, so that I can control the final presentation.
55. As a Candidate, I want unsupported professional edits identified at the affected field, so that validation does not become another global review step.
56. As a Candidate, I want to confirm a genuine new professional statement as a Candidate Fact, so that I can add missing evidence without weakening provenance.
57. As a Candidate, I want export blocked only while an unsupported edit remains unresolved, so that one unsafe change cannot silently enter the PDF.
58. As a Candidate, I want regeneration to warn me before replacing manual edits, so that my work is never discarded silently.
59. As a Candidate, I want profile changes to invalidate stale Match Analyses and Tailored Resumes, so that displayed results always use current evidence.
60. As a Candidate, I want Job Posting changes to invalidate the old Match Analysis and Tailored Resume, so that content from different opportunities is never mixed.
61. As a Candidate, I want contact and photo changes to update the document without recalculating the score, so that irrelevant work is avoided.
62. As a Candidate, I want real progress phases during long-running operations, so that I understand what the application is doing.
63. As a Candidate, I want skeletons shaped like the expected result rather than a fake percentage, so that waiting feels responsive without being misleading.
64. As a Candidate, I want professional text revealed only after provenance validation, so that I never review content the system later rejects.
65. As a Candidate, I want the last stable result to remain visible during secondary operations, so that the interface does not blank unnecessarily.
66. As a Candidate, I want actionable recovery after an extraction, analysis, generation, or export failure, so that I do not need to restart the journey.
67. As a Candidate, I want my prior stable work preserved after a failed operation, so that model or network errors do not cause data loss.
68. As a Candidate, I want an interrupted operation restored to a recoverable state after reload, so that I can resume the Candidate Session.
69. As a Candidate, I want at most one automatic retry for transient failures, so that the application neither fails too early nor loops indefinitely.
70. As a Candidate, I want the interface to respect reduced-motion preferences, so that dynamic feedback remains accessible.
71. As a keyboard user, I want to complete the entire Candidate Journey without a pointer, so that the product is operable with assistive input.
72. As a screen-reader user, I want phase changes, errors, and completed results announced, so that long operations remain understandable.
73. As a mobile Candidate, I want to upload, score, correct, generate, preview, and export, so that the journey is not desktop-only.
74. As a mobile Candidate, I want the PDF preview scaled without pretending to be a precision layout editor, so that the experience remains usable on a small screen.
75. As a Candidate, I want to adapt the same Source Profile to another Job Posting, so that I do not repeat extraction during the 24-hour session.
76. As a Candidate, I want one current draft per Job Posting, so that the MVP remains simple and does not become an application tracker.
77. As a Candidate, I want the active model provider disclosed only in the Processing Policy, so that routine product language remains understandable and provider-neutral.
78. As a Candidate, I want renewed consent before my content reaches a changed provider or policy, so that provider substitution is never silent.
79. As a Candidate, I want the product to avoid persistent server storage of my documents and generated resume, so that private professional content remains browser-local.
80. As a Candidate, I want to delete my Candidate Session, so that I can remove its browser-local content immediately.
81. As a Candidate, I want to report whether the downloaded Tailored Resume is usable without structural rewriting, so that the MVP measures its actual promise.
82. As a product maintainer, I want privacy-safe journey and correction counters, so that I can improve conversion and quality without collecting Candidate content.
83. As a product maintainer, I want technology, general management, and sales evaluation suites, so that public segment support is evidence-based.
84. As a product maintainer, I want hybrid and senior roles represented in evaluation data, so that titles such as DevOps, Tech Lead, CTO, and Sales Engineer do not become untested edge cases.
85. As a product maintainer, I want quality gates applied per role family rather than only globally, so that one strong segment cannot hide another segment's failure.
86. As a product maintainer, I want the model provider replaceable behind one interface, so that changing providers does not rewrite the domain or Candidate Journey.

## Implementation Decisions

- Replace the current four-step workflow with the three Candidate Journey phases Source Intake, Job Match, and Tailored Resume Preparation.
- Perform a hard cutover. Delete the old workflow presentation and persisted format rather than maintaining compatibility or parallel implementations.
- Version browser persistence and discard incompatible 24-hour test sessions with a clear message. No historical session migration is required.
- Accept text-based PDF, DOCX, and pasted professional text for Source Documents. Limit documents to five pages for the MVP. Reject scans, encrypted documents, unsupported formats, and empty extraction explicitly; do not add OCR.
- Preserve the original Source Document content only in the browser for the Candidate Session. Do not attempt to retain or edit arbitrary source layouts.
- Replace the flat Source Profile fact collection as the sole document model with a structured Source Profile containing identity metadata, experiences, projects, skills, education, languages, and certifications.
- Retain Candidate Facts as provenance units beneath the structured Source Profile. Imported usable facts are collectively attested after Processing Consent; only Critical Ambiguities require targeted resolution.
- Remove exhaustive Source Profile and Job Requirement review from the required journey. Detailed inspection remains optional.
- Treat organization, role, experience association, chronology-relevant dates, contradictions, and critical-requirement evidence as potential Critical Ambiguities. Isolate nonessential uncertainty instead of blocking the entire Source Profile.
- Accept pasted Job Posting text and text-based PDF or TXT Job Posting files. Do not implement URL scraping.
- Preserve the original Job Posting locally while extracting only source-backed Target Role, Job Requirements, Requirement Importance, Practical Constraints, and excerpts.
- Introduce a provider-neutral resume-matching-engine package. Its public interface owns normalization, duplicate grouping, evidence validation, score calculation, bands, generation eligibility, and critical reserves.
- Keep model adapters outside the matching engine. Model output proposes structured requirements and evidence; deterministic rules validate the proposal before it affects a Match Analysis.
- Evaluate requirements across reusable Capability Dimensions instead of assigning the Candidate or Job Posting to a fixed role persona.
- Classify Requirement Importance as critical, central, or complementary with respective base weights of 3, 2, and 1.
- Count covered, partially covered, and uncovered requirements as all, half, and none of their effective weight.
- Allow partial coverage only when Candidate Facts demonstrate the same capability at incomplete scope. Adjacent capabilities do not qualify.
- Group semantic duplicates and substitutable requirements before scoring so repeated wording cannot multiply influence.
- Cap complementary requirements at 25 percent of the total effective Match Score weight.
- Keep Practical Constraints separate from the Match Score and Generation Eligibility.
- Add a Critical Requirement Reserve to Match Analysis. A critical gap qualifies the interpretation of the Match Band but does not automatically decide whether the Candidate should apply.
- Keep Generation Eligibility when at least one relevant Candidate Fact exists, regardless of a low Match Score. Deny Tailored Resume generation only when no relevant evidence exists; a normalized but explicitly non-tailored source resume may remain available.
- Calibrate Match Band thresholds through evaluation rather than treating the current 50 and 75 boundaries as permanent.
- Show by default the Match Score, Match Band, measurement explanation, three strengths, three priority gaps, critical reserves, and important Practical Constraints. Keep complete requirement evidence in an optional disclosure.
- Replace the flat Tailored Resume claim list with a structured Tailored Resume document containing identity, Target Role, Value Proposition, experiences, skills, education, languages, and relevant projects or certifications.
- Require field-level provenance for every generated or reformulated professional value. Identity and contact values are local exceptions and never enter model context.
- Build the Value Proposition as a two-to-four-line, evidence-backed explanation of why the Candidate is relevant to the Target Role. Do not generate unsupported seniority, personality traits, ambitions, scope, or outcomes.
- Reuse exact Job Posting terminology only when it is semantically equivalent to supported Candidate evidence. Unsupported terminology remains in Gap Analysis.
- Categorize experience presentation as Relevant Experience, Context Experience, or Earlier Experience so tailoring remains concise without implying a false chronology.
- Use one semantic, single-column ATS-first resume template with standard section names, selectable text, embedded fonts, natural reading order, and no skill gauges.
- Keep one page as the default and allow a second page only when required evidence or meaningful senior evidence would otherwise be lost.
- Keep photo optional and disabled by default. Require a full name and at least one of email or phone before export; keep city and professional links optional.
- Infer the proposed resume language from the Job Posting and allow French or English override before generation. Never translate proper nouns, employers, or qualifications in a way that alters meaning.
- Permit local contact edits, supported wording edits, ordering, hiding, restoration, and explicit addition of genuine Candidate Facts.
- Block export only for unresolved unsupported edits. Validate at the affected field rather than reopening a global review.
- Treat regeneration as replacement of the current draft. Require confirmation when manual edits would be lost; do not implement automatic merging or version history.
- Apply deterministic invalidation rules: Candidate Fact changes recalculate Match Analysis and invalidate the Tailored Resume; Job Posting changes invalidate both; locale changes invalidate only the Tailored Resume; local identity, contact, and photo changes update only rendering.
- Use stable XState v5 actor logic inside the application module to orchestrate Candidate Session states, invoked operations, retries, recovery, and invalidation.
- Keep domain calculations and invariants outside XState as pure modules. The machine coordinates them through existing or deepened ports.
- Expose a small domain-named journey interface for dispatch, snapshot reading, and subscription. Do not expose machine state-node structure to React.
- Use one root Candidate Session actor with nested states for Source Intake, Job Match, and Tailored Resume Preparation. Keep disclosure, focus, and other purely visual state in React.
- Persist explicit, versioned domain state through the existing Candidate Session persistence port. Do not persist opaque actor snapshots, promises, adapters, or transient errors.
- Restore interrupted operations to the last stable recoverable state after reload.
- Use one automatic retry at most for transient failures. Preserve source input and the last stable result for explicit retry or replacement after final failure.
- Emit real progress phases from orchestration. Do not expose raw model tokens, unvalidated professional text, fake percentages, or provider-specific thinking language.
- Reveal Tailored Resume sections only after provenance validation. Use phase feedback, result-shaped skeletons, and a measured long-operation message.
- Use Mantine for the interactive application, including accessible controls, form behavior, feedback, and theme utilities.
- Use the Mantine theme as the single source of visual tokens. Add semantic application tokens centrally when needed, and enforce the absence of raw visual literals in interactive application code.
- Use CSS Modules only for layouts or behaviors not cleanly expressible through Mantine. Avoid scattered inline style, styles, and vars overrides.
- Keep the PDF renderer completely independent of Mantine. Physical A4 dimensions and deterministic print measurements are explicit exceptions to interactive design-token rules.
- Permit a complete visual redesign while preserving a distinctive editorial, trustworthy identity and avoiding a generic dashboard aesthetic.
- Use functional motion only: short journey transitions, visible state changes, validated-result entrances, and full prefers-reduced-motion support. Do not add decorative infinite animation or confetti.
- Target WCAG 2.2 AA, full keyboard operation, assistive-technology announcements, and no information conveyed only through color.
- Support the complete journey on mobile while optimizing precision editing for tablet and desktop.
- Introduce a provider-neutral Language Model Gateway for structured and writing model roles.
- Require the active gateway to supply a versioned Processing Policy containing provider identity, purposes, transmitted categories, retention policy, and storage behavior.
- Bind Processing Consent to the active Processing Policy. Require renewed consent after a material policy or provider change and prohibit silent fallback to an undisclosed provider.
- Keep provider names out of domain terminology, routine progress feedback, and public error types. Provider-specific adapter names and privacy-safe operational diagnostics remain allowed.
- Keep Candidate content browser-local for 24 hours and use stateless model calls with storage disabled. Do not persist Candidate documents or generated content on the server.
- Keep one current Job Posting draft at a time while retaining privacy-safe history metadata for additional Job Postings in the same Candidate Session.
- Record privacy-safe journey progression, Match Band, correction categories, Successful Downloads, and Outcome Feedback without Candidate identifiers or content.
- Define the primary MVP outcome as the percentage of Candidates who generated a Tailored Resume and report that it is usable for applying without structural rewriting.

## Testing Decisions

- Treat the Candidate Journey module interface as the primary test seam. Behavior tests dispatch one domain-named event and assert the resulting public snapshot without inspecting XState state nodes, actions, guards, or invoked actors.
- Preserve the repository's Given, Action, and Then behavior-test conventions and exercise one caller-visible action in each test action phase.
- Test Source Intake behavior through the journey seam, including consent, document failures, collective attestation, Critical Ambiguity isolation, targeted correction, and recovery.
- Test Job Match behavior through the journey seam, including noisy input, requirement extraction, grouping, importance, evidence, scoring, critical reserves, practical constraints, generation eligibility, enrichment, and invalidation.
- Test Tailored Resume Preparation through the journey seam, including language choice, structured generation, field provenance, editing, unsupported additions, ordering, hiding, regeneration warnings, and export eligibility.
- Add focused public-interface tests for the resume-matching-engine because it is an independently reusable deep module. Test observable Match Analysis results rather than helper functions or calculation internals.
- Add focused public-interface tests for the structured resume document preparation and rendering contract. Test retained content, provenance rejection, ordering, one-or-two-page selection, and deterministic failure results.
- Exercise transport and interaction behavior through the rendered web application. Verify the three-phase journey, focus management, keyboard behavior, responsive behavior, live-region announcements, long-operation feedback, and failure recovery.
- Keep adapter contract tests only where production behavior varies: Source Document readers, Language Model Gateway roles, Candidate Session persistence, analytics transport, and PDF generation.
- Use in-memory adapters for application behavior tests and recorded deterministic fixtures for provider contract tests. Never require live provider calls in the default test suite.
- Preserve preview-to-PDF contract tests for semantic content, ordering, selectable text, embedded fonts, A4 dimensions, overflow handling, and contact-data isolation.
- Preserve browser compatibility tests across the supported Chromium, Firefox, and WebKit desktop and mobile targets.
- Build a minimum qualification corpus of 70 anonymized or synthetic CV and Job Posting pairs: 30 technology, 20 general management, and 20 sales.
- Include individual-contributor technology, DevOps/SRE, security, data, Tech Lead, Engineering Manager, Head of Engineering, CTO, general operations, finance, HR, program leadership, SDR/BDR, Account Executive, Key Account, Sales Manager, and hybrid roles.
- Include French and English, short and long postings, overloaded wishlists, strong matches, partial matches, unsuitable profiles, ambiguous evidence, duplicate requirements, and critical gaps.
- Split the corpus into development and held-out qualification sets. Do not tune prompts or deterministic rules against the held-out set.
- Annotate expected Job Requirements, importance, groups, Match Evidence, prohibited matches, critical reserves, and acceptable Match Score ranges through human review.
- Require at least 95 percent recall for mandatory or critical requirements, at least 95 percent requirement precision, at least 98 percent Match Evidence precision, at least 90 percent valid-evidence recall, no more than five points mean Match Score error, no more than ten points error for any scenario, zero unsupported Tailored Resume claims, and 100 percent valid exportable qualification PDFs.
- Apply quality thresholds per supported role family. A passing aggregate cannot hide a failing technology, general-management, or sales segment.
- Use the existing workflow behavior tests, rendered workspace tests, model contract tests, model qualification suite, and PDF contract tests as prior art while replacing assertions tied to the old four-step and flat-claim behavior.
- Run the complete architecture, convention, lint, type-check, unit, evaluation, browser, and production-build checks before release.

## Out of Scope

- Accounts, authentication, cross-device history, or server-side Candidate content storage.
- Persistent application tracking, multiple draft versions, automatic draft merging, or collaboration.
- Reproducing or editing the arbitrary visual layout of an uploaded resume.
- Multiple resume templates or candidate-selectable visual themes.
- DOCX export or editable office-document export.
- OCR for scanned resumes or scanned Job Postings.
- Job Posting URL scraping or third-party job-board integrations.
- Automatic application submission, cover-letter generation, interview coaching, or recruiter communication.
- Hiring-probability prediction, candidate ranking for employers, or automated application decisions.
- Hidden role-specific scoring branches or Candidate classification into fixed personas.
- Languages other than French and English.
- Silent multi-provider failover.
- Migration of the current browser-local session format.
- A pixel-precision mobile resume layout editor.
- Raw model token streaming or display of unvalidated professional content.

## Further Notes

- The target audience at launch is technology professionals, general management professionals, and sales professionals. Support is a quality claim and must remain gated by the per-segment evaluation suite.
- The Candidate's original resume may itself contain mistakes. Collective attestation removes repetitive verification but does not guarantee truth beyond Candidate-provided evidence; targeted correction and provenance keep the product honest about that limitation.
- Long employer wishlists are normalized through importance, grouping, and complementary-weight capping. The Match Score remains an explanation of explicit evidence coverage, not an assertion that the employer will disregard its own requirements.
- Provider disclosure is configuration-driven but must remain visible in the Processing Policy. Product neutrality must never become processor opacity.
- The first implementation plan should be split into independently releasable vertical slices internally, but the public product should switch only when the full three-phase journey is qualified end to end.
- The source ADRs and glossary are part of the specification contract. Implementation issues must link back to this spec and preserve its terminology.
