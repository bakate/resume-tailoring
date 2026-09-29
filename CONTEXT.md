# Resume Tailoring

This context turns a Candidate's declared professional evidence into an explainable Match Analysis and a complete Tailored Resume for one Job Posting without fabricating qualifications.

## Candidate journey

**Candidate**:
The person evaluating an opportunity and generating a resume from their own professional information.
_Avoid_: User, applicant, profile owner

**Candidate Session**:
The private, browser-local workspace in which one Candidate can reuse one Source Profile for multiple Job Postings for 24 hours.
_Avoid_: Account, server profile

**Candidate Journey**:
The three-phase progression through Source Intake, Job Match, and Tailored Resume Preparation.
_Avoid_: Wizard, four-step workflow

**Source Intake**:
The Candidate Journey phase that receives a Source Document, obtains Processing Consent, builds the Source Profile, and requests only targeted Critical Ambiguity resolution.
_Avoid_: Source Profile Review, fact verification step

**Job Match**:
The Candidate Journey phase that receives one Job Posting and produces its Match Analysis without requiring a separate requirement-review ceremony.
_Avoid_: Job Posting Review, scoring step

**Tailored Resume Preparation**:
The Candidate Journey phase that creates, validates, edits, previews, and exports one Tailored Resume for the current Job Posting.
_Avoid_: Claim curation, bullet generation

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
An explicit qualification, responsibility, or expectation extracted from a Job Posting and supported by an exact source excerpt.
_Avoid_: Keyword, hidden criterion

**Requirement Importance**:
The evidence-backed classification of a Job Requirement as critical, central, or complementary according to how the Job Posting presents it.
_Avoid_: Required/preferred flag, model confidence

**Requirement Group**:
A set of semantically duplicate or substitutable Job Requirements counted together to prevent repetition from inflating the Match Score.
_Avoid_: Keyword group, role taxonomy

**Capability Dimension**:
A cross-role area of professional capability, such as technical expertise, execution, ownership, leadership, strategy, stakeholder communication, or operational risk.
_Avoid_: Candidate persona, fixed job family

**Requirement Coverage**:
The evidence-backed assessment of a Job Requirement as covered, partially covered, or not covered; partial coverage requires evidence of the same capability at incomplete scope.
_Avoid_: Model confidence, semantic similarity

**Match Evidence**:
The explicit relationship between one covered or partially covered Job Requirement and one or more Candidate Facts that support it.
_Avoid_: Keyword match, inferred match

**Match Score**:
The percentage expressing how strongly Candidate Facts cover the explicit professional requirements of a Job Posting after importance weighting, duplicate grouping, and complementary-requirement capping; it does not estimate hiring probability.
_Avoid_: Fit score, compatibility score, hiring likelihood

**Match Band**:
The calibrated advisory interpretation of a Match Score as strong, credible, or ambitious evidence coverage.
_Avoid_: Application verdict, hiring probability

**Critical Requirement Reserve**:
A separate warning that a critical Job Requirement is uncertain or unsupported even when aggregate evidence coverage is otherwise strong.
_Avoid_: Automatic rejection, score override

**Practical Constraint**:
An explicit condition such as location, remote-work policy, work authorization, availability, or compensation that may affect whether an application is viable without measuring professional evidence coverage.
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

**Resume Field**:
A structured Tailored Resume value whose professional content retains direct provenance to one or more Candidate Facts.
_Avoid_: Free text, generated field

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
