import { readResumeRecovery } from './resume-recovery-view'
import type { PrivacySafeTelemetryEvent } from './privacy-safe-telemetry'
import type { CandidateSession } from '@resume-tailoring/domain/candidate-session'
import type { ResumeEditingState, TailoredResume, TailoredResumeField } from '@resume-tailoring/domain/tailored-resume'
import type { ProfessionalResumeDocument, ResumeDocumentReview,
  ResumeOperationFailure, ResumeSectionChange } from './structured-resume-contract'
import { assessResumeExport } from './resume-export'
import { readResumeFields, updateResumeField } from './resume-field-editing'
import type { CandidateFact } from '@resume-tailoring/domain/source-intake'
import type { ResumeClaimModelFailure, ResumeDocumentPorts } from './ports'
import { verifyResumeField } from './resume-claim-verification'

export type ResumeReview = ResumeDocumentReview & Readonly<{
  recovery: ReturnType<typeof readResumeRecovery>
  operation: 'validating-section' | 'condensing' | 'assessing-layout' | null
  unsupportedFieldIds: readonly string[]
  manuallyEdited: boolean
}>
export type ResumeReviewState = Pick<ResumeReview, 'proposal' | 'assessment' | 'failure' | 'operation'>
export const emptyResumeReview: ResumeReviewState = { proposal: null, assessment: null, failure: null, operation: null }
export type ResumeCorrectionKind = Extract<PrivacySafeTelemetryEvent, { name: 'resume-correction-recorded' }>['correctionKind']

export type ResumeEditingAccess = Readonly<{
  readReview: () => ResumeReview | null
  readSession: () => CandidateSession | null
  hasConsent: () => boolean
  createIdentifier: () => string
  ports: Partial<ResumeDocumentPorts>
  save: (request: Readonly<{ session: CandidateSession; baseRevision: string; correctionKind?: ResumeCorrectionKind }>) => void
  report: (request: Readonly<{ baseRevision: string; review: ResumeReviewState }>) => void
}>

export function readResumeEditing({ session }: Readonly<{ session: CandidateSession }>): ResumeEditingState {
  return session.resumeEditing ?? { revision: `${session.sessionId}:initial`, hiddenFields: [],
    manuallyEdited: false, unsupportedFieldIds: [] }
}

export function changedResumeSession({ session, document, revision, editing = readResumeEditing({ session }) }: Readonly<{
  session: CandidateSession; document: TailoredResume; revision: string; editing?: ResumeEditingState
}>): CandidateSession {
  return { ...session, tailoredResume: document,
    resumeEditing: { ...editing, manuallyEdited: true, revision } }
}

export function professionalDocument({ document }: Readonly<{ document: TailoredResume }>): ProfessionalResumeDocument {
  return { purpose: document.purpose, locale: document.locale, targetRole: document.targetRole,
    valueProposition: document.valueProposition, experiences: document.experiences, sections: document.sections,
    ...(document.sectionOrder === undefined ? {} : { sectionOrder: document.sectionOrder }),
    ...(document.headline === undefined ? {} : { headline: document.headline }) }
}

export function readResumeReview({ session, review }: Readonly<{
  session: CandidateSession; review: ResumeReviewState
}>): ResumeReview | null {
  if (session.tailoredResume === null) return null
  const editing = readResumeEditing({ session })
  const draft = { document: session.tailoredResume, revision: editing.revision }
  const presentIds = new Set(readResumeFields({ resume: session.tailoredResume }).map(({ field }) => field.id))
  const unsupportedFieldIds = editing.unsupportedFieldIds.filter((id) => presentIds.has(id))
  const currentReview = review.proposal !== null && review.proposal.baseRevision !== editing.revision ? emptyResumeReview : review
  const assessment = session.preparedResumeStatus !== 'outdated' && currentReview.assessment?.layout.revision === editing.revision ? currentReview.assessment : assessResumeExport({ draft, unsupportedFieldIds,
    layout: { status: 'unavailable', revision: editing.revision } })
  return { ...currentReview, draft, assessment, recovery: readResumeRecovery({ document: draft.document, editing, session }), manuallyEdited: editing.manuallyEdited,
    unsupportedFieldIds }
}

export function sectionChange({ document, section, baseRevision }: Readonly<{
  document: TailoredResume; section: ResumeSectionChange['section']; baseRevision: string
}>): ResumeSectionChange {
  if (section === 'value-proposition') return { section, baseRevision, replacement: document.valueProposition }
  if (section === 'experiences') return { section, baseRevision, replacement: document.experiences }
  const content = document.sections.find((entry) => entry.section === section)
  if (section === 'skills') return { section, baseRevision,
    replacement: content?.section === 'skills' ? content : { section: 'skills', groups: [] } }
  return { section, baseRevision, replacement: content !== undefined && content.section !== 'skills' ? content.fields : [] }
}

export function applySectionChange({ document, change }: Readonly<{
  document: TailoredResume; change: ResumeSectionChange
}>): TailoredResume {
  if (change.section === 'value-proposition') return { ...document, valueProposition: change.replacement }
  if (change.section === 'experiences') return { ...document, experiences: change.replacement }
  const replacement = change.section === 'skills' ? change.replacement : { section: change.section, fields: change.replacement }
  const sections = document.sections.some(({ section }) => section === change.section)
    ? document.sections.map((section) => section.section === change.section ? replacement : section)
    : [...document.sections, replacement]
  return { ...document, sections }
}

