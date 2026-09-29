import type { TargetRole } from './job-match'
import type { CandidateFactId, LocalContactDetail, SourceProfileSection } from './source-intake'

export type TailoredResumeLocale = 'en' | 'fr'

export type TailoredResumeField = Readonly<{
  factIds: readonly CandidateFactId[]
  text: string
}>

export type TailoredResumeExperience = Readonly<{
  chronology: 'context' | 'earlier' | 'relevant'
  fields: readonly TailoredResumeField[]
}>

export type TailoredResumeSection = Readonly<{
  fields: readonly TailoredResumeField[]
  section: Exclude<SourceProfileSection, 'experiences'>
}>

export type TailoredResume = Readonly<{
  contactDetails: readonly LocalContactDetail[]
  experiences: readonly TailoredResumeExperience[]
  identity: LocalContactDetail | null
  locale: TailoredResumeLocale
  sections: readonly TailoredResumeSection[]
  targetRole: TargetRole | null
  valueProposition: readonly TailoredResumeField[]
}>
