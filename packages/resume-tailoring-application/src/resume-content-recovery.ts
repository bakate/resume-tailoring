import type { CandidateSession } from '@resume-tailoring/domain/candidate-session'
import type { CandidateFact } from './source-intake'
import type { ResumeEditingState, ResumeFieldLocation, ResumeSectionName, TailoredResume } from './tailored-resume'
import { createTailoredResume } from './tailored-resume'
import { moveResumeField, readResumeFields, removeResumeField, restoreResumeField, updateResumeField } from './resume-field-editing'
import { changedResumeSession, readResumeEditing } from './resume-editing'
import type { ResumeEditingAccess } from './resume-editing'

type FieldRequest = Readonly<{ access: ResumeEditingAccess; fieldId: string }>

export function hideResumeContent({ access, fieldId }: FieldRequest) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const reference = readResumeFields({ resume: session.tailoredResume }).find(({ field }) => field.id === fieldId)
  if (reference === undefined) return
  const editing = readResumeEditing({ session })
  const document = removeResumeField({ resume: session.tailoredResume, location: reference.location })
  access.save({ baseRevision: editing.revision, correctionKind: 'resume-claim-removal', session: changedResumeSession({ session, document, revision: access.createIdentifier(),
    editing: { ...editing, hiddenFields: [...editing.hiddenFields, { field: reference.field, location: reference.location, origin: 'candidate' }] } }) })
}

/**
 * Hides the visible fields Overflow Reduction chose, tagged with their origin so the editor and the preview summary
 * can tell them from the Candidate's own choices. A field the Candidate restored is never hidden again.
 */
export function hideOverflowContent({ session, fieldIds, revision }: Readonly<{
  session: CandidateSession; fieldIds: readonly string[]; revision: string
}>): CandidateSession {
  if (session.tailoredResume === null) return session
  const editing = readResumeEditing({ session })
  const restoredFieldIds = new Set(editing.restoredFieldIds)
  const hidden = readResumeFields({ resume: session.tailoredResume })
    .filter(({ field }) => fieldIds.includes(field.id) && !restoredFieldIds.has(field.id))
  if (hidden.length === 0) return session
  const document = hidden.reduce((current, { location }) => removeResumeField({ resume: current, location }), session.tailoredResume)
  return { ...session, tailoredResume: document, resumeEditing: { ...editing, revision, hiddenFields: [...editing.hiddenFields,
    ...hidden.map(({ field, location }) => ({ field, location, origin: 'overflow-reduction' as const }))] } }
}

export function restoreResumeContent({ access, fieldId }: FieldRequest) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const editing = readResumeEditing({ session })
  const hiddenField = editing.hiddenFields.find(({ field }) => field.id === fieldId)
  if (hiddenField === undefined) return
  const parent = restoreHiddenParent({ session, document: session.tailoredResume, location: hiddenField.location })
  const document = restoreResumeField({ resume: parent.document, hiddenField })
  access.save({ baseRevision: editing.revision, session: changedResumeSession({ session, document, revision: access.createIdentifier(),
    editing: { ...parent.editing, hiddenFields: editing.hiddenFields.filter(({ field }) => field.id !== fieldId),
      restoredFieldIds: markRestored({ editing, fieldId }) } }) })
}

export function moveResumeContent({ access, fieldId, direction }: FieldRequest & Readonly<{ direction: 'up' | 'down' }>) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const reference = readResumeFields({ resume: session.tailoredResume }).find(({ field }) => field.id === fieldId)
  if (reference === undefined) return
  saveDocument({ access, session, correctionKind: 'resume-claim-reorder', document: moveResumeField({ resume: session.tailoredResume,
    location: reference.location, direction }) })
}

export function reorderResumeSections({ access, sectionOrder }: Readonly<{
  access: ResumeEditingAccess; sectionOrder: readonly ResumeSectionName[]
}>) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const sections = ['value-proposition', 'experiences', ...session.tailoredResume.sections.map(({ section }) => section)]
  if (new Set(sectionOrder).size !== sections.length || !sections.every((section) => sectionOrder.some((name) => name === section))) return
  saveDocument({ access, session, correctionKind: 'resume-claim-reorder', document: { ...session.tailoredResume, sectionOrder } })
}

export function attestResumeField({ access, fieldId }: FieldRequest) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null || session.sourceIntake === null) return
  const reference = readResumeFields({ resume: session.tailoredResume }).find(({ field }) => field.id === fieldId)
  if (reference === undefined || reference.field.text.trim().length === 0) return
  const fact: CandidateFact = { id: `source-fact-${access.createIdentifier()}`, path: `tailored-resume.${fieldId}`,
    status: 'attested', value: reference.field.text }
  const document = updateResumeField({ resume: session.tailoredResume, location: reference.location,
    field: { ...reference.field, factIds: [fact.id] } })
  const editing = readResumeEditing({ session })
  const next = changedResumeSession({ session, document, revision: access.createIdentifier(), editing: { ...editing,
    unsupportedFieldIds: editing.unsupportedFieldIds.filter((id) => id !== fieldId) } })
  access.save({ baseRevision: editing.revision, session: { ...next,
    resumeFactLocations: [...(session.resumeFactLocations ?? []), { factId: fact.id, location: reference.location }],
    sourceIntake: { ...session.sourceIntake, candidateFacts: [...session.sourceIntake.candidateFacts, fact] } } })
}

