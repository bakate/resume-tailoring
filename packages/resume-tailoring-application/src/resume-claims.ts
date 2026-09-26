import type {
  ResumeClaim,
  ResumeClaimId,
  SourceProfileFact,
} from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  ProposedResumeClaim,
  ResumeClaimValidationFeedback,
} from './resume-tailoring-workflow-ports'

export function validateProposedResumeClaim({
  claimId,
  proposal,
  verifiedFacts,
}: Readonly<{
  claimId: ResumeClaimId
  proposal: ProposedResumeClaim
  verifiedFacts: readonly Pick<SourceProfileFact, 'id' | 'value'>[]
}>): Readonly<
  | { ok: true; value: ResumeClaim }
  | { ok: false; feedback: readonly ResumeClaimValidationFeedback[] }
> {
  const verifiedFactById = new Map(verifiedFacts.map((fact) => [fact.id, fact]))
  const feedback = proposal.segments.flatMap((segment, segmentIndex) =>
    validateSegment({ segment, segmentIndex, verifiedFactById }))
  if (proposal.segments.length === 0) {
    return { ok: false, feedback: [{ code: 'missing-segment-provenance' }] }
  }
  return feedback.length === 0
    ? { ok: true, value: { id: claimId, segments: proposal.segments } }
    : { ok: false, feedback }
}

export function toProposedResumeClaim({ claim }: Readonly<{ claim: ResumeClaim }>) {
  return { segments: claim.segments } satisfies ProposedResumeClaim
}

function validateSegment({
  segment,
  segmentIndex,
  verifiedFactById,
}: Readonly<{
  segment: ProposedResumeClaim['segments'][number]
  segmentIndex: number
  verifiedFactById: ReadonlyMap<
    SourceProfileFact['id'],
    Pick<SourceProfileFact, 'id' | 'value'>
  >
}>): readonly ResumeClaimValidationFeedback[] {
  if (segment.text.trim().length === 0 || segment.factIds.length === 0) {
    return [{ code: 'missing-segment-provenance', segmentIndex }]
  }
  const referencedFacts = segment.factIds.map((factId) => verifiedFactById.get(factId))
  if (new Set(segment.factIds).size !== segment.factIds.length
    || referencedFacts.some((fact) => fact === undefined)) {
    return [{ code: 'invalid-fact-reference', segmentIndex }]
  }
  const supportedText = referencedFacts
    .filter((fact) => fact !== undefined)
    .map(({ value }) => value)
    .join(' ')
  return hasOnlySupportedNumericTokens({ supportedText, text: segment.text })
    ? []
    : [{ code: 'unsupported-number-or-date', segmentIndex }]
}

function hasOnlySupportedNumericTokens({
  supportedText,
  text,
}: Readonly<{ supportedText: string; text: string }>) {
  const supportedNumbers = readNumericExpressions({ value: supportedText })
  const supportedDates = new Set(readDateTokens({ value: supportedText }))
  return readNumericExpressions({ value: text })
    .every((expression) => supportedNumbers.some((candidate) =>
      supportsNumericExpression({ candidate, expression })))
    && readDateTokens({ value: text }).every((token) => supportedDates.has(token))
}

type NumericExpression = Readonly<{
  amount: string
  prefix: string
  suffix: string
}>

function supportsNumericExpression({
  candidate,
  expression,
}: Readonly<{ candidate: NumericExpression; expression: NumericExpression }>) {
  return candidate.amount === expression.amount
    && (expression.prefix.length === 0 || candidate.prefix === expression.prefix)
    && (expression.suffix.length === 0 || candidate.suffix === expression.suffix)
}

function readNumericExpressions({ value }: Readonly<{ value: string }>): NumericExpression[] {
  return [...value.toLocaleLowerCase('en-US').matchAll(numericExpressionPattern)]
    .map((match) => ({
      amount: match.groups?.amount ?? '',
      prefix: match.groups?.prefix ?? '',
      suffix: match.groups?.suffix ?? '',
    }))
}

function readDateTokens({ value }: Readonly<{ value: string }>) {
  return value.toLocaleLowerCase('en-US').match(dateTokenPattern) ?? []
}

const numericExpressionPattern = /(?<prefix>[-+$€£])?\s*(?<amount>\d+(?:[.,]\d+)?)\s*(?<suffix>%|years?|ans?|months?|mois|days?|jours?|hours?|heures?|usd|eur|gbp|k|m|millions?)?/giu
const dateTokenPattern = /\b(?:jan(?:uary|vier)?|feb(?:ruary)?|f[eé]v(?:rier)?|mar(?:ch|s)?|apr(?:il)?|avr(?:il)?|may|mai|jun(?:e)?|juin|jul(?:y)?|juil(?:let)?|aug(?:ust)?|ao[uû]t|sep(?:tember|tembre)?|oct(?:ober|obre)?|nov(?:ember|embre)?|dec(?:ember)?|d[eé]c(?:embre)?)\b/giu
