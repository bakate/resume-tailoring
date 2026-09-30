import type { ResumeDraft, ResumeLayoutOutcome, ResumeProposalDecision } from './structured-resume-contract'
import type { ResumeEditingAccess, ResumeReview } from './resume-editing'
import { assessEligibility, changedResumeSession, consentRequired, professionalDocument,
  reportFailure, staleResumeResult, unavailableResumeResult, unsupportedResumeResult } from './resume-editing'
import { readResumeFields } from './resume-field-editing'

export async function assessResumeLayout({ access }: Readonly<{ access: ResumeEditingAccess }>) {
  const review = access.readReview()
  if (review === null) return
  access.report({ baseRevision: review.draft.revision, review: { ...review, operation: 'assessing-layout' } })
  const layout = await measureResume({ access, draft: review.draft, unsupportedFieldIds: review.unsupportedFieldIds })
  const current = access.readReview()
  if (current?.draft.revision !== review.draft.revision) return
  access.report({ baseRevision: current.draft.revision, review: { ...current, operation: null,
    assessment: assessEligibility({ ...current.draft, unsupportedFieldIds: current.unsupportedFieldIds, layout }) } })
}

async function measureResume({ access, draft, unsupportedFieldIds }: Readonly<{
  access: ResumeEditingAccess; draft: ResumeDraft; unsupportedFieldIds: readonly string[]
}>): Promise<ResumeLayoutOutcome> {
  try {
    const result = await access.ports.assessLayout?.({ draft, unsupportedFieldIds })
    return result?.layout ?? { status: 'unavailable', revision: draft.revision }
  } catch { return { status: 'unavailable', revision: draft.revision } }
}

export async function proposeResumeCondensation({ access }: Readonly<{ access: ResumeEditingAccess }>) {
  const review = access.readReview()
  const session = access.readSession()
  if (review === null || session === null || review.operation !== null) return
  const baseRevision = review.draft.revision
  if (!access.hasConsent()) { reportFailure({ access, baseRevision, failure: consentRequired }); return; }
  if (review.unsupportedFieldIds.length > 0) { reportFailure({ access, baseRevision, failure: unsupportedResumeResult }); return; }
  access.report({ baseRevision, review: { ...review, proposal: null, failure: null, operation: 'condensing' } })
  try {
    const result = await access.ports.proposeCondensation?.({ baseRevision,
      candidateFacts: session.sourceIntake?.candidateFacts ?? [], maximumPages: 2,
      document: professionalDocument({ document: review.draft.document }) })
    if (access.readReview()?.draft.revision !== baseRevision) return
    if (result?.status !== 'proposed') { reportFailure({ access, baseRevision,
      failure: result?.status === 'failed' ? result : unavailableResumeResult }); return; }
    await publishProposal({ access, review, proposal: result.proposal })
  } catch { reportFailure({ access, baseRevision, failure: unavailableResumeResult }) }
}

async function publishProposal({ access, review, proposal }: Readonly<{
  access: ResumeEditingAccess; review: ResumeReview; proposal: NonNullable<ResumeReview['proposal']>
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
  const layout = await measureResume({ access, draft: { document, revision: baseRevision }, unsupportedFieldIds: [] })
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
  access.save({ baseRevision: review.draft.revision, correctionKind: 'resume-claim-reformulation', session: changedResumeSession({ session, document }) })
}

export function rejectResumeCondensation({ access, decision }: Readonly<{
  access: ResumeEditingAccess; decision: ResumeProposalDecision
}>) {
  const review = access.readReview()
  if (review === null || review.proposal?.id !== decision.proposalId || review.draft.revision !== decision.baseRevision) return
  access.report({ baseRevision: review.draft.revision, review: { ...review, proposal: null, failure: null, operation: null } })
}
