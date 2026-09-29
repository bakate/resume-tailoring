# Resume Tailoring

This context turns a candidate's declared professional facts into a resume targeted at one job posting without fabricating qualifications.

## Language

**Candidate**:
The person generating a resume from their own professional information.
_Avoid_: User, applicant, profile owner

**Candidate Session**:
The private, browser-local workspace in which one Candidate can reuse one Source Profile for 24 hours.
_Avoid_: Account, server profile

**Processing Consent**:
The Candidate's single confirmation, collected before the first model operation, that Source Documents and Job Postings may be processed transiently throughout the Candidate Session under the disclosed policy.
_Avoid_: Per-document consent, per-action consent

**Source Profile**:
The structured set of Candidate Facts obtained from the Candidate's Source Document and optional corrections.
_Avoid_: LinkedIn profile, raw profile, candidate data

**Source Profile Review**:
The Candidate's opportunity to inspect and correct a Source Profile before using it. Continuing from the review collectively attests its Candidate Facts; individual confirmation is not required.

**Critical Ambiguity**:
An extraction uncertainty that makes one Candidate Fact unsafe to score or reuse without Candidate correction. It excludes only the affected fact unless no usable professional evidence remains.
_Avoid_: Unverified fact, blocking profile error

**Source Document**:
A text-based LinkedIn PDF, existing resume, or pasted professional text supplied by the Candidate as input for the Source Profile.
_Avoid_: Profile URL, scraped profile, raw PDF

**Candidate Fact**:
A professional proposition taken from a Candidate-supplied Source Document or explicitly added by the Candidate, including through a Profile Enrichment Prompt. Imported facts are collectively attested by continuing from Source Profile Review; Candidate-authored facts retain explicit authorship and contradictory propositions require targeted correction.
_Avoid_: Verified Fact, Source Profile Fact, inferred skill, assumed qualification

**Profile Enrichment Prompt**:
A targeted, optional question asked after the initial Match Analysis to determine whether the Candidate has real professional evidence absent from the Source Profile but relevant to a required Job Requirement. At most three prompts surface initially, prioritized by potential Match Score impact; they never propose or create an experience for the Candidate.
_Avoid_: Suggested experience, generated experience

**Derived Fact**:
A deterministic value calculated from Candidate Facts, such as a non-overlapping duration computed from complete dates. It never assigns a qualitative level or introduces new professional information.
_Avoid_: Inference, estimate, assumed seniority

**Job Posting**:
The Candidate-provided text describing one employment opportunity against which a Source Profile is evaluated.
_Avoid_: Job offer URL, advert, listing

**Job Posting Review**:
The browser-local working state used to minimize one Job Posting, confirm its current processing notice, and review its extracted Job Requirements.
_Avoid_: Stored job, server-side posting, listing review

**Target Role**:
The unambiguous role title copied from an exact Job Posting excerpt and reviewed by the Candidate before it becomes the Tailored Resume heading. When the Job Posting does not state one, the interface uses an explicit localized fallback instead of inventing a role.
_Avoid_: Inferred title, desired role, generated headline

**Job Requirement**:
An explicit qualification or expectation extracted from a Job Posting, backed by an exact excerpt, assigned a Capability Dimension, and reviewed with a Requirement Importance.
_Avoid_: Keyword, criterion

**Capability Dimension**:
A role-neutral area in which a Job Requirement asks for evidence: technical expertise, execution, ownership, leadership, strategy, stakeholder communication, or operational risk. Dimensions organize analysis without assigning a fixed Candidate persona.
_Avoid_: Role family, Candidate persona, title category

**Requirement Importance**:
The reviewed significance of a Job Requirement as critical, central, or complementary. These levels have respective base weights of three, two, and one before duplicate grouping and the complementary-weight cap.
_Avoid_: Requirement priority, model confidence

**Requirement Coverage**:
The evidence-backed assessment of a Job Requirement as covered, partially covered, or not covered. These states contribute respectively all, half, or none of the requirement's weight to the Match Score.
_Avoid_: Model confidence, match probability

