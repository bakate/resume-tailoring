import type { CandidateFact } from '@resume-tailoring/domain/source-intake'

/** A source experience to order: its index in the source and the Candidate Facts it holds. */
export type ChronologyEntry = Readonly<{ sourceIndex: number; facts: readonly CandidateFact[] }>

/** Months since year 0; a date known only by its year sorts before every month of that year. */
type ExperienceMonth = number
type ExperienceEnd = ExperienceMonth | 'ongoing'

// Dates stay as the source wrote them, so they are read in both supported languages, accents removed.
const ongoingPattern = /\b(?:present|current|now\b|today|ongoing|to date|aujourd|actuel|en cours|a ce jour|maintenant)/u
const monthStems = [['jan'], ['feb', 'fev'], ['mar'], ['apr', 'avr'], ['may', 'mai'], ['jun', 'juin'], ['jul', 'juil'],
  ['aug', 'aou'], ['sep'], ['oct'], ['nov'], ['dec']] as const

/**
 * Orders experiences reverse-chronologically: by end date (an ongoing role first), then start date, then source
 * order. An experience with no usable date comes last, in source order; it is never rejected.
 */
export function orderExperiencesReverseChronologically<TEntry extends ChronologyEntry>(entries: readonly TEntry[]): readonly TEntry[] {
  return entries.map((entry) => ({ entry, ...readExperienceDates(entry.facts) }))
    .sort((left, right) => compareDescending(rankEnd(left.end), rankEnd(right.end))
      || compareDescending(left.start ?? -Infinity, right.start ?? -Infinity)
      || left.entry.sourceIndex - right.entry.sourceIndex)
    .map(({ entry }) => entry)
}

function readExperienceDates(facts: readonly CandidateFact[]): Readonly<{ start: ExperienceMonth | null; end: ExperienceEnd | null }> {
  const read = (name: 'startDate' | 'endDate') => facts.find(({ path }) => path.split('.')[2] === name)?.value ?? null
  const start = readMonth(read('startDate'))
  const endValue = read('endDate')
  // An experience known only by its start is placed by it, so it is not mistaken for an undated one.
  const end = endValue !== null && ongoingPattern.test(normalize(endValue)) ? 'ongoing' : readMonth(endValue) ?? start
  return { start, end }
}

function rankEnd(end: ExperienceEnd | null) {
  return end === 'ongoing' ? Infinity : end ?? -Infinity
}

// Compares without subtracting, since two infinite ranks would give NaN.
function compareDescending(left: number, right: number) {
  return left === right ? 0 : right > left ? 1 : -1
}

function readMonth(value: string | null): ExperienceMonth | null {
  if (value === null) return null
  const text = normalize(value)
  const year = /\b(?:19|20)\d{2}\b/u.exec(text)?.[0]
  if (year === undefined) return null
  const month = readNumericMonth(text) ?? readMonthName(text) ?? 0
  return Number(year) * 12 + month
}

function readNumericMonth(text: string) {
  const digits = /\b(?:19|20)\d{2}[-/.](\d{1,2})\b/u.exec(text)?.[1] ?? /\b(\d{1,2})[-/.](?:19|20)\d{2}\b/u.exec(text)?.[1]
  const month = Number(digits)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null
}

function readMonthName(text: string) {
  const words = text.match(/[a-z]+/gu) ?? []
  const index = monthStems.findIndex((stems) => words.some((word) => stems.some((stem) => word.startsWith(stem))))
  return index === -1 ? null : index + 1
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
