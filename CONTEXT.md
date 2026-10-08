# Resume Tailoring

This context turns a Candidate's declared professional evidence into an explainable Match Analysis and a complete Tailored Resume for one Job Posting without fabricating qualifications.

## Candidate journey

**Candidate**:
The person evaluating an opportunity and generating a resume from their own professional information.
_Avoid_: User, applicant, profile owner

**Candidate Journey**:
The Candidate's progression from a Source Document and Job Posting to a reviewable resume result, either a Tailored Resume or a Normalized Resume, with Source Intake, Job Match, and Tailored Resume Preparation as its underlying phases.
_Avoid_: Workflow, wizard, four-step journey

**Source Intake**:
The Candidate Journey phase in which the Candidate supplies professional evidence and resolves only the Critical Ambiguities that prevent safe reuse.
_Avoid_: Source Profile step, profile review step

**Job Match**:
The Candidate Journey phase in which one Job Posting is compared with Candidate Facts to produce a Match Analysis and Generation Eligibility.
_Avoid_: Job Posting step, Match Analysis step

**Tailored Resume Preparation**:
The Candidate Journey phase in which the Candidate generates, controls, previews, and exports a Tailored Resume.
_Avoid_: Resume Claims step, Tailored Resume step

**Candidate Session**:
The private, browser-local workspace in which one Candidate can reuse one Source Profile for multiple Job Postings for 24 hours.
_Avoid_: Account, server profile

## Processing and privacy

**Processing Policy**:
The versioned disclosure of the active model provider, processing purposes, transmitted data categories, retention policy, and storage behavior.
_Avoid_: OpenAI policy, static consent copy

**Processing Consent**:
The Candidate's confirmation of the current Processing Policy before the first model operation that uses Candidate content; a materially changed policy requires new consent.
_Avoid_: Per-document consent, per-action consent

**Language Model Provider**:
The disclosed external processor selected to perform model-backed operations under the current Processing Policy.
_Avoid_: OpenAI in domain language, AI session

**API Failure**:
The type, from one closed catalogue, with which a server route answers a failed request, together with its HTTP status; it names what went wrong, never the operation.
_Avoid_: Error code, operation-prefixed failure

**Failure Cause**:
The provider-neutral reason a model-backed operation failed, read from its API Failure: access required, rate limited (with the delay to wait), timeout, input too large, service unavailable, network, or unexpected. It is kept with a failed preparation so it survives a reload.
_Avoid_: Error type, transient or permanent failure

**Recovery**:
The one action the application derives from a Failure Cause to let the Candidate continue: renew access, retry after a delay, shorten the input, retry, or reload. The interface offers it; it never decides it.
_Avoid_: Error handling, fallback, retry policy

## Candidate evidence

**Source Document**:
A text-based resume, LinkedIn PDF, or pasted professional text supplied by the Candidate as input for the Source Profile.
_Avoid_: Profile URL, scraped profile, raw PDF

**Source Profile**:
The structured, exhaustive representation of Candidate evidence obtained from the Source Document and Candidate corrections, including experiences, projects, skills, education, languages, and certifications.
_Avoid_: LinkedIn profile, raw profile, flat fact list

**Critical Ambiguity**:
An extraction uncertainty that makes one Candidate Fact unsafe to order, score, or reuse without Candidate correction; it excludes only the affected fact unless no usable professional evidence remains.
_Avoid_: Unverified fact, blocking profile error

**Candidate Fact**:
A professional proposition taken from a Candidate-supplied Source Document or explicitly added by the Candidate, retained as provenance for structured Source Profile and Tailored Resume values.
_Avoid_: Verified Fact, inferred skill, assumed qualification

**Derived Fact**:
A deterministic value calculated from Candidate Facts, such as a non-overlapping duration computed from complete dates; it never assigns a qualitative level or introduces new professional information.
_Avoid_: Inference, estimate, assumed seniority

**Profile Enrichment Prompt**:
A targeted, optional question asked after Match Analysis to determine whether the Candidate has real professional evidence absent from the Source Profile but relevant to a central or critical Job Requirement.
_Avoid_: Suggested experience, generated experience

## Job requirements and matching

