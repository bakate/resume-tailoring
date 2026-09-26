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
  const supportedTokens = new Set(readConstrainedTokens({ value: supportedText }))
  return readConstrainedTokens({ value: text }).every((token) => supportedTokens.has(token))
}

function readConstrainedTokens({ value }: Readonly<{ value: string }>) {
  const normalizedValue = value.toLocaleLowerCase('en-US')
  return normalizedValue.match(
    /\b(?:\d+(?:[.,]\d+)?%?|jan(?:uary|vier)?|feb(?:ruary)?|f[eé]v(?:rier)?|mar(?:ch|s)?|apr(?:il)?|avr(?:il)?|may|mai|jun(?:e)?|juin|jul(?:y)?|juil(?:let)?|aug(?:ust)?|ao[uû]t|sep(?:tember|tembre)?|oct(?:ober|obre)?|nov(?:ember|embre)?|dec(?:ember)?|d[eé]c(?:embre)?)\b/giu,
  ) ?? []
}
