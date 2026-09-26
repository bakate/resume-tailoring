# Resume Tailoring

This context turns a candidate's verified professional facts into a resume targeted at one job posting without fabricating qualifications.

## Language

**Candidate**:
The person generating a resume from their own professional information.
_Avoid_: User, applicant, profile owner

**Source Profile**:
The structured set of professional facts approved by the Candidate after document import and manual editing.
_Avoid_: LinkedIn profile, raw profile, candidate data

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

**Job Requirement**:
An explicit qualification or expectation extracted from a Job Posting and classified as required or preferred.
_Avoid_: Keyword, criterion

**Match Evidence**:
The explicit relationship between one covered Job Requirement and one or more Verified Facts that support it.
_Avoid_: Keyword match, inferred match

**Match Score**:
The percentage expressing how strongly the Source Profile's Verified Facts cover the requirements of a Job Posting.
_Avoid_: Fit score, compatibility score

**Generation Threshold**:
The minimum Match Score required to produce a Tailored Resume. The threshold is 50%.
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
