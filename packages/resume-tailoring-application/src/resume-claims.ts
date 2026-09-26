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
    && (expression.suffix.length === 0
      || normalizeNumericSuffix(candidate.suffix) === normalizeNumericSuffix(expression.suffix))
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
  return (value.toLocaleLowerCase('en-US').match(dateTokenPattern) ?? [])
    .map(normalizeDateToken)
}

function normalizeNumericSuffix(suffix: string) {
  return numericSuffixTranslations[suffix] ?? suffix
}

function normalizeDateToken(token: string) {
  const normalizedToken = token.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '')
  return monthTranslations.find(({ pattern }) => pattern.test(normalizedToken))?.month
    ?? normalizedToken
}

const numericExpressionPattern = /(?<prefix>[-+$€£])?\s*(?<amount>\d+(?:[.,]\d+)?)\s*(?<suffix>%|years?|ans?|months?|mois|days?|jours?|hours?|heures?|usd|eur|gbp|k|m|millions?)?/giu
const dateTokenPattern = /\b(?:jan(?:uary|vier)?|feb(?:ruary)?|f[eé]v(?:rier)?|mar(?:ch|s)?|apr(?:il)?|avr(?:il)?|may|mai|jun(?:e)?|juin|jul(?:y)?|juil(?:let)?|aug(?:ust)?|ao[uû]t|sep(?:tember|tembre)?|oct(?:ober|obre)?|nov(?:ember|embre)?|dec(?:ember)?|d[eé]c(?:embre)?)\b/giu
const numericSuffixTranslations: Readonly<Record<string, string>> = {
  year: 'year', years: 'year', an: 'year', ans: 'year',
  month: 'month', months: 'month', mois: 'month',
  day: 'day', days: 'day', jour: 'day', jours: 'day',
  hour: 'hour', hours: 'hour', heure: 'hour', heures: 'hour',
}
const monthTranslations = [
  { month: 'january', pattern: /^jan(?:uary|vier)?$/u },
  { month: 'february', pattern: /^(?:feb(?:ruary)?|fev(?:rier)?)$/u },
  { month: 'march', pattern: /^mar(?:ch|s)?$/u },
  { month: 'april', pattern: /^(?:apr(?:il)?|avr(?:il)?)$/u },
  { month: 'may', pattern: /^(?:may|mai)$/u },
  { month: 'june', pattern: /^(?:jun(?:e)?|juin)$/u },
  { month: 'july', pattern: /^(?:jul(?:y)?|juil(?:let)?)$/u },
  { month: 'august', pattern: /^(?:aug(?:ust)?|aout)$/u },
  { month: 'september', pattern: /^sep(?:tember|tembre)?$/u },
  { month: 'october', pattern: /^oct(?:ober|obre)?$/u },
  { month: 'november', pattern: /^nov(?:ember|embre)?$/u },
  { month: 'december', pattern: /^(?:dec(?:ember)?|dec(?:embre)?)$/u },
] as const
