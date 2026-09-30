import type { TargetRole } from './job-match'
import type { CandidateFactId, LocalContactDetail, SourceProfileSection } from './source-intake'

export type TailoredResumeLocale = 'en' | 'fr'

export type TailoredResumeField = Readonly<{
  id: string
  factIds: readonly CandidateFactId[]
  text: string
}>

export type TailoredResumeExperience = Readonly<{
  id: string
  chronology: 'context' | 'earlier' | 'relevant'
  role: TailoredResumeField | null
  organization: TailoredResumeField | null
  startDate: TailoredResumeField | null
  endDate: TailoredResumeField | null
  context: TailoredResumeField | null
  achievements: readonly TailoredResumeField[]
}>

export type TailoredResumeSkillGroup = Readonly<{
  id: string
  category: TailoredResumeField | null
  items: readonly TailoredResumeField[]
}>

export type TailoredResumeSection = Readonly<{
  section: 'skills'
  groups: readonly TailoredResumeSkillGroup[]
}> | Readonly<{
  fields: readonly TailoredResumeField[]
  section: Exclude<SourceProfileSection, 'experiences' | 'skills'>
}>

export type TailoredResume = Readonly<{
  sectionOrder?: readonly ResumeSectionName[]
  purpose: 'tailored' | 'normalized'
  contactDetails: readonly LocalContactDetail[]
  experiences: readonly TailoredResumeExperience[]
  identity: LocalContactDetail | null
  locale: TailoredResumeLocale
  sections: readonly TailoredResumeSection[]
  targetRole: TargetRole | null
  valueProposition: Readonly<{
    kind: 'evidence-excerpts' | 'prose'
    paragraphs: readonly TailoredResumeField[]
  }>
}>

export type ResumeSectionName = 'value-proposition' | 'experiences' | TailoredResumeSection['section']

export type ResumeEditingState = Readonly<{
  revision: string
  unsupportedFieldIds: readonly string[]
  manuallyEdited: boolean
  hiddenExperiences?: readonly TailoredResumeExperience[]
  hiddenFields: readonly Readonly<{ field: TailoredResumeField; location: ResumeFieldLocation }>[]
}>

type ExperienceValue = Exclude<keyof TailoredResumeExperience, 'id' | 'chronology'>
export type ResumeFieldLocation = Readonly<
  | { kind: 'value-proposition'; fieldId: string }
  | { kind: 'experience'; experienceId: string; fieldName: ExperienceValue; fieldId: string }
  | { kind: 'section'; section: Exclude<TailoredResumeSection['section'], 'skills'>; fieldId: string }
  | { kind: 'skill-group'; groupId: string; fieldName: 'category' | 'items'; fieldId: string }
>
