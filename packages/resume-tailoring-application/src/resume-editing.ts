import { readResumeRecovery } from './resume-recovery-view'
import type { PrivacySafeTelemetryEvent } from './privacy-safe-telemetry'
import type { CandidateSession } from '@resume-tailoring/domain/candidate-session'
import type { ResumeEditingState, TailoredResume } from '@resume-tailoring/domain/tailored-resume'
import type { ProfessionalResumeDocument, ResumeDocumentPorts, ResumeDocumentReview,
  ResumeOperationFailure, ResumeSectionChange } from './structured-resume-contract'
import { assessResumeExport } from './resume-export'
import { readResumeFields, updateResumeField } from './resume-field-editing'

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
  ports: Partial<ResumeDocumentPorts>
  save: (request: Readonly<{ session: CandidateSession; baseRevision: string; correctionKind?: ResumeCorrectionKind }>) => void
  report: (request: Readonly<{ baseRevision: string; review: ResumeReviewState }>) => void
}>

export function readResumeEditing({ session }: Readonly<{ session: CandidateSession }>): ResumeEditingState {
  return session.resumeEditing ?? { revision: `${session.sessionId}:initial`, hiddenFields: [],
    manuallyEdited: false, unsupportedFieldIds: [] }
}

export function changedResumeSession({ session, document, editing = readResumeEditing({ session }) }: Readonly<{
  session: CandidateSession; document: TailoredResume; editing?: ResumeEditingState
}>): CandidateSession {
  return { ...session, tailoredResume: document,
    resumeEditing: { ...editing, manuallyEdited: true, revision: crypto.randomUUID() } }
}

export function professionalDocument({ document }: Readonly<{ document: TailoredResume }>): ProfessionalResumeDocument {
  return { purpose: document.purpose, locale: document.locale, targetRole: document.targetRole,
    valueProposition: document.valueProposition, experiences: document.experiences, sections: document.sections,
    ...(document.sectionOrder === undefined ? {} : { sectionOrder: document.sectionOrder }) }
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
  const prepared = prepareSectionEdit({ session, document: session.tailoredResume, change })
  access.save({ session: prepared.next, baseRevision: editing.revision })
  if (prepared.changedFieldIds.length === 0) return
  const revision = readResumeEditing({ session: prepared.next }).revision
  if (access.readReview()?.draft.revision !== revision) return
  if (!access.hasConsent()) { reportFailure({ access, baseRevision: revision, failure: consentRequired }); return }
  access.report({ baseRevision: revision, review: { ...emptyResumeReview, operation: 'validating-section' } })
  await validateChangedSection({ access, session: prepared.next, previousDocument: prepared.previousDocument, change, revision })
}

function prepareSectionEdit({ session, document, change }: Readonly<{
  session: CandidateSession; document: TailoredResume; change: ResumeSectionChange
}>) {
  const editing = readResumeEditing({ session })
  const previousDocument = readResumeFields({ resume: document }).reduce((currentDocument, reference) =>
    editing.unsupportedFieldIds.includes(reference.field.id) ? updateResumeField({ resume: currentDocument,
      location: reference.location, field: { ...reference.field, text: '' } }) : currentDocument, document)
  const changedFieldIds = readChangedSectionFields({ document: previousDocument, change }).map(({ field }) => field.id)
  const unsupportedFieldIds = [...new Set([...editing.unsupportedFieldIds, ...changedFieldIds])]
  return { previousDocument, changedFieldIds, next: changedResumeSession({ session,
    document: applySectionChange({ document, change }), editing: { ...editing, unsupportedFieldIds } }) }
}

async function validateChangedSection({ access, session, previousDocument, change, revision }: Readonly<{
  access: ResumeEditingAccess; session: CandidateSession; previousDocument: TailoredResume; change: ResumeSectionChange; revision: string
}>) {
  try {
    const result = await access.ports.validateSectionChange?.({ candidateFacts: session.sourceIntake?.candidateFacts ?? [],
      currentDocument: professionalDocument({ document: previousDocument }), change })
    const current = access.readSession()
    if (current === null || readResumeEditing({ session: current }).revision !== revision) return
    const changedIds = readChangedSectionFields({ document: previousDocument, change }).map(({ field }) => field.id)
    applySectionValidation({ access, current, change, revision, changedIds, result })
  } catch { reportFailure({ access, baseRevision: revision, failure: unavailableResumeResult }) }
}

function applySectionValidation({ access, current, change, revision, changedIds, result }: Readonly<{
  access: ResumeEditingAccess; current: CandidateSession; change: ResumeSectionChange; revision: string
  changedIds: readonly string[]; result: Awaited<ReturnType<ResumeDocumentPorts['validateSectionChange']>> | undefined
}>) {
  if (result?.status !== 'validated' && result?.status !== 'unsupported') {
    reportFailure({ access, baseRevision: revision, failure: result?.status === 'failed' ? result : unsupportedResumeResult }); return
  }
  const matchesRequest = result.status === 'validated' ? JSON.stringify(result.change) === JSON.stringify(change)
    : result.baseRevision === change.baseRevision && result.fieldIds.length > 0 && result.fieldIds.every((id) => changedIds.includes(id))
  if (!matchesRequest) { reportFailure({ access, baseRevision: revision, failure: staleResumeResult }); return }
  const rejectedIds = result.status === 'unsupported' ? result.fieldIds : []
  const editing = readResumeEditing({ session: current })
  access.save({ baseRevision: revision, session: { ...current, resumeEditing: { ...editing,
    unsupportedFieldIds: editing.unsupportedFieldIds.filter((id) => !changedIds.includes(id) || rejectedIds.includes(id)) } } })
  if (result.status === 'unsupported') reportFailure({ access, baseRevision: revision, failure: unsupportedResumeResult })
}

function readChangedSectionFields({ document, change }: Readonly<{ document: TailoredResume; change: ResumeSectionChange }>) {
  const currentFields = readResumeFields({ resume: document })
  return readResumeFields({ resume: applySectionChange({ document, change }) }).filter(({ field }) =>
    !currentFields.some((current) => JSON.stringify(current.field) === JSON.stringify(field)))
}

export function reportFailure({ access, baseRevision, failure }: Readonly<{
  access: ResumeEditingAccess; baseRevision: string; failure: ResumeOperationFailure
}>) { access.report({ baseRevision, review: { ...emptyResumeReview, failure } }) }

export const staleResumeResult = { status: 'failed', reason: 'stale-result', recovery: 'retry-current-draft' } as const
export const unsupportedResumeResult = { status: 'failed', reason: 'unsupported-content', recovery: 'correct-content' } as const
export const unavailableResumeResult = { status: 'failed', reason: 'unavailable', recovery: 'retry' } as const
export const consentRequired = { status: 'failed', reason: 'processing-consent-required', recovery: 'renew-consent' } as const
