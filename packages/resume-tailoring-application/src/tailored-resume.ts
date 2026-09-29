import type { JobMatch } from '@resume-tailoring/domain/job-match'
import type { CandidateFact, SourceIntake, SourceProfileSection } from '@resume-tailoring/domain/source-intake'
import type {
  TailoredResume,
  TailoredResumeExperience,
  TailoredResumeField,
  TailoredResumeLocale,
  TailoredResumeSection,
} from '@resume-tailoring/domain/tailored-resume'

export type { TailoredResume, TailoredResumeExperience, TailoredResumeField, TailoredResumeLocale, TailoredResumeSection }

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
    contactDetails: sourceIntake.contactDetails.filter(({ kind }) => kind !== 'personal-information'),
    experiences: createExperiences({ facts: attestedFacts, relevantFactIds }),
    identity: sourceIntake.contactDetails.find(({ kind }) => kind === 'personal-information') ?? null,
    locale: locale ?? inferTailoredResumeLocale({ content: jobMatch.jobPosting.originalContent }),
    sections: createSections({ facts: attestedFacts }),
    targetRole: jobMatch.targetRole,
    valueProposition: createValueProposition({ facts: attestedFacts, relevantFactIds }),
  }
}

function createValueProposition({ facts, relevantFactIds }: Readonly<{
  facts: readonly CandidateFact[]
  relevantFactIds: ReadonlySet<string>
}>) {
  const relevantFacts = facts.filter(({ id }) => relevantFactIds.has(id))
  const remainingFacts = facts.filter(({ id }) => !relevantFactIds.has(id))
  return [...relevantFacts, ...remainingFacts].slice(0, 4).map(toField)
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
  return entries.map(({ entryFacts, relevant }, entryIndex) => ({
    chronology: relevant ? 'relevant' : entryIndex === contextExperienceIndex ? 'context' : 'earlier',
    fields: entryFacts.map(toField),
  }))
}

function createSections({ facts }: Readonly<{ facts: readonly CandidateFact[] }>) {
  return (['skills', 'education', 'languages', 'projects', 'certifications'] as const)
    .map((section) => createSection({ facts, section }))
}

function createSection({ facts, section }: Readonly<{
  facts: readonly CandidateFact[]
  section: Exclude<SourceProfileSection, 'experiences'>
}>): TailoredResumeSection {
  return { fields: facts.filter(({ path }) => path.startsWith(`${section}.`)).map(toField), section }
}

function groupFactsByEntry({ facts, section }: Readonly<{
  facts: readonly CandidateFact[]
  section: 'experiences'
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
  return { factIds: [id], text: value }
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