export function restoreSourceFact({ access, factId }: Readonly<{ access: ResumeEditingAccess; factId: CandidateFact['id'] }>) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null || session.sourceIntake === null || session.jobMatch === null) return
  const original = createTailoredResume({ sourceIntake: session.sourceIntake, jobMatch: session.jobMatch,
    locale: session.tailoredResume.locale })
  const reference = readSourceReference({ session, original, factId })
  if (reference === undefined) return
  const parent = restoreHiddenParent({ session, document: session.tailoredResume, location: reference.location })
  const container = ensureRestoreContainer({ document: parent.document, original, location: reference.location })
  const existing = readResumeFields({ resume: container }).some(({ field }) => field.id === reference.field.id)
  const document = existing ? updateResumeField({ resume: container, ...reference })
    : restoreResumeField({ resume: container, hiddenField: reference })
  access.save({ baseRevision: parent.editing.revision, session: changedResumeSession({ session, document, revision: access.createIdentifier(),
    editing: { ...parent.editing, hiddenFields: parent.editing.hiddenFields.filter(({ field }) => field.id !== reference.field.id),
      unsupportedFieldIds: parent.editing.unsupportedFieldIds.filter((id) => id !== reference.field.id),
      restoredFieldIds: markRestored({ editing: parent.editing, fieldId: reference.field.id }) } }) })
}

function markRestored({ editing, fieldId }: Readonly<{ editing: ResumeEditingState; fieldId: string }>) {
  return [...new Set([...editing.restoredFieldIds ?? [], fieldId])]
}

function ensureRestoreContainer({ document, original, location }: Readonly<{
  document: TailoredResume; original: TailoredResume; location: ReturnType<typeof readResumeFields>[number]['location']
}>): TailoredResume {
  if (location.kind === 'experience' && !document.experiences.some(({ id }) => id === location.experienceId)) {
    return { ...document, experiences: [...document.experiences, ...original.experiences.filter(({ id }) => id === location.experienceId)] }
  }
  if (location.kind === 'section' && !document.sections.some(({ section }) => section === location.section)) {
    return { ...document, sections: [...document.sections, { section: location.section, fields: [] }] }
  }
  if (location.kind !== 'skill-group') return document
  const originalSkills = original.sections.find(({ section }) => section === 'skills')
  const skills = document.sections.find(({ section }) => section === 'skills')
  const groups = skills?.section === 'skills' ? skills.groups : []
  if (groups.some(({ id }) => id === location.groupId) || originalSkills?.section !== 'skills') return document
  const replacement = { section: 'skills', groups: [...groups, ...originalSkills.groups.filter(({ id }) => id === location.groupId)] } as const
  return { ...document, sections: [...document.sections.filter(({ section }) => section !== 'skills'), replacement] }
}

function saveDocument({ access, session, document, correctionKind }: Readonly<{
  access: ResumeEditingAccess; session: CandidateSession; document: TailoredResume; correctionKind?: 'resume-claim-reorder'
}>) { access.save({ baseRevision: readResumeEditing({ session }).revision, correctionKind,
  session: changedResumeSession({ session, document, revision: access.createIdentifier() }) }) }

export function hideResumeEntry({ access, experienceId }: Readonly<{ access: ResumeEditingAccess; experienceId: string }>) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const experience = session.tailoredResume.experiences.find(({ id }) => id === experienceId)
  if (experience === undefined) return
  const editing = readResumeEditing({ session })
  const document = { ...session.tailoredResume,
    experiences: session.tailoredResume.experiences.filter(({ id }) => id !== experienceId) }
  access.save({ baseRevision: editing.revision, correctionKind: 'resume-claim-removal', session: changedResumeSession({ session, document, revision: access.createIdentifier(),
    editing: { ...editing, hiddenExperiences: [...(editing.hiddenExperiences ?? []), experience] } }) })
}

export function restoreResumeEntry({ access, experienceId }: Readonly<{ access: ResumeEditingAccess; experienceId: string }>) {
  const session = access.readSession()
  if (session?.tailoredResume === null || session === null) return
  const editing = readResumeEditing({ session })
  const experience = editing.hiddenExperiences?.find(({ id }) => id === experienceId)
  if (experience === undefined) return
  const document = { ...session.tailoredResume, experiences: [...session.tailoredResume.experiences, experience] }
  access.save({ baseRevision: editing.revision, session: changedResumeSession({ session, document, revision: access.createIdentifier(),
    editing: { ...editing, hiddenExperiences: editing.hiddenExperiences?.filter(({ id }) => id !== experienceId) } }) })
}

function readSourceReference({ session, original, factId }: Readonly<{
  session: CandidateSession; original: TailoredResume; factId: CandidateFact['id']
}>) {
  const addition = session.resumeFactLocations?.find((entry) => entry.factId === factId)
  const fact = session.sourceIntake?.candidateFacts.find((entry) => entry.id === factId && entry.status === 'attested')
  if (addition !== undefined && fact !== undefined) return { location: addition.location,
    field: { id: addition.location.fieldId, text: fact.value, factIds: [factId] } }
  return readResumeFields({ resume: original }).find(({ field, location }) =>
    location.kind !== 'value-proposition' && field.factIds.includes(factId))
}

function restoreHiddenParent({ session, document, location }: Readonly<{
  session: CandidateSession; document: TailoredResume
  location: ResumeFieldLocation
}>) {
  const editing = readResumeEditing({ session })
  const experience = location.kind === 'experience'
    ? editing.hiddenExperiences?.find(({ id }) => id === location.experienceId) : undefined
  if (experience === undefined) return { document, editing }
  return { document: { ...document, experiences: [...document.experiences, experience] },
    editing: { ...editing, hiddenExperiences: editing.hiddenExperiences?.filter(({ id }) => id !== experience.id) } }
}
