# Structured Resume contract

BAK-56 establishes the document boundary shared by BAK-57 (preparation), BAK-58
(editing and condensation), and BAK-59 (layout and export). It does not deliver
model-backed writing, a section editor, or validated PDF generation.

## Document and evidence

One semantic document passes through composition, browser-local persistence,
editing, preview, and export. Experiences retain named role, organization, dates,
context, and achievements. Skill categories group deduplicated items. Education,
languages, projects, and certifications remain distinct sections.

Professional fields carry stable identities and Candidate Fact references.
Selection, hiding, deduplication, and condensation never mutate the Source
Profile or delete Candidate Facts. Identity and contacts remain local exceptions
and must not enter writing or validation model requests. A fact reference is
necessary provenance, but does not by itself validate the meaning of new prose.

A Value Proposition distinguishes extracted evidence from written prose. The
deterministic prefactor must not label copied fragments as model-written prose.
A Normalized Resume uses the same semantic structure and quality requirements,
but carries an explicit non-tailored purpose and does not claim relevance to the
Job Posting. No relevant evidence is a preparation outcome, not permission to
fabricate a Tailored Resume.

## Operation ownership

The Candidate Journey owns one current validated draft and its revision. The
section editor supplies proposed changes; it does not own a parallel document.
Preparation, section validation, layout measurement, and condensation are ports
behind the existing Candidate Journey. Their results refer to the revision and
input context on which the operation began. Machine nodes remain private.

A temporary condensation proposal is separate from the current draft. Proposing
does not replace it. Accepting requires the proposal's base revision to match the
current draft. Rejecting or failing preserves the draft. Editing, restoring,
changing the source, posting, or locale invalidates outstanding proposals and
measurements. Local contact changes also invalidate export eligibility. There is
no automatic merge or persistent draft history.

## Observable outcomes and recovery

Preparation returns a supported document, no relevant evidence, unsupported
content, or an unavailable operation. Validation returns a supported change or
affected unsupported fields. Failure preserves inputs and the last stable draft;
retry is explicit, with at most one automatic retry for a transient failure.
Interrupted operations restore as recoverable rather than apparently running.

Layout reports one page, two pages, overflow, or unavailable measurement for a
specific revision. Export eligibility also requires validated professional
content, a full name, and at least one contact method. Unknown layout is not a
successful layout check. Overflow never silently removes restored content or
reduces typography below the readable template. A condensation proposal that
still overflows can be reviewed, but cannot enable export.

Persist only browser-local Candidate Session data under the existing 24-hour
lifetime and deletion rules. An incompatible document schema increments the
session storage version; restoration discards it with the existing explicit
incompatibility notice rather than guessing a destructive migration.

## Shared public surface

Import operation types from `@resume-tailoring/application/candidate-journey` and
semantic document types from `@resume-tailoring/application/tailored-resume`.
`ResumeDocumentPorts` declares preparation, section validation, layout measurement,
and condensation. `ResumeProposalDecision` and `ResumeProposalDecisionOutcome`
are the acceptance/rejection boundary. These are contracts for the subsequent
issues, not working model, editing, condensation, or PDF implementations in BAK-56.

BAK-57 extends `startTailoredResumePreparation` and its observable preparation
outcome. BAK-58 adds `applyValidatedSectionChange`, `proposeResumeCondensation`,
`acceptResumeCondensation`, and `rejectResumeCondensation` to the same
`CandidateJourney`; BAK-59 supplies layout and export assessment. Do not expose
these as a separately instantiated coordinator. Success outcomes carry the
operation's revision; compare it with the current revision before publishing.
Revisions are opaque session-scoped tokens, renewed after every draft or input
change and never reused after deletion or regeneration. Accepting a proposal
allocates a new revision and invalidates the prior layout assessment. Rejection
retains the current revision. A stale accept returns `stale-result` and retains
the current draft.

