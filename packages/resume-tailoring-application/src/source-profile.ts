import type {
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileReview,
} from '@resume-tailoring/domain/resume-tailoring-state'

import { hasSourceProfileFactConflict } from './resume-tailoring-workflow'

type SensitiveContentMatch = Readonly<{
  end: number
  kind: SourceProfileReview['detectedSensitiveContent'][number]['kind']
  start: number
  value: string
}>

type FactTransitionResult =
  | { readonly ok: true; readonly value: readonly SourceProfileFact[] }
  | { readonly ok: false; readonly error: 'conflict' | 'unavailable' }
type FactDecision = Readonly<{
  facts: readonly SourceProfileFact[]
  factIds: readonly SourceProfileFactId[]
  status: 'verified' | 'rejected'
}>
type FactCorrection = Readonly<{
  correctedValue: string
  factId: SourceProfileFactId
  facts: readonly SourceProfileFact[]
  newFactId: SourceProfileFactId
}>
type ConflictResolution = Readonly<{
  facts: readonly SourceProfileFact[]
  selectedFactId: SourceProfileFactId
}>

export function createReviewingSourceProfile({
  documentName,
  documentText,
}: Readonly<{ documentName: string; documentText: string }>): SourceProfileReview {
  const sensitiveContentMatches = detectSensitiveContentMatches({ documentText })
  return {
    status: 'reviewing-document',
    documentName,
    detectedSensitiveContent: sensitiveContentMatches.map((match, matchIndex) => (
      toSensitiveContent({ match, matchIndex })
    )),
    outgoingContent: redactSensitiveContent({ documentText, sensitiveContentMatches }),
    processingNotice: null,
    facts: [],
  }
}

export function decideSourceProfileFacts({ facts, factIds, status }: FactDecision): FactTransitionResult {
  const selectedFactIds = new Set(factIds)
  const selectedFacts = facts.filter(
    (fact) => fact.status === 'extracted' && selectedFactIds.has(fact.id),
  )
  if (selectedFactIds.size === 0 || selectedFacts.length !== selectedFactIds.size) {
    return unavailableTransition
  }
  if (status === 'verified'
    && selectedFacts.some((fact) => hasSourceProfileFactConflict({ fact, facts }))) {
    return conflictTransition
  }
  return createSuccessfulTransition({ value: facts.map((fact) => (
    selectedFactIds.has(fact.id) ? { ...fact, status } : fact
  )) })
}

export function correctSourceProfileFact({
  correctedValue, factId, facts, newFactId,
}: FactCorrection): FactTransitionResult {
  const originalFact = facts.find((fact) => fact.id === factId && !isClosedFact({ fact }))
  if (originalFact === undefined || correctedValue.trim().length === 0) return unavailableTransition
  const supersededFacts = facts.map((fact) => (
    fact.id === originalFact.id ? { ...fact, status: 'superseded' as const } : fact
  ))
  const correctedFact = {
    ...originalFact,
    id: newFactId,
    value: correctedValue,
    status: 'verified' as const,
    supersedesFactId: originalFact.id,
  }
  if (hasSourceProfileFactConflict({ fact: correctedFact, facts: supersededFacts })) {
    return conflictTransition
  }
  return createSuccessfulTransition({ value: [...supersededFacts, correctedFact] })
}

export function resolveSourceProfileFactConflict({
  facts, selectedFactId,
}: ConflictResolution): FactTransitionResult {
  const selectedFact = facts.find((fact) => fact.id === selectedFactId && !isClosedFact({ fact }))
  if (selectedFact === undefined) return unavailableTransition
  const competingFactIds = new Set(facts
    .filter((fact) => isCompetingFact({ fact, selectedFact }))
    .map((fact) => fact.id))
  if (competingFactIds.size === 0) return unavailableTransition
  return createSuccessfulTransition({ value: facts.map((fact) => {
    if (fact.id === selectedFactId) return { ...fact, status: 'verified' as const }
    return competingFactIds.has(fact.id) ? { ...fact, status: 'rejected' as const } : fact
  }) })
}

function createSuccessfulTransition({
  value,
}: Readonly<{ value: readonly SourceProfileFact[] }>): FactTransitionResult {
  return { ok: true, value }
}

function isCompetingFact({
  fact,
  selectedFact,
}: Readonly<{ fact: SourceProfileFact; selectedFact: SourceProfileFact }>) {
  return fact.id !== selectedFact.id
    && fact.propositionKey === selectedFact.propositionKey
    && fact.value !== selectedFact.value
    && !isClosedFact({ fact })
}

function isClosedFact({ fact }: Readonly<{ fact: SourceProfileFact }>) {
  return fact.status === 'rejected' || fact.status === 'superseded'
}

function redactSensitiveContent({
  documentText,
  sensitiveContentMatches,
}: Readonly<{
  documentText: string
  sensitiveContentMatches: readonly SensitiveContentMatch[]
}>) {
  const ranges = mergeSensitiveRanges({ sensitiveContentMatches })
  const redactedParts = ranges.map((range, rangeIndex) => {
    const previousEnd = ranges[rangeIndex - 1]?.end ?? 0
    return documentText.slice(previousEnd, range.start)
  })
  return [...redactedParts, documentText.slice(ranges.at(-1)?.end ?? 0)].join('')
}

function mergeSensitiveRanges({
  sensitiveContentMatches,
}: Readonly<{ sensitiveContentMatches: readonly SensitiveContentMatch[] }>) {
  return sensitiveContentMatches
    .map(({ end, start }) => ({ end, start }))
    .toSorted((firstRange, secondRange) => firstRange.start - secondRange.start)
    .reduce<readonly Readonly<{ end: number; start: number }>[]>((ranges, range) => {
      const previousRange = ranges.at(-1)
      if (previousRange === undefined || range.start > previousRange.end) return [...ranges, range]
      return [...ranges.slice(0, -1), { start: previousRange.start, end: Math.max(previousRange.end, range.end) }]
    }, [])
}

function detectSensitiveContentMatches({ documentText }: Readonly<{ documentText: string }>) {
  const matches = sensitiveContentPatterns.flatMap(({ kind, pattern }) => (
    [...documentText.matchAll(pattern)].map((match) => ({
      end: match.index + match[0].length,
      kind,
      start: match.index,
      value: match[0],
    }))
  ))
  return matches
}

function toSensitiveContent({
  match,
  matchIndex,
}: Readonly<{ match: SensitiveContentMatch; matchIndex: number }>) {
  return {
    id: `sensitive-${String(matchIndex + 1)}` as const,
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

const unavailableTransition = { ok: false, error: 'unavailable' } as const
const conflictTransition = { ok: false, error: 'conflict' } as const
