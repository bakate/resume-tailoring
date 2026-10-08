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
  /** Shown at the end of the dates line; absent from resumes prepared before it existed. */
  location?: TailoredResumeField | null
  context: TailoredResumeField | null
  achievements: readonly TailoredResumeField[]
  /**
   * `copied-from-source` marks an experience taken word for word from its Candidate Facts after its rewrite still
   * failed, kept through editing and condensation; absent when the experience was written.
   */
  origin?: 'copied-from-source'
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

/** The Candidate name shown on the resume; `detected` marks a value read locally from the source, not yet edited. */
export type ResumeIdentity = LocalContactDetail & Readonly<{ origin?: 'detected' }>

export type TailoredResume = Readonly<{
  sectionOrder?: readonly ResumeSectionName[]
  purpose: 'tailored' | 'normalized'
  contactDetails: readonly LocalContactDetail[]
  experiences: readonly TailoredResumeExperience[]
  identity: ResumeIdentity | null
  locale: TailoredResumeLocale
  sections: readonly TailoredResumeSection[]
  targetRole: TargetRole | null
  valueProposition: Readonly<{
    kind: 'evidence-excerpts' | 'prose'
    paragraphs: readonly TailoredResumeField[]
  }>
}>

type CondensableResume = Pick<TailoredResume, 'valueProposition' | 'experiences'>

/**
 * The prose a two-page condensation may shorten: Value Proposition paragraphs and each experience's context and
 * achievements. Roles, organizations, dates, locations and every other section keep their exact wording.
 */
export function readCondensableResumeFields({ resume }: Readonly<{ resume: CondensableResume }>): readonly TailoredResumeField[] {
  return [...resume.valueProposition.paragraphs, ...resume.experiences.flatMap(({ context, achievements }) =>
    context === null ? achievements : [context, ...achievements])]
}

/** Replaces condensable prose by field identity, leaving every other value and the document structure unchanged. */
export function replaceCondensableResumeFields<TResume extends CondensableResume>({ resume, replacements }: Readonly<{
  resume: TResume; replacements: ReadonlyMap<string, TailoredResumeField>
}>): TResume {
  const replace = (field: TailoredResumeField) => replacements.get(field.id) ?? field
  return { ...resume,
    valueProposition: { ...resume.valueProposition, paragraphs: resume.valueProposition.paragraphs.map(replace) },
    experiences: resume.experiences.map((experience) => ({ ...experience,
      context: experience.context === null ? null : replace(experience.context),
      achievements: experience.achievements.map(replace),
    })),
  }
}

export type ResumeSectionName ='value-proposition' | 'experiences' | TailoredResumeSection['section']

export const resumeSectionKinds = ['value-proposition', 'experience', 'skills', 'education', 'languages',
  'projects', 'certifications'] as const
export type ResumeSectionKind = typeof resumeSectionKinds[number]
type FieldSectionKind = Exclude<ResumeSectionKind, 'value-proposition' | 'experience' | 'skills'>

export type ResumeSectionContent =
  | Readonly<{ kind: 'value-proposition'; paragraphs: readonly TailoredResumeField[] }>
  | Readonly<{ kind: 'experience'; experience: TailoredResumeExperience }>
  | Readonly<{ kind: 'skills'; groups: readonly TailoredResumeSkillGroup[] }>
  | Readonly<{ kind: FieldSectionKind; fields: readonly TailoredResumeField[] }>

/** Who hid a piece of Hidden Content: the Candidate in the editor, or Overflow Reduction fitting the Page Budget. */
export const hiddenContentOrigins = ['candidate', 'overflow-reduction'] as const
export type HiddenContentOrigin = typeof hiddenContentOrigins[number]

export type ResumeEditingState = Readonly<{
  revision: string
  unsupportedFieldIds: readonly string[]
  manuallyEdited: boolean
  /** Only the Candidate hides a whole experience: Overflow Reduction never removes one. */
  hiddenExperiences?: readonly TailoredResumeExperience[]
  hiddenFields: readonly Readonly<{ field: TailoredResumeField; location: ResumeFieldLocation; origin: HiddenContentOrigin }>[]
  /** Fields the Candidate restored, which a later Overflow Reduction never hides again. */
  restoredFieldIds?: readonly string[]
}>

type ExperienceValue = Exclude<keyof TailoredResumeExperience, 'id' | 'chronology' | 'origin'>
export type ResumeFieldLocation = Readonly<
  | { kind: 'value-proposition'; fieldId: string }
  | { kind: 'experience'; experienceId: string; fieldName: ExperienceValue; fieldId: string }
  | { kind: 'section'; section: Exclude<TailoredResumeSection['section'], 'skills'>; fieldId: string }
  | { kind: 'skill-group'; groupId: string; fieldName: 'category' | 'items'; fieldId: string }
>