The field editor uses semantic fields and stable identifiers. Candidate Journey
persists the editable draft, while proposals and layout assessments are transient.
Native printing requires an eligible assessment for the current draft revision;
validated PDF generation remains owned by BAK-59.

## Consumer fixtures and expectations

Import fixtures from `@resume-tailoring/application/structured-resume-fixtures`:

- `structuredResumeSource` retains the full evidence, including duplicate skills.
- `structuredResumeJobMatch` has relevant evidence; `groupedResumeDocument` is an
  independently specified valid document with two employers and grouped skills.
- `resumeSectionChangeExpectations` pairs a supported change and an unsupported
  claim with their expected validation outcomes. The unsupported example uses a
  real fact identifier deliberately: references alone do not establish support.
- `noRelevantEvidenceExpectation` requires the explicit normalized alternative.
- `resumeLayoutExpectations` pairs one-page, two-page, overflow, and unavailable
  measurements with export eligibility. These are deterministic port responses,
  not measured page counts for the reference document.

Consumers must additionally reject stale measurements/proposals, block unresolved
unsupported fields and missing required contacts, preserve the draft on failure
or rejection, and leave restored evidence intact during overflow. The prose
variant renders paragraphs; the prefactor emits `evidence-excerpts` until BAK-57
provides validated writing. Keep these expectations in each consumer's public
seam tests without importing machine internals or requiring production adapters.

## Combined preparation (BAK-57)

`startTailoredResumePreparation` accepts source and posting documents together,
an optional output locale, and an explicit normalized purpose. Omit the source
to reuse the current Source Profile. The browser adapter supplies the configured
writing and structured-validation roles through `createResumePreparation` and
the existing Language Model Gateway; a missing preparation port fails closed.

The session keeps a working preparation checkpoint separately from the last
validated document. `preparationPhase` announces extraction, matching, writing,
and validation. A checkpoint can be interrupted, awaiting a consequential
correction, failed, or awaiting the explicit normalized alternative. Correction
resumes preparation automatically; recovery after failure or reload is explicit.
`preparedResumeStatus` marks the stable document outdated after input changes,
while `preparedResumeRevision` identifies the last successfully published draft.
Only the local source contacts are attached after professional validation.

Preparation and persisted editing share the current draft contract. Regeneration
preserves attested evidence and local contacts, resets editing metadata on success,
and retains the stable edited draft on failure. BAK-59 owns validated layout/export.

## BAK-58 editing and recovery

The Candidate Journey now owns the edited document, unsupported field identities,
hidden content, and a fresh revision after each content change. The editor uses
`readView().resumeReview` and domain-named actions; React owns only the open panel
and unsaved input text. Version-seven sessions persist preparation alongside
optional editing metadata and section order. Interrupted validation
restores its saved unresolved fields, with no apparently running operation.

One transient proposal and layout assessment remain outside persisted session
data. Contacts, edits, restorations, source changes, posting changes, and
regeneration invalidate old results. Validation must echo the exact requested
section change. Accepting a proposal creates another current revision and requires
a new layout assessment; rejecting or failing never replaces the draft.

Explicitly attested additions retain a restoration destination alongside their
Candidate Fact. They remain recoverable after regeneration without keeping a
history of document versions. Hiding a parent experience does not discard its
individually hidden fields. The public recovery projection contains hidden
fields, hidden experiences, and omitted attested facts.

The browser production adapters implement semantic section validation and
writing-role condensation using the policy-bearing gateway. Identity and contact
values do not enter these professional operations. Condensation retains all
field identities and fact references, and validates both support and preservation
of meaning before exposing its proposal.

Layout remains a port supplied by BAK-59. With no measurement adapter, the review
reports unavailable layout and blocks export. BAK-58 tests use the shared
one-page, two-page, overflow, and unavailable fixtures; they do not represent
actual Chromium page measurements. Restoring content never invokes automatic
pruning or smaller typography. BAK-60 owns integrated PDF qualification.
