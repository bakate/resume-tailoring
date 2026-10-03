import type {
  SensitiveContent,
  SensitiveContentKind,
} from '@resume-tailoring/domain/resume-tailoring-state'

type SensitiveContentMatch = Readonly<{
  end: number
  kind: SensitiveContentKind
  /** Redacted from model-bound text without being listed again among the detected details. */
  redactOnly?: true
  start: number
  value: string
}>
type SensitiveRange = Readonly<{ end: number; start: number }>

/**
 * Removes sensitive content from model-bound text. Candidate content also passes the locally detected name and
 * enables `unlabeledAddresses`; a Job Posting never does, so its locations and figures stay intact.
 */
export function minimizeSensitiveContent({ content, candidateName = null, unlabeledAddresses = false }: Readonly<{
  content: string; candidateName?: string | null; unlabeledAddresses?: boolean
}>) {
  const labeledMatches = detectSensitiveContentMatches({ content })
  const matches: readonly SensitiveContentMatch[] = [...detectNameMatches({ content, candidateName }), ...labeledMatches,
    ...(unlabeledAddresses ? detectUnlabeledAddressMatches({ content, labeledMatches }) : [])]
  return {
    detectedSensitiveContent: matches.filter(({ redactOnly }) => redactOnly !== true).map((match, matchIndex) => (
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

export function containsContactDetail({ content }: Readonly<{ content: string }>) {
  return contactPatterns.some(({ pattern }) => new RegExp(pattern.source, 'u').test(content))
}

function detectNameMatches({ content, candidateName }: Readonly<{
  content: string; candidateName: string | null
}>): readonly SensitiveContentMatch[] {
  if (candidateName === null) return []
  const words = candidateName.split(/\s+/u).map((word) => word.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])${words.join('\\s+')}(?![\\p{L}\\p{N}_])`, 'giu')
  const [first, ...others] = [...content.matchAll(pattern)].map((match) => ({
    end: match.index + match[0].length, kind: 'name' as const, start: match.index, value: match[0],
  }))
  return first === undefined ? [] : [first, ...others.map((match) => ({ ...match, redactOnly: true as const }))]
}

/**
 * Finds postal addresses in the resume header that carry no "Address:" label: a segment after a location icon,
 * a street number and street type, or a postcode and city. A header row often extracts as one line whose details
 * are separated by column gaps, separators or icons, so each segment is judged on its own.
 */
function detectUnlabeledAddressMatches({ content, labeledMatches }: Readonly<{
  content: string; labeledMatches: readonly SensitiveContentMatch[]
}>): readonly SensitiveContentMatch[] {
  return readHeaderSegments({ content }).flatMap(({ afterLocationIcon, start, text }) => {
    const value = text.trim()
    if (value.length === 0 || !(afterLocationIcon || streetAddressPattern.test(value) || postcodeCityPattern.test(value))) {
      return []
    }
    const valueStart = start + text.indexOf(value)
    const match = { end: valueStart + value.length, kind: 'address' as const, start: valueStart, value }
    const labeled = labeledMatches.some((other) => other.kind === 'address' && other.start < match.end && match.start < other.end)
    return labeled ? [] : [match]
  })
}

function readHeaderSegments({ content }: Readonly<{ content: string }>) {
  const segments: Readonly<{ afterLocationIcon: boolean; start: number; text: string }>[] = []
  let lineStart = 0
  for (const line of content.split('\n').slice(0, headerLineCount)) {
    let offset = lineStart
    let afterLocationIcon = false
    for (const part of line.split(headerSegmentSeparator)) {
      if (headerSegmentSeparator.test(part) && part.trim().length > 0) {
        afterLocationIcon = locationIcons.has(part.replace('\uFE0F', ''))
      } else if (part.trim().length > 0) {
        segments.push({ afterLocationIcon, start: offset, text: part })
        afterLocationIcon = false
      }
      offset += part.length
    }
    lineStart += line.length + 1
  }
  return segments
}

const headerLineCount = 4
const headerSegmentSeparator = /(\s{2,}|[|•·]|\p{Extended_Pictographic}\uFE0F?)/u
const locationIcons = new Set(['📍', '🏠', '🏡', '⌂'])
const streetAddressPattern = /^\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|av\.|place|boulevard|bd|allée|chemin|impasse|quai|cours|route|square|street|road|lane)\s/iu
const postcodeCityPattern = /^\d{5}\s+\p{Lu}\p{L}/u

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

const contactPatterns = [
  { kind: 'email', pattern: /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu },
  { kind: 'phone', pattern: /(?<![\d+])(?:\+33[ -]?(?:0[ -]?)?|0)[1-9](?:[ -]?\d{2}){4}(?!\d)/gu },
] as const

const sensitiveContentPatterns = [
  ...contactPatterns,
  { kind: 'url', pattern: /(?:https?:\/\/|www\.)[^\s]+/giu },
  {
    kind: 'address',
    pattern: /(?<![\p{L}\p{N}_])(?:address|adresse)(?![\p{L}\p{N}_])\s*:?\s*.+$/gimu,
  },
  {
    kind: 'date-of-birth',
    pattern: /(?<![\p{L}\p{N}_])(?:date of birth|birth date|born|dob|date de naissance|né[e]?)(?![\p{L}\p{N}_])\s*:?\s*.+$/gimu,
  },
  {
    kind: 'personal-information',
    pattern: /(?<![\p{L}\p{N}_])(?:nationality|nationalité|gender|genre|sex|sexe|marital status|situation familiale)(?![\p{L}\p{N}_])\s*:?\s*.+$/gimu,
  },
] as const
