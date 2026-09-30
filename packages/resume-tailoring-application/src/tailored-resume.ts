import type { JobMatch } from '@resume-tailoring/domain/job-match'
import type { CandidateFact, SourceIntake, SourceProfileSection } from '@resume-tailoring/domain/source-intake'
import type {
  TailoredResume,
  TailoredResumeExperience,
  TailoredResumeField,
  TailoredResumeLocale,
  TailoredResumeSection,
  TailoredResumeSkillGroup,
} from '@resume-tailoring/domain/tailored-resume'

export type { TailoredResume, TailoredResumeExperience, TailoredResumeField, TailoredResumeLocale, TailoredResumeSection, TailoredResumeSkillGroup }

export function createTailoredResume({
  jobMatch,
  locale,
  sourceIntake,
}: Readonly<{
  jobMatch: JobMatch
  locale?: TailoredResumeLocale
  sourceIntake: SourceIntake
}>): TailoredResume {
  const attestedFacts = sourceIntake.candidateFacts.filter(({ status }) => status === 'attested')
  const relevantFactIds = new Set(jobMatch.analysis.relevantFactIds)
  return createTailoredResumeValue({ attestedFacts, jobMatch, locale, relevantFactIds, sourceIntake })
}

function createTailoredResumeValue({ attestedFacts, jobMatch, locale, relevantFactIds, sourceIntake }: Readonly<{
  attestedFacts: readonly CandidateFact[]
  jobMatch: JobMatch
  locale: TailoredResumeLocale | undefined
  relevantFactIds: ReadonlySet<string>
  sourceIntake: SourceIntake
}>): TailoredResume {
  return {
    purpose: 'tailored',
    contactDetails: sourceIntake.contactDetails.filter(({ kind }) => kind !== 'personal-information'),
    experiences: createExperiences({ facts: attestedFacts, relevantFactIds }),
    identity: sourceIntake.contactDetails.find(({ kind }) => kind === 'personal-information') ?? null,
    locale: locale ?? inferTailoredResumeLocale({ content: jobMatch.jobPosting.originalContent }),
    sections: createSections({ facts: attestedFacts }),
    targetRole: jobMatch.targetRole,
    valueProposition: { kind: 'evidence-excerpts',
      paragraphs: createValueProposition({ facts: attestedFacts, relevantFactIds }) },
  }
}

function createValueProposition({ facts, relevantFactIds }: Readonly<{
  facts: readonly CandidateFact[]
  relevantFactIds: ReadonlySet<string>
}>) {
  const summaryFacts = facts.filter(({ path }) => !['role', 'organization', 'startDate', 'endDate', 'category']
    .includes(path.split('.')[2] ?? ''))
  const relevantFacts = summaryFacts.filter(({ id }) => relevantFactIds.has(id))
  const remainingFacts = summaryFacts.filter(({ id }) => !relevantFactIds.has(id))
  return [...relevantFacts, ...remainingFacts].slice(0, 4).map((fact) => ({
    ...toField(fact), id: `summary-${fact.id}`,
  }))
}

function createExperiences({ facts, relevantFactIds }: Readonly<{
  facts: readonly CandidateFact[]
  relevantFactIds: ReadonlySet<string>
}>): readonly TailoredResumeExperience[] {
  const entries = [...groupFactsByEntry({ facts, section: 'experiences' }).entries()]
    .map(([entryIndex, entryFacts]) => ({ entryIndex, entryFacts,
      relevant: entryFacts.some(({ id }) => relevantFactIds.has(id)) }))
    .sort((leftEntry, rightEntry) => Number(rightEntry.relevant) - Number(leftEntry.relevant)
      || leftEntry.entryIndex - rightEntry.entryIndex)
  const contextExperienceIndex = entries.findIndex(({ relevant }) => !relevant)
  return entries.map(({ entryFacts, relevant, entryIndex: sourceIndex }, entryIndex) => ({
    chronology: relevant ? 'relevant' : entryIndex === contextExperienceIndex ? 'context' : 'earlier',
    id: `experiences.${String(sourceIndex)}`,
    ...readExperienceValues({ facts: entryFacts }),
  }))
}

function readExperienceValues({ facts }: Readonly<{ facts: readonly CandidateFact[] }>) {
  const readValue = (name: string) => {
    const fact = facts.find(({ path }) => path.split('.')[2] === name)
    return fact === undefined ? null : toField(fact)
  }
  return {
    role: readValue('role'), organization: readValue('organization'),
    startDate: readValue('startDate'), endDate: readValue('endDate'), context: readValue('context'),
    achievements: facts.filter(({ path }) => ['achievements', 'candidate-enrichment']
      .includes(path.split('.')[2] ?? '')).map(toField),
  }
}

export function readExperienceFields({ experience }: Readonly<{ experience: TailoredResumeExperience }>) {
  return [experience.role, experience.organization, experience.startDate, experience.endDate,
    experience.context, ...experience.achievements].filter((field) => field !== null)
}

