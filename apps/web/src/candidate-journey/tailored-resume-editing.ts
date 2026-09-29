import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import type {
  TailoredResume,
  TailoredResumeField,
  TailoredResumeSection,
} from '@resume-tailoring/application/tailored-resume'

export type ResumeFieldLocation = Readonly<
  | { kind: 'value-proposition'; fieldIndex: number }
  | { kind: 'experience'; experienceIndex: number; fieldIndex: number }
  | { kind: 'section'; section: TailoredResumeSection['section']; fieldIndex: number }
>

export type ResumeFieldReference = Readonly<{
  field: TailoredResumeField
  key: string
  location: ResumeFieldLocation
}>

export type HiddenResumeField = Readonly<{
  field: TailoredResumeField
  location: ResumeFieldLocation
}>

export function readResumeFields({ resume }: Readonly<{ resume: TailoredResume }>) {
  const valueProposition = resume.valueProposition.map((field, fieldIndex) =>
    createReference({ field, location: { kind: 'value-proposition', fieldIndex } }))
  const experiences = resume.experiences.flatMap((experience, experienceIndex) => experience.fields
    .map((field, fieldIndex) => createReference({
      field, location: { kind: 'experience', experienceIndex, fieldIndex },
    })))
  const sections = resume.sections.flatMap((section) => section.fields.map((field, fieldIndex) =>
    createReference({
      field, location: { kind: 'section', section: section.section, fieldIndex },
    })))
  return [...valueProposition, ...experiences, ...sections]
}

export function updateResumeField({ field, location, resume }: Readonly<{
  field: TailoredResumeField
  location: ResumeFieldLocation
  resume: TailoredResume
}>) {
  if (location.kind === 'value-proposition') {
    return { ...resume, valueProposition: replaceAt({
      items: resume.valueProposition, index: location.fieldIndex, value: field,
    }) }
  }
  if (location.kind === 'experience') {
    return { ...resume, experiences: resume.experiences.map((experience, experienceIndex) =>
      experienceIndex === location.experienceIndex ? { ...experience, fields: replaceAt({
        items: experience.fields, index: location.fieldIndex, value: field,
      }) } : experience) }
  }
  return { ...resume, sections: resume.sections.map((section) => section.section === location.section
    ? { ...section, fields: replaceAt({ items: section.fields, index: location.fieldIndex, value: field }) }
    : section) }
}

export function removeResumeField({ location, resume }: Readonly<{
  location: ResumeFieldLocation
  resume: TailoredResume
}>) {
  if (location.kind === 'value-proposition') {
    return { ...resume, valueProposition: removeAt({ items: resume.valueProposition, index: location.fieldIndex }) }
  }
  if (location.kind === 'experience') {
    return { ...resume, experiences: resume.experiences.map((experience, experienceIndex) =>
      experienceIndex === location.experienceIndex ? { ...experience, fields: removeAt({
        items: experience.fields, index: location.fieldIndex,
      }) } : experience) }
  }
  return { ...resume, sections: resume.sections.map((section) => section.section === location.section
    ? { ...section, fields: removeAt({ items: section.fields, index: location.fieldIndex }) }
    : section) }
}

export function restoreResumeField({ hiddenField, resume }: Readonly<{
  hiddenField: HiddenResumeField
  resume: TailoredResume
}>) {
  const { field, location } = hiddenField
  if (location.kind === 'value-proposition') {
    return { ...resume, valueProposition: [...resume.valueProposition, field] }
  }
  if (location.kind === 'experience') {
    return { ...resume, experiences: resume.experiences.map((experience, experienceIndex) =>
      experienceIndex === location.experienceIndex ? { ...experience, fields: [...experience.fields, field] } : experience) }
  }
  return { ...resume, sections: resume.sections.map((section) => section.section === location.section
    ? { ...section, fields: [...section.fields, field] } : section) }
}

export function moveResumeField({ direction, location, resume }: Readonly<{
  direction: 'up' | 'down'
  location: ResumeFieldLocation
  resume: TailoredResume
}>) {
  if (location.kind === 'value-proposition') {
    return { ...resume, valueProposition: moveAt({
      items: resume.valueProposition, index: location.fieldIndex, direction,
    }) }
  }
  if (location.kind === 'experience') {
    return { ...resume, experiences: resume.experiences.map((experience, experienceIndex) =>
      experienceIndex === location.experienceIndex ? { ...experience, fields: moveAt({
        items: experience.fields, index: location.fieldIndex, direction,
      }) } : experience) }
  }
  return { ...resume, sections: resume.sections.map((section) => section.section === location.section
    ? { ...section, fields: moveAt({ items: section.fields, index: location.fieldIndex, direction }) }
    : section) }
}

export function isSupportedResumeFieldText({ candidateFacts, field, text }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  field: TailoredResumeField
  text: string
}>) {
  const normalizedText = normalize(text)
  if (normalizedText.length === 0) return false
  if (normalize(field.text) === normalizedText) return true
  return candidateFacts.some(({ value }) => {
    const normalizedFact = normalize(value)
    return normalizedFact.includes(normalizedText) || normalizedText.includes(normalizedFact)
  })
}

function createReference({ field, location }: Readonly<{
  field: TailoredResumeField
  location: ResumeFieldLocation
}>): ResumeFieldReference {
  return { field, key: createFieldKey({ location }), location }
}

function createFieldKey({ location }: Readonly<{ location: ResumeFieldLocation }>) {
  return JSON.stringify(location)
}

function normalize(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
}

function replaceAt<TValue>({ index, items, value }: Readonly<{
  index: number
  items: readonly TValue[]
  value: TValue
}>) {
  return items.map((item, itemIndex) => itemIndex === index ? value : item)
}

function removeAt<TValue>({ index, items }: Readonly<{ index: number; items: readonly TValue[] }>) {
  return items.filter((item, itemIndex) => itemIndex !== index)
}

function moveAt<TValue>({ direction, index, items }: Readonly<{
  direction: 'up' | 'down'
  index: number
  items: readonly TValue[]
}>) {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const target = items[targetIndex]
  const source = items[index]
  if (source === undefined || target === undefined) return items
  return items.map((item, itemIndex) => itemIndex === index ? target
    : itemIndex === targetIndex ? source : item)
}
