# Resume Tailoring

This context turns a candidate's verified professional facts into a resume targeted at one job posting without fabricating qualifications.

## Language

**Candidate**:
The person generating a resume from their own professional information.
_Avoid_: User, applicant, profile owner

**Source Profile**:
The structured set of professional facts approved by the Candidate after document import and manual editing.
_Avoid_: LinkedIn profile, raw profile, candidate data

**Source Profile Review**:
The transient, browser-local working state used to build a Source Profile. It contains the minimized Source Document content and immutable Source Profile Facts in extracted, verified, rejected, or superseded states.

**Source Profile Fact**:
An immutable professional proposition in the Source Profile Review. It becomes a Verified Fact only after explicit Candidate confirmation.

**Source Document**:
A text-based LinkedIn PDF or existing resume supplied by the Candidate as input for the Source Profile.
_Avoid_: Profile URL, scraped profile, raw PDF

**Verified Fact**:
Professional information extracted from a Source Document or manually added, then explicitly confirmed by the Candidate. It may describe experience, skills, education, languages, or projects.
_Avoid_: Inferred skill, assumed qualification

**Derived Fact**:
A deterministic value calculated from Verified Facts, such as a non-overlapping duration computed from complete dates. It never assigns a qualitative level or introduces new professional information.
_Avoid_: Inference, estimate, assumed seniority

**Job Posting**:
The Candidate-provided text describing one employment opportunity against which a Source Profile is evaluated.
_Avoid_: Job offer URL, advert, listing

**Job Posting Review**:
The browser-local working state used to minimize one Job Posting, confirm its current processing notice, and review its extracted Job Requirements.
_Avoid_: Stored job, server-side posting, listing review

**Job Requirement**:
An explicit qualification or expectation extracted from a Job Posting and classified as required or preferred.
_Avoid_: Keyword, criterion

**Match Evidence**:
The explicit relationship between one covered Job Requirement and one or more Verified Facts that support it.
_Avoid_: Keyword match, inferred match

**Match Score**:
The percentage expressing how strongly the Source Profile's Verified Facts cover the requirements of a Job Posting.
_Avoid_: Fit score, compatibility score

**Match Analysis**:
The evidence-backed result combining Match Evidence, the deterministic Match Score, Generation Eligibility, and the Gap Analysis for one Source Profile and Job Posting.
_Avoid_: Model score, suitability decision

**Generation Threshold**:
The advisory Match Score threshold of 50%. Falling below it produces a warning and never decides Generation Eligibility.
_Avoid_: Eligibility score, cutoff

**Tailored Resume**:
A one-page resume that selects, orders, translates, and reformulates only Verified Facts relevant to one Job Posting. It may include a Candidate-supplied photo.
_Avoid_: Generated CV, optimized CV

**Relevant Experience**:
A dated role or project selected for its relationship to a Job Posting without implying that it represents the Candidate's complete career history.
_Avoid_: Work history, complete experience

**Resume Claim**:
A concise statement included in a Tailored Resume and internally linked to one or more Verified Facts that support it. It may compress wording but must preserve the meaning, dates, levels, and outcomes of its supporting facts.
_Avoid_: Generated statement, inferred claim

**Gap Analysis**:
An explanation of important Job Posting requirements that are not supported by Verified Facts.
_Avoid_: Missing skills, weaknesses

**Outcome Feedback**:
The Candidate's browser-local assessment of whether a Tailored Resume is faithful to their professional history and relevant to the target role. Each assessment is recorded at most once per Candidate session for aggregate MVP measurement.
_Avoid_: Candidate satisfaction profile, professional-history analytics

**Correction Activity**:
A privacy-safe operational count of Source Profile Fact corrections and Resume Claim removal, reordering, or reformulation. It records only the correction category and an optional Match Score band, never the corrected content.
_Avoid_: Edit history, Candidate activity log

**Successful Download**:
The operational event recorded after a validated Tailored Resume PDF has been created and handed to the browser for download.
_Avoid_: Stored resume, tracked document

**MVP Outcome Analytics**:
Aggregate counters for Outcome Feedback, Correction Activity, and Successful Downloads. They may be grouped by Match Score band but never contain Candidate identifiers or Candidate content.
_Avoid_: Candidate analytics, profile analytics