function createSections({ facts }: Readonly<{ facts: readonly CandidateFact[] }>) {
  return (['skills', 'education', 'languages', 'projects', 'certifications'] as const)
    .map((section) => createSection({ facts, section }))
}

function createSection({ facts, section }: Readonly<{
  facts: readonly CandidateFact[]
  section: Exclude<SourceProfileSection, 'experiences'>
}>): TailoredResumeSection {
  if (section === 'skills') return { section, groups: createSkillGroups({ facts }) }
  return { fields: facts.filter(({ path }) => path.startsWith(`${section}.`)).map(toField), section }
}

function createSkillGroups({ facts }: Readonly<{ facts: readonly CandidateFact[] }>) {
  const groups = new Map<string, TailoredResumeSkillGroup>()
  for (const [entryIndex, entryFacts] of groupFactsByEntry({ facts, section: 'skills' })) {
    const categoryFact = entryFacts.find(({ path }) => path.split('.')[2] === 'category')
    const category = categoryFact === undefined ? null : toField(categoryFact)
    const key = category?.text.trim().toLocaleLowerCase() ?? ''
    const previous = groups.get(key)
    const items = entryFacts.filter(({ path }) => path.split('.')[2] !== 'category').map(toField)
    groups.set(key, { id: previous?.id ?? `skills.${String(entryIndex)}`,
      category: mergeCategory({ previous: previous?.category ?? null, category }),
      items: deduplicateFields({ fields: [...(previous?.items ?? []), ...items] }),
    })
  }
  return [...groups.values()].filter(({ items }) => items.length > 0)
}

function mergeCategory({ previous, category }: Readonly<{
  previous: TailoredResumeField | null; category: TailoredResumeField | null
}>) {
  if (previous === null) return category
  return category === null ? previous : { ...previous, factIds: [...new Set([...previous.factIds, ...category.factIds])] }
}

function deduplicateFields({ fields }: Readonly<{ fields: readonly TailoredResumeField[] }>) {
  const unique = new Map<string, TailoredResumeField>()
  for (const field of fields) {
    const key = field.text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
    const previous = unique.get(key)
    unique.set(key, previous === undefined ? field : {
      ...previous, factIds: [...new Set([...previous.factIds, ...field.factIds])],
    })
  }
  return [...unique.values()]
}

export function readSectionFields({ section }: Readonly<{ section: TailoredResumeSection }>) {
  return section.section === 'skills' ? section.groups.flatMap(({ category, items }) =>
    category === null ? items : [category, ...items]) : section.fields
}

function groupFactsByEntry({ facts, section }: Readonly<{
  facts: readonly CandidateFact[]
  section: 'experiences' | 'skills'
}>) {
  const groups = new Map<number, readonly CandidateFact[]>()
  for (const fact of facts.filter(({ path }) => path.startsWith(`${section}.`))) {
    const entryIndex = readEntryIndex({ path: fact.path })
    if (entryIndex === null) continue
    const entryFacts = groups.get(entryIndex) ?? []
    groups.set(entryIndex, [...entryFacts, fact])
  }
  return groups
}

function readEntryIndex({ path }: Readonly<{ path: string }>) {
  const [, entryIndexText] = path.split('.')
  const entryIndex = Number(entryIndexText)
  return Number.isInteger(entryIndex) && entryIndex >= 0 ? entryIndex : null
}

function toField({ id, value }: CandidateFact): TailoredResumeField {
  return { id, factIds: [id], text: value }
}

function inferTailoredResumeLocale({ content }: Readonly<{ content: string }>): TailoredResumeLocale {
  const normalizedContent = content.toLocaleLowerCase('fr')
  const words = normalizedContent.match(/\p{Letter}+/gu) ?? []
  const frenchScore = words.filter((word) => frenchWords.has(word)).length
    + (normalizedContent.match(/[àâçéèêëîïôùûüÿœ]/gu)?.length ?? 0)
  const englishScore = words.filter((word) => englishWords.has(word)).length
  return frenchScore > englishScore ? 'fr' : 'en'
}

const frenchWords: ReadonlySet<string> = new Set(['avec', 'compétences', 'conception', 'dans', 'développeur', 'expérience', 'missions', 'poste', 'pour'])
const englishWords: ReadonlySet<string> = new Set(['and', 'developer', 'experience', 'for', 'requirements', 'role', 'skills', 'with'])

export type { ResumeEditingState, ResumeFieldLocation, ResumeSectionName } from '@resume-tailoring/domain/tailored-resume'

export { isSupportedResumeFieldText, moveResumeField, readResumeFields, removeResumeField, restoreResumeField, updateResumeField } from './resume-field-editing'
export type { HiddenResumeField, ResumeFieldReference } from './resume-field-editing'