**Job Posting**:
The Candidate-provided text describing one employment opportunity against which a Source Profile is evaluated.
_Avoid_: Job offer URL, advert, listing

**Target Role**:
The unambiguous role title copied from an exact Job Posting excerpt and used as the Tailored Resume heading; when absent, the interface uses an explicit localized fallback.
_Avoid_: Inferred title, desired role, generated headline

**Job Requirement**:
One assessable capability that a Job Posting explicitly asks for, as a qualification, responsibility, or expectation, backed by an exact source excerpt, assigned a Capability Dimension, and reviewed with a Requirement Importance. Generic duties listed together in one sentence form a single Job Requirement rather than one per phrase.
_Avoid_: Keyword, hidden criterion, sentence fragment

**Capability Dimension**:
A role-neutral area in which a Job Requirement asks for evidence: technical expertise, execution, ownership, leadership, strategy, stakeholder communication, or operational risk. Dimensions organize analysis without assigning a fixed Candidate persona.
_Avoid_: Role family, Candidate persona, title category

**Requirement Importance**:
The reviewed significance of a Job Requirement as critical, central, or complementary. These levels have respective base weights of three, two, and one before duplicate grouping and the complementary-weight cap.
_Avoid_: Requirement priority, model confidence

**Requirement Group**:
The scoring unit formed by semantically duplicate or explicitly substitutable Job Requirements. A group may span Capability Dimensions, retains the identities and capabilities of its source requirements, and contributes one importance and coverage outcome to the Match Score.
_Avoid_: Requirement cluster, keyword bucket

**Requirement Coverage**:
The evidence-backed assessment of a Job Requirement as covered, partially covered, or not covered. A requirement is covered when Candidate Facts show the same capability, even in different words. It is partially covered when the same capability appears at incomplete scope, or when a behavioral capability is only implied by a role's responsibilities. A related but distinct capability, such as another technology in the same domain, leaves the requirement not covered. These states contribute respectively all, half, or none of the requirement's effective weight to the Match Score.
_Avoid_: Model confidence, keyword equality

**Match Evidence**:
The explicit relationship between one covered or partially covered Job Requirement and one or more Candidate Facts that support it. The relationship may rest on reformulation or translation, but always cites text that exists in both the Job Requirement and the Candidate Facts.
_Avoid_: Keyword match, invented match

**Adjacent Evidence**:
A Candidate Fact showing a related but distinct capability for an uncovered Job Requirement, such as another technology in the same domain. It is shown to the Candidate alongside the gap, never changes Requirement Coverage or the Match Score, and never lets the Tailored Resume claim the requested capability.
_Avoid_: Partial coverage, transferable proof

**Match Score**:
The percentage expressing how strongly the Source Profile's Candidate Facts cover the explicit professional requirements of a Job Posting. Critical, central, and complementary requirements have base weights of three, two, and one; duplicates are grouped, complementary influence is capped at 25 percent, and Requirement Coverage contributes all, half, or none of the effective weight. The score does not estimate hiring probability.
_Avoid_: Fit score, compatibility score, hiring likelihood

**Match Band**:
The calibrated advisory interpretation of a Match Score: strong from 75 to 100, credible from 50 to 74, and ambitious from 0 to 49.
_Avoid_: Application verdict, hiring probability

**Critical Requirement Reserve**:
An explicit qualification on the Match Band when a critical Job Requirement is partially covered or uncovered. It exposes decisive evidence risk without changing Generation Eligibility, overriding the score, or deciding whether the Candidate should apply.
_Avoid_: Automatic rejection, score override, application blocker

**Practical Constraint**:
An explicit condition such as location, remote-work policy, work authorization, availability, or compensation that may affect whether an application is viable without measuring professional evidence coverage. It never changes the Match Score or Generation Eligibility.
_Avoid_: Job Requirement, score penalty

**Improvement Opportunity**:
An unscored observation about an implicit convention, terminology choice, or possible profile improvement that is not an explicit Job Requirement.
_Avoid_: Hidden requirement, inferred requirement

**Gap Analysis**:
An explanation of important Job Requirements that are partially supported or unsupported by Candidate Facts.
_Avoid_: Missing skills, weaknesses

