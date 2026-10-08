import type { CandidateFact as EngineCandidateFact } from '@resume-tailoring/matching-engine'
import type { CandidateFact, CandidateFactId } from '@resume-tailoring/domain/source-intake'
import { countCoveredMonths, readExperienceMonthSpan } from './experience-chronology'

/** A Derived Fact for the matcher, with the Candidate Facts it was calculated from, which stand in for it afterwards. */
export type SkillDuration = Readonly<{ fact: EngineCandidateFact; sourceFactIds: readonly CandidateFactId[] }>

/**
 * One Derived Fact per listed skill that dated experiences mention: the months those experiences cover together, each
 * month counted once. A model never combines date ranges, so a duration requirement such as "3 years of React" can
 * only be proven by a fact that states the duration; this one is calculated, never estimated. An experience without
 * a usable start and end counts for nothing, and a skill no dated experience mentions gets no duration.
 */
export function deriveSkillDurations({ candidateFacts, today }: Readonly<{
  candidateFacts: readonly CandidateFact[]; today: number
}>): readonly SkillDuration[] {
  const attested = candidateFacts.filter(({ status, value }) => status === 'attested' && value.trim().length > 0)
  const experiences = readDatedExperiences({ facts: attested, today })
  const skills = readSkills({ facts: attested })
  return skills.flatMap(({ name, factIds }, index): SkillDuration[] => {
    const term = normalizeTerm(name)
    // "React Native" is not a mention of React when both are listed.
    const longerTerms = skills.map((skill) => normalizeTerm(skill.name))
      .filter((other) => other !== term && ` ${other} `.includes(` ${term} `))
    const mentionsSkill = (value: string) => longerTerms
      .reduce((text, other) => text.replaceAll(` ${other} `, ' | '), ` ${normalizeTerm(value)} `).includes(` ${term} `)
    const mentioning = experiences.flatMap((experience) => {
      const mentions = experience.textFacts.filter(({ value }) => mentionsSkill(value))
      return mentions.length === 0 ? [] : [{ ...experience, mentions }]
    })
    if (term.length === 0 || mentioning.length === 0) return []
    const months = countCoveredMonths({ spans: mentioning.map(({ span }) => span) })
    return [{
      fact: { id: `source-fact-derived-skill-duration-${String(index)}`, kind: 'experience',
        value: `${name}: ${String(months)} months of dated experience` },
      sourceFactIds: [...factIds, ...mentioning.flatMap(({ dateFactIds, mentions }) => [...mentions.map(({ id }) => id), ...dateFactIds])],
    }]
  })
}

/** Replaces each Derived Fact identifier by the Candidate Facts it was calculated from, once each. */
export function replaceDerivedFactIds({ factIds, durations }: Readonly<{
  factIds: readonly string[]; durations: readonly SkillDuration[]
}>): readonly string[] {
  return [...new Set(factIds.flatMap((factId): readonly string[] =>
    durations.find(({ fact }) => fact.id === factId)?.sourceFactIds ?? [factId]))]
}

/** Each distinct skill name, with every skill fact that lists it. */
function readSkills({ facts }: Readonly<{ facts: readonly CandidateFact[] }>) {
  const skills = new Map<string, { name: string; factIds: CandidateFactId[] }>()
  for (const { id, value } of facts.filter(({ path }) => /^skills\.\d+\.name\./u.test(path))) {
    const key = normalizeTerm(value)
    const skill = skills.get(key) ?? { name: value.trim(), factIds: [] }
    skill.factIds.push(id)
    skills.set(key, skill)
  }
  return [...skills.values()]
}

function readDatedExperiences({ facts, today }: Readonly<{ facts: readonly CandidateFact[]; today: number }>) {
  const indexes = [...new Set(facts.flatMap(({ path }) => /^experiences\.(\d+)\./u.exec(path)?.[1] ?? []))]
  return indexes.flatMap((index) => {
    const own = facts.filter(({ path }) => path.startsWith(`experiences.${index}.`))
    const date = (name: 'startDate' | 'endDate') => own.find(({ path }) => path.startsWith(`experiences.${index}.${name}.`))
    const [start, end] = [date('startDate'), date('endDate')]
    const span = readExperienceMonthSpan({ experience: { startDate: start?.value ?? null, endDate: end?.value ?? null }, today })
    if (span === null) return []
    return [{ span, dateFactIds: [start, end].flatMap((fact) => fact === undefined ? [] : [fact.id]),
      textFacts: own.filter(({ path }) => /^experiences\.\d+\.(?:role|context|achievements)\./u.test(path)) }]
  })
}

/**
 * Lower case without accents or French elisions ("c'est" is not C), with words split on anything but letters, digits
 * and the + # . & of technology names, so "R&D" stays one word and never names R.
 */
function normalizeTerm(value: string) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLocaleLowerCase('en')
    .replaceAll(/(?<![\p{L}\p{N}])\p{L}['’](?=\p{L})/gu, ' ')
    .replaceAll(/[^\p{L}\p{N}+#.&]+/gu, ' ').replaceAll(/\.(?![\p{L}\p{N}])/gu, '').trim()
}
