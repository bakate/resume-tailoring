import type { TailoredResumeExperience } from './tailored-resume'

/** An experience to order: its index in the source and its dates as the source or the Candidate wrote them. */
export type DatedExperience = Readonly<{ sourceIndex: number; startDate: string | null; endDate: string | null }>
type ExperienceDates = Pick<DatedExperience, 'startDate' | 'endDate'>

/** `year * 13 + month`, where month 0 is a date known only by its year: it sorts before every month of that year. */
type ExperienceMonth = number
type ExperienceEnd = ExperienceMonth | 'ongoing'

// Dates stay as written, so they are read in both supported languages, accents removed.
const ongoingEndPattern = /\b(?:present|current|now\b|today|ongoing|to date|aujourd|actuel|en cours|a ce jour|maintenant)/u
const ongoingStartPattern = /\b(?:since|depuis)\b/u
const monthStems = [['jan'], ['feb', 'fev'], ['mar'], ['apr', 'avr'], ['may', 'mai'], ['jun', 'juin'], ['jul', 'juil'],
  ['aug', 'aou'], ['sep'], ['oct'], ['nov'], ['dec']] as const

export type ExperienceChronology = TailoredResumeExperience['chronology']

/** What code decides about one experience before it is written: its chronology and how many achievements it may keep. */
export type ExperienceShape = Readonly<{ chronology: ExperienceChronology; achievementBudget: number }>

/** The achievement budget of a Relevant Experience, set by its duration; an undated experience gets the lowest. */
export const relevantExperienceAchievementBudgets = { underOneYear: 3, oneToThreeYears: 4, beyondThreeYears: 6 } as const
const contextExperienceAchievementLimit = 2
const contextExperienceMinimumMonths = 6

/**
 * Shapes experiences given most recent first, as the section plan orders them. In a Tailored Resume, an experience
 * citing a relevant Candidate Fact is relevant; otherwise the first one lasting at least six months is context, and
 * every other is earlier. A Normalized Resume claims no relevance: every experience is context, budgeted by duration.
 */
export function classifyExperiences({ experiences, purpose, today }: Readonly<{
  experiences: readonly (DatedExperience & Readonly<{ relevant: boolean }>)[]
  purpose: 'tailored' | 'normalized'
  today: number
}>): readonly ExperienceShape[] {
  const measured = experiences.map((experience) => ({ relevant: experience.relevant,
    months: readExperienceMonths({ experience, today }) }))
  const context = purpose === 'tailored' ? measured.find(({ relevant, months }) => !relevant
    && months !== null && months >= contextExperienceMinimumMonths) : undefined
  return measured.map((experience): ExperienceShape => {
    if (purpose === 'normalized' || experience.relevant) {
      return { chronology: purpose === 'normalized' ? 'context' : 'relevant', achievementBudget: budgetByDuration(experience.months) }
    }
    return experience === context ? { chronology: 'context', achievementBudget: contextExperienceAchievementLimit }
      : { chronology: 'earlier', achievementBudget: 0 }
  })
}

function budgetByDuration(months: number | null) {
  if (months === null || months < 12) return relevantExperienceAchievementBudgets.underOneYear
  return months <= 36 ? relevantExperienceAchievementBudgets.oneToThreeYears : relevantExperienceAchievementBudgets.beyondThreeYears
}

/**
 * Whole months from the first to the last, both included; an ongoing role runs until today. A year without a month
 * covers that whole year, never beyond today. Null without a usable start and end, so the duration is never guessed.
 */
export function readExperienceMonths({ experience, today }: Readonly<{ experience: ExperienceDates; today: number }>) {
  const start = readMonth({ date: experience.startDate })
  const ongoing = readExperienceDates({ experience }).end === 'ongoing'
  const end = ongoing ? null : readMonth({ date: experience.endDate })
  if (start === null || (!ongoing && (experience.endDate === null || end === null))) return null
  const todayMonth = new Date(today).getUTCFullYear() * 12 + new Date(today).getUTCMonth()
  const first = toCalendarMonth({ month: start, edge: 'first' })
  const last = end === null ? todayMonth : Math.min(toCalendarMonth({ month: end, edge: 'last' }), todayMonth)
  return last < first ? null : last - first + 1
}

