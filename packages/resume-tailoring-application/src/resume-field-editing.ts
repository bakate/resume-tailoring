import type { CandidateFact } from './source-intake'
import type { TailoredResume, TailoredResumeExperience, TailoredResumeField, TailoredResumeSection } from './tailored-resume'

type ExperienceValue = Exclude<keyof TailoredResumeExperience, 'id' | 'chronology' | 'origin'>
import type { ResumeFieldLocation } from '@resume-tailoring/domain/tailored-resume'
export type { ResumeFieldLocation } from '@resume-tailoring/domain/tailored-resume'
export type ResumeFieldReference = Readonly<{
  field: TailoredResumeField
  key: string
  location: ResumeFieldLocation
}>
export type HiddenResumeField = Pick<ResumeFieldReference, 'field' | 'location'>

type FieldTransform = (fields: readonly TailoredResumeField[]) => readonly TailoredResumeField[]

export function readResumeFields({ resume }: Readonly<{ resume: TailoredResume }>) {
  return [
    ...resume.valueProposition.paragraphs.map((field) => createReference({
      field, location: { kind: 'value-proposition', fieldId: field.id },
    })),
    ...resume.experiences.flatMap((experience) => readExperienceReferences({ experience })),
    ...resume.sections.flatMap((section) => readSectionReferences({ section })),
  ]
}

function readSectionReferences({ section }: Readonly<{ section: TailoredResumeSection }>) {
  if (section.section !== 'skills') return section.fields.map((field) => createReference({
    field, location: { kind: 'section', section: section.section, fieldId: field.id },
  }))
  return section.groups.flatMap((group) => {
    const category = group.category === null ? [] : [createReference({ field: group.category,
      location: { kind: 'skill-group', groupId: group.id, fieldName: 'category', fieldId: group.category.id } })]
    return [...category, ...group.items.map((field) => createReference({ field,
      location: { kind: 'skill-group', groupId: group.id, fieldName: 'items', fieldId: field.id } }))]
  })
}

function readExperienceReferences({ experience }: Readonly<{ experience: TailoredResumeExperience }>) {
  return (['role', 'organization', 'startDate', 'endDate', 'location', 'context', 'achievements'] as const)
    .flatMap((fieldName) => {
      const fields = readExperienceValues({ experience, fieldName })
      return fields.map((field) => createReference({ field, location: {
        kind: 'experience', experienceId: experience.id, fieldName, fieldId: field.id,
      } }))
    })
}

export function updateResumeField({ field, location, resume }: Readonly<{
  field: TailoredResumeField; location: ResumeFieldLocation; resume: TailoredResume
}>) {
  return transformFields({ resume, location, transform: (fields) => fields.map((current) =>
    current.id === location.fieldId ? { ...field, id: current.id } : current) })
}

export function removeResumeField({ location, resume }: Readonly<{
  location: ResumeFieldLocation; resume: TailoredResume
}>) {
  return transformFields({ resume, location,
    transform: (fields) => fields.filter(({ id }) => id !== location.fieldId) })
}

export function restoreResumeField({ hiddenField, resume }: Readonly<{
  hiddenField: HiddenResumeField; resume: TailoredResume
}>) {
  return transformFields({ resume, location: hiddenField.location, transform: (fields) =>
    fields.some(({ id }) => id === hiddenField.field.id) ? fields : [...fields, hiddenField.field] })
}

export function moveResumeField({ direction, location, resume }: Readonly<{
  direction: 'up' | 'down'; location: ResumeFieldLocation; resume: TailoredResume
}>) {
  return transformFields({ resume, location, transform: (fields) => {
    const index = fields.findIndex(({ id }) => id === location.fieldId)
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const target = fields[targetIndex]
    const source = fields[index]
    if (source === undefined || target === undefined) return fields
    return fields.map((field, fieldIndex) => fieldIndex === index ? target
      : fieldIndex === targetIndex ? source : field)
  } })
}

function transformFields({ location, resume, transform }: Readonly<{
  location: ResumeFieldLocation; resume: TailoredResume; transform: FieldTransform
}>): TailoredResume {
  if (location.kind === 'value-proposition') {
    return { ...resume, valueProposition: { ...resume.valueProposition, paragraphs: transform(resume.valueProposition.paragraphs) } }
  }
  if (location.kind === 'experience') {
    return { ...resume, experiences: resume.experiences.map((experience) =>
      experience.id === location.experienceId ? transformExperience({ experience, location, transform }) : experience) }
  }
  if (location.kind === 'skill-group') return transformSkillGroup({ resume, location, transform })
  return { ...resume, sections: resume.sections.map((section) => section.section === location.section
    ? { ...section, fields: transform(section.fields) } : section) }
}

function transformSkillGroup({ resume, location, transform }: Readonly<{
  resume: TailoredResume; location: Extract<ResumeFieldLocation, { kind: 'skill-group' }>; transform: FieldTransform
}>): TailoredResume {
  return { ...resume, sections: resume.sections.map((section) => section.section !== 'skills' ? section
    : { ...section, groups: section.groups.map((group) => {
      if (group.id !== location.groupId) return group
      if (location.fieldName === 'items') return { ...group, items: transform(group.items) }
      const fields = group.category === null ? [] : [group.category]
      return { ...group, category: transform(fields)[0] ?? null }
    }) }) }
}

function transformExperience({ experience, location, transform }: Readonly<{
  experience: TailoredResumeExperience
  location: Extract<ResumeFieldLocation, { kind: 'experience' }>
  transform: FieldTransform
}>): TailoredResumeExperience {
  const fields = transform(readExperienceValues({ experience, fieldName: location.fieldName }))
  return location.fieldName === 'achievements' ? { ...experience, achievements: fields }
    : { ...experience, [location.fieldName]: fields[0] ?? null }
}

function readExperienceValues({ experience, fieldName }: Readonly<{
  experience: TailoredResumeExperience; fieldName: ExperienceValue
}>) {
  if (fieldName === 'achievements') return experience.achievements
  const field = experience[fieldName] ?? null
  return field === null ? [] : [field]
}

export function isSupportedResumeFieldText({ candidateFacts, field, text }: Readonly<{
  candidateFacts: readonly CandidateFact[]; field: TailoredResumeField; text: string
}>) {
  const normalizedText = normalize(text)
  if (normalizedText.length === 0) return false
  if (normalize(field.text) === normalizedText) return true
  return candidateFacts.some(({ value }) => {
    const normalizedFact = normalize(value)
    return normalizedFact === normalizedText
  })
}

function createReference({ field, location }: HiddenResumeField): ResumeFieldReference {
  return { field, key: field.id, location }
}

function normalize(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
}