**Generation Eligibility**:
The ability to create a Tailored Resume when at least one Candidate Fact provides explicit evidence relevant to the Job Posting; low coverage warns but does not remove eligibility.
_Avoid_: Hiring eligibility, score cutoff

**Match Analysis**:
The evidence-backed result combining Match Evidence, the deterministic Match Score, Match Band, Critical Requirement Reserve, Generation Eligibility, Gap Analysis, and Practical Constraints.
_Avoid_: Model score, suitability decision

## Tailored resume

**Tailored Resume**:
A complete, ATS-first resume that selects, orders, translates, and reformulates only supported Candidate evidence for one Job Posting, using one page by default and two when relevant evidence requires it.
_Avoid_: Generated bullets, optimized CV, complete career history

**Normalized Resume**:
A complete resume organized from supported Candidate evidence without claiming adaptation to a particular Job Posting.
_Avoid_: Tailored Resume, matched resume, fallback match

**Resume Field**:
A structured Tailored Resume value whose professional content retains direct provenance to one or more Candidate Facts.
_Avoid_: Free text, generated field

**Resume Section**:
One planned part of a Tailored Resume, such as the Value Proposition, one experience, or the skills, written and validated on its own before it appears in the preview.
_Avoid_: Chunk, partial resume, streamed text

**Copied Section**:
An experience Resume Section taken word for word from its attested Candidate Facts after its rewrite still failed as unsupported. It keeps its copied origin through saving, editing, and condensation, and the interface tells the Candidate it reuses their own wording; the exported resume does not.
_Avoid_: Fallback section, raw section, unwritten section

**Resume Claim**:
A concise professional statement within a Resume Field whose meaning, dates, scope, level, and outcomes remain supported by its linked Candidate Facts.
_Avoid_: Generated statement, inferred claim

**Value Proposition**:
The two-to-four-line opening summary that explains within the first reading moments why the Candidate's strongest supported evidence is relevant to the Target Role.
_Avoid_: Personal objective, generic profile summary

**Relevant Experience**:
A dated role or project selected for its relationship to the Job Posting without implying that it represents the Candidate's complete career history.
_Avoid_: Work history, complete experience

**Context Experience**:
A recent but less relevant role retained in condensed form to preserve an honest and intelligible career chronology.
_Avoid_: Filler experience, irrelevant role

**Earlier Experience**:
An older role retained as title, organization, and dates when detail is unnecessary but omission would make the chronology misleading.
_Avoid_: Hidden experience, discarded career history

**Page Budget**:
The page count a Tailored Resume aims for: one page by default, two when the Relevant Experiences alone cannot fit on one.
_Avoid_: Page limit, length setting

**Overflow Reduction**:
The fixed, deterministic sequence of steps that turns content into Hidden Content until the Tailored Resume fits its Page Budget, without calling a language model.
_Avoid_: Auto-shortening, condensation, trimming

**Hidden Content**:
Resume content kept out of the Tailored Resume but never deleted, tagged with its origin (hidden by the Candidate, or by Overflow Reduction) and restorable from the editor in one click. Content the Candidate restored is never hidden again by Overflow Reduction, unless the Candidate asks to shorten a resume that nothing else can bring back within its Page Budget.
_Avoid_: Deleted content, removed claims

## Outcomes

**Outcome Feedback**:
The Candidate's browser-local assessment of whether a downloaded Tailored Resume is usable for applying without structural rewriting, with an optional comment.
_Avoid_: Candidate satisfaction profile, professional-history analytics

**Correction Activity**:
A privacy-safe operational count of Candidate Fact corrections and Tailored Resume removal, reordering, addition, or reformulation; it never records the corrected content.
_Avoid_: Edit history, Candidate activity log

**Successful Download**:
The operational event recorded after a validated Tailored Resume PDF has been created and handed to the browser for download.
_Avoid_: Stored resume, tracked document

**MVP Outcome Analytics**:
Aggregate counters for Candidate Journey progression, Outcome Feedback, Correction Activity, and Successful Downloads, optionally grouped by Match Band without Candidate identifiers or Candidate content.
_Avoid_: Candidate analytics, profile analytics