/** A month counted from year zero; a date known only by its year starts in January and ends in December. */
function toCalendarMonth({ month, edge }: Readonly<{ month: ExperienceMonth; edge: 'first' | 'last' }>) {
  const monthOfYear = month % 13
  return Math.floor(month / 13) * 12 + (monthOfYear === 0 ? (edge === 'first' ? 0 : 11) : monthOfYear - 1)
}

/**
 * Orders experiences reverse-chronologically: by end date (an ongoing role first), then start date, then source
 * order. An experience with no usable date comes last, in source order; it is never rejected.
 */
export function orderExperiencesReverseChronologically<TExperience extends DatedExperience>({ experiences }: Readonly<{
  experiences: readonly TExperience[]
}>): readonly TExperience[] {
  return experiences.map((experience) => ({ experience, ...readExperienceDates({ experience }) }))
    .sort((left, right) => compareDescending(rankEnd(left.end), rankEnd(right.end))
      || compareDescending(left.start ?? -Infinity, right.start ?? -Infinity)
      || left.experience.sourceIndex - right.experience.sourceIndex)
    .map(({ experience }) => experience)
}

/** Puts the experiences of a Tailored Resume back in reverse-chronological order, as after one is restored. */
export function orderResumeExperiences({ experiences }: Readonly<{
  experiences: readonly TailoredResumeExperience[]
}>): readonly TailoredResumeExperience[] {
  return orderExperiencesReverseChronologically({ experiences: experiences.map((experience) => ({ experience,
    sourceIndex: Number(/^experiences\.(\d+)$/u.exec(experience.id)?.[1] ?? Infinity),
    startDate: experience.startDate?.text ?? null, endDate: experience.endDate?.text ?? null })) })
    .map(({ experience }) => experience)
}

function readExperienceDates({ experience: { startDate, endDate } }: Readonly<{ experience: ExperienceDates }>): Readonly<{
  start: ExperienceMonth | null; end: ExperienceEnd | null
}> {
  const start = readMonth({ date: startDate })
  // "Since March 2021" with no end date is an ongoing role; any other experience known only by its start is
  // placed by it, so it is not mistaken for an undated one.
  if (endDate === null && startDate !== null && start !== null && ongoingStartPattern.test(normalize(startDate))) {
    return { start, end: 'ongoing' }
  }
  if (endDate !== null && ongoingEndPattern.test(normalize(endDate))) return { start, end: 'ongoing' }
  return { start, end: readMonth({ date: endDate }) ?? start }
}

function rankEnd(end: ExperienceEnd | null) {
  return end === 'ongoing' ? Infinity : end ?? -Infinity
}

// Compares without subtracting, since two infinite ranks would give NaN.
function compareDescending(left: number, right: number) {
  return left === right ? 0 : right > left ? 1 : -1
}

function readMonth({ date }: Readonly<{ date: string | null }>): ExperienceMonth | null {
  if (date === null) return null
  const text = normalize(date)
  const year = /\b(?:19|20)\d{2}\b/u.exec(text)?.[0]
  if (year === undefined) return null
  return Number(year) * 13 + (readNumericMonth({ text }) ?? readMonthName({ text }) ?? 0)
}

function readNumericMonth({ text }: Readonly<{ text: string }>) {
  const candidates = [/\b(?:19|20)\d{2}[-/.](\d{1,2})\b/u.exec(text)?.[1], /\b(\d{1,2})[-/.](?:19|20)\d{2}\b/u.exec(text)?.[1]]
  return candidates.map(Number).find((month) => Number.isInteger(month) && month >= 1 && month <= 12) ?? null
}

/** The first word of the date that names a month, so a range written in one field reads as its first date. */
function readMonthName({ text }: Readonly<{ text: string }>) {
  for (const word of text.match(/[a-z]+/gu) ?? []) {
    const index = monthStems.findIndex((stems) => stems.some((stem) => word.startsWith(stem)))
    if (index !== -1) return index + 1
  }
  return null
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