export async function editResumeField({ access, fieldId, text }: Readonly<{
  access: ResumeEditingAccess; fieldId: string; text: string
}>) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const reference = readResumeFields({ resume: session.tailoredResume }).find(({ field }) => field.id === fieldId)
  if (reference === undefined) return
  const document = updateResumeField({ resume: session.tailoredResume, location: reference.location,
    field: { ...reference.field, text } })
  const section = reference.location.kind === 'experience' ? 'experiences'
    : reference.location.kind === 'skill-group' ? 'skills'
      : reference.location.kind === 'section' ? reference.location.section : 'value-proposition'
  await applyValidatedSectionChange({ access, change: sectionChange({ document, section,
    baseRevision: readResumeEditing({ session }).revision }) })
}

export async function applyValidatedSectionChange({ access, change }: Readonly<{
  access: ResumeEditingAccess; change: ResumeSectionChange
}>) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const editing = readResumeEditing({ session })
  if (change.baseRevision !== editing.revision) { reportFailure({ access, baseRevision: editing.revision, failure: staleResumeResult }); return; }
  const prepared = prepareSectionEdit({ session, document: session.tailoredResume, change, revision: access.createIdentifier() })
  access.save({ session: prepared.next, baseRevision: editing.revision })
  if (prepared.changedFields.length === 0) return
  const revision = readResumeEditing({ session: prepared.next }).revision
  if (access.readReview()?.draft.revision !== revision) return
  if (!access.hasConsent()) { reportFailure({ access, baseRevision: revision, failure: consentRequired }); return }
  access.report({ baseRevision: revision, review: { ...emptyResumeReview, operation: 'validating-section' } })
  await validateChangedFields({ access, session: prepared.next, changedFields: prepared.changedFields, revision })
}

function prepareSectionEdit({ session, document, change, revision }: Readonly<{
  session: CandidateSession; document: TailoredResume; change: ResumeSectionChange; revision: string
}>) {
  const editing = readResumeEditing({ session })
  const previousDocument = readResumeFields({ resume: document }).reduce((currentDocument, reference) =>
    editing.unsupportedFieldIds.includes(reference.field.id) ? updateResumeField({ resume: currentDocument,
      location: reference.location, field: { ...reference.field, text: '' } }) : currentDocument, document)
  const changedFields = readChangedSectionFields({ document: previousDocument, change }).map(({ field }) => field)
  const unsupportedFieldIds = [...new Set([...editing.unsupportedFieldIds, ...changedFields.map(({ id }) => id)])]
  return { changedFields, next: changedResumeSession({ session, revision,
    document: applySectionChange({ document, change }), editing: { ...editing, unsupportedFieldIds } }) }
}

/** Only the fields whose value differs from the current draft are validated, each against its own attested facts. */
async function validateChangedFields({ access, session, changedFields, revision }: Readonly<{
  access: ResumeEditingAccess; session: CandidateSession; changedFields: readonly TailoredResumeField[]; revision: string
}>) {
  try {
    const result = await verifyChangedFields({ access, changedFields,
      candidateFacts: session.sourceIntake?.candidateFacts ?? [] })
    const current = access.readSession()
    if (current === null || readResumeEditing({ session: current }).revision !== revision) return
    if (result.status === 'failed') { reportFailure({ access, baseRevision: revision, failure: result }); return }
    const changedIds = changedFields.map(({ id }) => id)
    const editing = readResumeEditing({ session: current })
    access.save({ baseRevision: revision, session: { ...current, resumeEditing: { ...editing,
      unsupportedFieldIds: editing.unsupportedFieldIds.filter((id) => !changedIds.includes(id) || result.fieldIds.includes(id)) } } })
    if (result.fieldIds.length > 0) reportFailure({ access, baseRevision: revision, failure: unsupportedResumeResult })
  } catch { reportFailure({ access, baseRevision: revision, failure: unavailableResumeResult }) }
}

async function verifyChangedFields({ access, candidateFacts, changedFields }: Readonly<{
  access: ResumeEditingAccess; candidateFacts: readonly CandidateFact[]; changedFields: readonly TailoredResumeField[]
}>): Promise<Readonly<{ status: 'verified'; fieldIds: readonly string[] }> | ResumeOperationFailure> {
  const validateClaim = access.ports.validateClaim
  if (validateClaim === undefined) return unsupportedResumeResult
  const unsupportedFieldIds: string[] = []
  for (const field of changedFields) {
    const verification = await verifyResumeField({ models: { validateClaim }, candidateFacts, field })
    if (verification.status === 'failed') return readModelFailure({ error: verification.error })
    if (verification.status === 'unsupported') unsupportedFieldIds.push(field.id)
  }
  return { status: 'verified', fieldIds: unsupportedFieldIds }
}

function readChangedSectionFields({ document, change }: Readonly<{ document: TailoredResume; change: ResumeSectionChange }>) {
  const currentFields = readResumeFields({ resume: document })
  return readResumeFields({ resume: applySectionChange({ document, change }) }).filter(({ field }) =>
    !currentFields.some((current) => JSON.stringify(current.field) === JSON.stringify(field)))
}

export function readModelFailure({ error }: Readonly<{ error: ResumeClaimModelFailure }>): ResumeOperationFailure {
  return error === 'processing-consent-required' ? consentRequired : unavailableResumeResult
}

export function reportFailure({ access, baseRevision, failure }: Readonly<{
  access: ResumeEditingAccess; baseRevision: string; failure: ResumeOperationFailure
}>) { access.report({ baseRevision, review: { ...emptyResumeReview, failure } }) }

export const staleResumeResult = { status: 'failed', reason: 'stale-result', recovery: 'retry-current-draft' } as const
export const unsupportedResumeResult = { status: 'failed', reason: 'unsupported-content', recovery: 'correct-content' } as const
export const unavailableResumeResult = { status: 'failed', reason: 'unavailable', recovery: 'retry' } as const
export const consentRequired = { status: 'failed', reason: 'processing-consent-required', recovery: 'renew-consent' } as const