**Match Evidence**:
The explicit relationship between one covered or partially covered Job Requirement and one or more Candidate Facts that support it.
_Avoid_: Keyword match, inferred match

**Match Score**:
The percentage expressing how strongly the Source Profile's Candidate Facts cover the explicit professional requirements of a Job Posting. Critical, central, and complementary requirements have base weights of three, two, and one; duplicates are grouped, complementary influence is capped at 25 percent, and Requirement Coverage contributes all, half, or none of the effective weight. The score does not estimate hiring probability.
_Avoid_: Fit score, compatibility score

**Improvement Opportunity**:
An unscored observation about an implicit convention, keyword, or possible profile improvement that is not an explicit Job Requirement. It remains separate from the Match Score.
_Avoid_: Hidden requirement, inferred requirement

**Practical Constraint**:
An explicit condition such as location, remote-work policy, work authorization, availability, or compensation that may affect whether an application is viable without measuring professional evidence coverage. It is reported separately and never changes the Match Score or Generation Eligibility.
_Avoid_: Job Requirement, score penalty

**Match Analysis**:
The evidence-backed result combining Match Evidence, the deterministic Match Score, Generation Eligibility, and the Gap Analysis for one Source Profile and Job Posting.
_Avoid_: Model score, suitability decision

**Match Band**:
The advisory interpretation of a Match Score: strong from 75 to 100, credible from 50 to 74, and ambitious from 0 to 49. A Match Band communicates evidence coverage rather than hiring probability.
_Avoid_: Hiring likelihood, application verdict

**Critical Requirement Reserve**:
An explicit qualification on the Match Band when a critical Job Requirement is partially covered or uncovered. It exposes decisive evidence risk without changing Generation Eligibility or deciding whether the Candidate should apply.
_Avoid_: Automatic rejection, application blocker

**Generation Eligibility**:
The ability to create a Tailored Resume when at least one Candidate Fact provides explicit evidence relevant to the Job Posting. A low Match Score produces a warning but never removes eligibility.
_Avoid_: Application eligibility, hiring eligibility

**Generation Threshold**:
The advisory Match Score threshold of 50%. Falling below it produces a warning and never decides Generation Eligibility.
_Avoid_: Eligibility score, cutoff

**Tailored Resume**:
A one-page-by-default resume that selects, orders, translates, and reformulates only Candidate Facts relevant to one Job Posting. It may extend to two pages when required evidence or at least two preferred claims would otherwise be lost, and may include a Candidate-supplied photo.
_Avoid_: Generated CV, optimized CV

**Relevant Experience**:
A dated role or project selected for its relationship to a Job Posting without implying that it represents the Candidate's complete career history.
_Avoid_: Work history, complete experience

**Resume Claim**:
A concise statement included in a Tailored Resume and internally linked to one or more Candidate Facts that support it. It may compress wording but must preserve the meaning, dates, levels, and outcomes of its supporting facts.
_Avoid_: Generated statement, inferred claim

**Gap Analysis**:
An explanation of important Job Posting requirements that are only partially supported or not supported by Candidate Facts.
_Avoid_: Missing skills, weaknesses

**Outcome Feedback**:
The Candidate's browser-local yes/no assessment of whether a downloaded Tailored Resume was useful, with an optional comment. It is recorded at most once per Candidate session for aggregate MVP measurement.
_Avoid_: Candidate satisfaction profile, professional-history analytics

**Correction Activity**:
A privacy-safe operational count of Candidate Fact corrections and Resume Claim removal, reordering, or reformulation. It records only the correction category and an optional Match Score band, never the corrected content.
_Avoid_: Edit history, Candidate activity log

**Successful Download**:
The operational event recorded after a validated Tailored Resume PDF has been created and handed to the browser for download.
_Avoid_: Stored resume, tracked document

**MVP Outcome Analytics**:
Aggregate counters for Outcome Feedback, Correction Activity, and Successful Downloads. They may be grouped by Match Score band but never contain Candidate identifiers or Candidate content.
_Avoid_: Candidate analytics, profile analytics
