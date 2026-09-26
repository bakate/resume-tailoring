import type {
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileReview,
} from '@resume-tailoring/domain/resume-tailoring-state'

import { minimizeSensitiveContent } from './content-privacy'
import { hasSourceProfileFactConflict } from './resume-tailoring-workflow'

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
  const minimizedContent = minimizeSensitiveContent({ content: documentText })
  return {
    status: 'reviewing-document',
    documentName,
    ...minimizedContent,
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

const unavailableTransition = { ok: false, error: 'unavailable' } as const
const conflictTransition = { ok: false, error: 'conflict' } as const
