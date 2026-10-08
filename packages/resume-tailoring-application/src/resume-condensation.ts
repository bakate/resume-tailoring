import type { CandidateFact } from '@resume-tailoring/domain/source-intake'
import { readCondensableResumeFields, replaceCondensableResumeFields } from '@resume-tailoring/domain/tailored-resume'
import type { TailoredResumeField } from '@resume-tailoring/domain/tailored-resume'
import type { ProfessionalResumeDocument, ResumeCondensationOutcome, ResumeDraft, ResumeLayoutOutcome,
  ResumeProposalDecision } from './structured-resume-contract'
import { condenseResumeField } from './resume-claim-verification'
import type { ResumeEditingAccess, ResumeReview } from './resume-editing'
import { changedResumeSession, consentRequired, professionalDocument, readModelFailure,
  reportFailure, staleResumeResult, unavailableResumeResult, unsupportedResumeResult } from './resume-editing'
import { assessResumeExport } from './resume-export'
import { readResumeFields } from './resume-field-editing'

export async function assessResumeLayout({ access, photoDataUrl }: Readonly<{ access: ResumeEditingAccess; photoDataUrl?: string }>) {
  const review = access.readReview()
  if (review === null) return
  access.report({ baseRevision: review.draft.revision, review: { ...review, operation: 'assessing-layout' } })
  const layout = await measureResume({ access, photoDataUrl, draft: review.draft, unsupportedFieldIds: review.unsupportedFieldIds })
  const current = access.readReview()
  if (current?.draft.revision !== review.draft.revision) return
  access.report({ baseRevision: current.draft.revision, review: { ...current, operation: null,
    assessment: assessResumeExport({ draft: current.draft, unsupportedFieldIds: current.unsupportedFieldIds, layout }) } })
}

async function measureResume({ access, draft, unsupportedFieldIds, photoDataUrl }: Readonly<{
  access: ResumeEditingAccess; draft: ResumeDraft; unsupportedFieldIds: readonly string[]; photoDataUrl?: string
}>): Promise<ResumeLayoutOutcome> {
  try {
    const result = await access.ports.assessLayout?.({ draft, unsupportedFieldIds, photoDataUrl })
    return result?.layout ?? { status: 'unavailable', revision: draft.revision }
  } catch { return { status: 'unavailable', revision: draft.revision } }
}

export async function proposeResumeCondensation({ access, photoDataUrl }: Readonly<{ access: ResumeEditingAccess; photoDataUrl?: string }>) {
  const review = access.readReview()
  const session = access.readSession()
  if (review === null || session === null || review.operation !== null) return
  const baseRevision = review.draft.revision
  if (!access.hasConsent()) { reportFailure({ access, baseRevision, failure: consentRequired }); return; }
  if (review.unsupportedFieldIds.length > 0) { reportFailure({ access, baseRevision, failure: unsupportedResumeResult }); return; }
  access.report({ baseRevision, review: { ...review, proposal: null, failure: null, operation: 'condensing' } })
  try {
    const result = await condenseDocument({ access, baseRevision, candidateFacts: session.sourceIntake?.candidateFacts ?? [],
      document: professionalDocument({ document: review.draft.document }) })
    if (access.readReview()?.draft.revision !== baseRevision) return
    if (result.status !== 'proposed') { reportFailure({ access, baseRevision, failure: result }); return; }
    await publishProposal({ access, review, proposal: result.proposal, photoDataUrl })
  } catch { reportFailure({ access, baseRevision, failure: unavailableResumeResult }) }
}

/** Shortens each condensable field on its own; one field that cannot be faithfully shortened rejects the proposal. */
async function condenseDocument({ access, baseRevision, candidateFacts, document }: Readonly<{
  access: ResumeEditingAccess; baseRevision: string; candidateFacts: readonly CandidateFact[]; document: ProfessionalResumeDocument
}>): Promise<ResumeCondensationOutcome> {
  const { validateClaim, condenseClaim } = access.ports
  if (validateClaim === undefined || condenseClaim === undefined) return unavailableResumeResult
  const replacements = new Map<string, TailoredResumeField>()
  for (const field of readCondensableResumeFields({ resume: document })) {
    const result = await condenseResumeField({ models: { validateClaim, condenseClaim }, candidateFacts, field,
      locale: document.locale })
    if (result.status === 'failed') return readModelFailure({ error: result.error })
    if (result.status === 'unsupported') return unsupportedResumeResult
    replacements.set(field.id, result.field)
  }
  return { status: 'proposed', proposal: { id: access.createIdentifier(), baseRevision,
    document: replaceCondensableResumeFields({ resume: document, replacements }),
    layout: { status: 'unavailable', revision: baseRevision } } }
}

async function publishProposal({ access, review, proposal, photoDataUrl }: Readonly<{
  access: ResumeEditingAccess; review: ResumeReview; proposal: NonNullable<ResumeReview['proposal']>; photoDataUrl?: string
}>) {
  const baseRevision = review.draft.revision
  if (proposal.baseRevision !== baseRevision) { reportFailure({ access, baseRevision, failure: staleResumeResult }); return; }
  const document = { ...proposal.document, identity: review.draft.document.identity, contactDetails: review.draft.document.contactDetails }
  const originalFields = readResumeFields({ resume: review.draft.document })
  const proposedFields = readResumeFields({ resume: document })
  if (originalFields.length !== proposedFields.length || originalFields.some(({ field }) =>
    !proposedFields.some((candidate) => candidate.field.id === field.id
      && JSON.stringify(candidate.field.factIds) === JSON.stringify(field.factIds)))) {
    reportFailure({ access, baseRevision, failure: unsupportedResumeResult }); return;
  }
  const layout = await measureResume({ access, photoDataUrl, draft: { document, revision: baseRevision }, unsupportedFieldIds: [] })
  if (access.readReview()?.draft.revision !== baseRevision) return
  access.report({ baseRevision, review: { ...review, operation: null, failure: null, proposal: { ...proposal, layout } } })
}

export function acceptResumeCondensation({ access, decision }: Readonly<{
  access: ResumeEditingAccess; decision: ResumeProposalDecision
}>) {
  const review = access.readReview()
  const session = access.readSession()
  if (review === null || session === null) return
  const proposal = review.proposal
  if (proposal?.id !== decision.proposalId || proposal.baseRevision !== decision.baseRevision
    || review.draft.revision !== decision.baseRevision) {
    reportFailure({ access, baseRevision: review.draft.revision, failure: staleResumeResult }); return;
  }
  const document = { ...proposal.document, identity: review.draft.document.identity, contactDetails: review.draft.document.contactDetails }
  access.save({ baseRevision: review.draft.revision, correctionKind: 'resume-claim-reformulation', session: changedResumeSession({ session, document, revision: access.createIdentifier() }) })
}

export function rejectResumeCondensation({ access, decision }: Readonly<{
  access: ResumeEditingAccess; decision: ResumeProposalDecision
}>) {
  const review = access.readReview()
  if (review === null || review.proposal?.id !== decision.proposalId || review.draft.revision !== decision.baseRevision) return
  access.report({ baseRevision: review.draft.revision, review: { ...review, proposal: null, failure: null, operation: null } })
}
