import type {
  SourceProfileFact,
  TailoredResume,
} from '@resume-tailoring/domain/resume-tailoring-state'

import { validateProposedResumeClaim } from './resume-claims'

export function restoreTailoredResume({ sourceFacts, tailoredResume }: Readonly<{
  sourceFacts: readonly SourceProfileFact[]
  tailoredResume: TailoredResume
}>): TailoredResume | null {
  const verifiedFacts = sourceFacts.filter((fact) => fact.status === 'verified')
  const claims = tailoredResume.claims.map(({ id, segments }) =>
    validateProposedResumeClaim({ claimId: id, proposal: { segments }, verifiedFacts }))
  if (claims.some((claim) => !claim.ok)) return null
  return {
    claims: claims.flatMap((claim) => claim.ok ? [claim.value] : []),
    exclusions: tailoredResume.exclusions,
  }
}
