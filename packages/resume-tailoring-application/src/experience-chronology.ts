import type { TailoredResumeExperience } from './tailored-resume'

/** An experience to order: its index in the source and its dates as the source or the Candidate wrote them. */
export type DatedExperience = Readonly<{ sourceIndex: number; startDate: string | null; endDate: string | null }>

/** `year * 13 + month`, where month 0 is a date known only by its year: it sorts before every month of that year. */
type ExperienceMonth = number
type ExperienceEnd = ExperienceMonth | 'ongoing'

// Dates stay as written, so they are read in both supported languages, accents removed.
const ongoingEndPattern = /\b(?:present|current|now\b|today|ongoing|to date|aujourd|actuel|en cours|a ce jour|maintenant)/u
const ongoingStartPattern = /\b(?:since|depuis)\b/u
const monthStems = [['jan'], ['feb', 'fev'], ['mar'], ['apr', 'avr'], ['may', 'mai'], ['jun', 'juin'], ['jul', 'juil'],
  ['aug', 'aou'], ['sep'], ['oct'], ['nov'], ['dec']] as const

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

function readExperienceDates({ experience: { startDate, endDate } }: Readonly<{ experience: DatedExperience }>): Readonly<{
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
