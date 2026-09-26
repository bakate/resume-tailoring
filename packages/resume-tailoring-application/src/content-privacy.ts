import type {
  SensitiveContent,
  SensitiveContentKind,
} from '@resume-tailoring/domain/resume-tailoring-state'

type SensitiveContentMatch = Readonly<{
  end: number
  kind: SensitiveContentKind
  start: number
  value: string
}>
type SensitiveRange = Readonly<{ end: number; start: number }>

export function minimizeSensitiveContent({ content }: Readonly<{ content: string }>) {
  const matches = detectSensitiveContentMatches({ content })
  return {
    detectedSensitiveContent: matches.map((match, matchIndex) => (
      toSensitiveContent({ match, matchIndex })
    )),
    outgoingContent: redactSensitiveContent({ content, matches }),
  }
}

function redactSensitiveContent({
  content,
  matches,
}: Readonly<{ content: string; matches: readonly SensitiveContentMatch[] }>) {
  const ranges = mergeSensitiveRanges({ matches })
  const redactedParts = ranges.map((range, rangeIndex) => {
    const previousEnd = ranges[rangeIndex - 1]?.end ?? 0
    return content.slice(previousEnd, range.start)
  })
  return [...redactedParts, content.slice(ranges.at(-1)?.end ?? 0)].join('')
}

function mergeSensitiveRanges({ matches }: Readonly<{
  matches: readonly SensitiveContentMatch[]
}>) {
  return matches
    .map(({ end, start }) => ({ end, start }))
    .toSorted((firstRange, secondRange) => firstRange.start - secondRange.start)
    .reduce<SensitiveRange[]>(mergeSensitiveRange, [])
}

function mergeSensitiveRange(
  ranges: SensitiveRange[],
  range: SensitiveRange,
) {
  const previousRange = ranges.at(-1)
  if (previousRange === undefined || range.start > previousRange.end) {
    ranges.push(range)
    return ranges
  }
  ranges[ranges.length - 1] = {
    start: previousRange.start,
    end: Math.max(previousRange.end, range.end),
  }
  return ranges
}

function detectSensitiveContentMatches({ content }: Readonly<{ content: string }>) {
  return sensitiveContentPatterns.flatMap(({ kind, pattern }) => (
    [...content.matchAll(pattern)].map((match) => ({
      end: match.index + match[0].length,
      kind,
      start: match.index,
      value: match[0],
    }))
  ))
}

function toSensitiveContent({
  match,
  matchIndex,
}: Readonly<{ match: SensitiveContentMatch; matchIndex: number }>): SensitiveContent {
  return {
    id: `sensitive-${String(matchIndex + 1)}`,
    kind: match.kind,
    value: match.value,
  }
}

const sensitiveContentPatterns = [
  { kind: 'email', pattern: /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu },
  { kind: 'phone', pattern: /(?<![\d+])(?:\+33[ -]?(?:0[ -]?)?|0)[1-9](?:[ -]?\d{2}){4}(?!\d)/gu },
  { kind: 'url', pattern: /(?:https?:\/\/|www\.)[^\s]+/giu },
  { kind: 'address', pattern: /\b(?:address|adresse)\s*:?\s*.+$/gimu },
  {
    kind: 'date-of-birth',
    pattern: /\b(?:date of birth|birth date|born|dob|date de naissance|né[e]?)\s*:?\s*.+$/gimu,
  },
  {
    kind: 'personal-information',
    pattern: /\b(?:nationality|nationalité|gender|genre|sex|sexe|marital status|situation familiale)\s*:?\s*.+$/gimu,
  },
] as const
