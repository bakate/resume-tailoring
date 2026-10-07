import type { CandidateSession } from '@resume-tailoring/domain/candidate-session'
import type { ResumeEditingState, TailoredResume } from './tailored-resume'
import { readExperienceFields } from './tailored-resume'
import { readResumeFields } from './resume-field-editing'

export function readResumeRecovery({ document, editing, session }: Readonly<{
  document: TailoredResume; editing: ResumeEditingState; session: CandidateSession
}>) {
  const hiddenExperiences = editing.hiddenExperiences ?? []
  const hiddenFields = editing.hiddenFields
  const retainedIds = new Set([...readResumeFields({ resume: document }).flatMap(({ field }) => field.factIds),
    ...hiddenFields.flatMap(({ field }) => field.factIds),
    ...hiddenExperiences.flatMap((experience) => readExperienceFields({ experience }).flatMap(({ factIds }) => factIds))])
  const omittedFacts = (session.sourceIntake?.candidateFacts ?? [])
    .filter(({ id, status }) => status === 'attested' && !retainedIds.has(id))
  return { hiddenExperiences, hiddenFields, omittedFacts, overflowReduction: readOverflowReduction({ editing }) }
}

/** How much Hidden Content Overflow Reduction produced, achievements apart, for the summary above the preview. */
function readOverflowReduction({ editing }: Readonly<{ editing: ResumeEditingState }>) {
  const reduced = editing.hiddenFields.filter(({ origin }) => origin === 'overflow-reduction')
  const achievements = reduced.filter(({ location }) => location.kind === 'experience' && location.fieldName === 'achievements').length
  return { achievements, other: reduced.length - achievements }
}
