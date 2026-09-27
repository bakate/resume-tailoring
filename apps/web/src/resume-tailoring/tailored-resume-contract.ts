import { validateProposedResumeClaim } from '@resume-tailoring/application/resume-claims'
import { formatResumeClaimText } from '@resume-tailoring/application/tailored-resume-document'
import type {
  ResumeClaim,
  ResumeClaimSemanticValidator,
  ResumeClaimWritingInputs,
  SourceProfileFactId,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import type { TailoredResumeRenderInputs } from './tailored-resume-html'

export const resumePdfFailureTypes = [
  'resume-pdf-content-mismatch',
  'resume-pdf-fonts-not-embedded',
  'resume-pdf-overflow',
  'resume-pdf-page-count-invalid',
  'resume-pdf-provenance-invalid',
  'resume-pdf-rendering-unavailable',
  'resume-pdf-request-invalid',
  'resume-pdf-validation-unavailable',
] as const

export type ResumePdfFailureType = typeof resumePdfFailureTypes[number]

export type TailoredResumePdfInputs = TailoredResumeRenderInputs & Readonly<{
  validatedClaims: readonly ResumeClaim[]
  verifiedFacts: ResumeClaimWritingInputs['verifiedFacts']
}>

export type TailoredResumePdfDependencies = Readonly<{
  semanticValidator: ResumeClaimSemanticValidator
}>

export function hasVerifiedResumeClaimProvenance(inputs: TailoredResumePdfInputs) {
  if (!hasUniqueIdentifiers(inputs)) return false
  const verifiedFactIds = new Set(inputs.verifiedFacts.map(({ id }) => id))
  const claimById = new Map(inputs.validatedClaims.map((claim) => [claim.id, claim]))
  return inputs.document.items.every((item) => {
    const claim = claimById.get(item.claimId)
    return claim !== undefined
      && formatResumeClaimText({ claim }) === item.text
      && hasSameVerifiedFactIds({ claim, itemFactIds: item.factIds, verifiedFactIds })
      && validateProposedResumeClaim({
        claimId: claim.id, proposal: { segments: claim.segments }, verifiedFacts: inputs.verifiedFacts,
      }).ok
  })
}

function hasUniqueIdentifiers(inputs: TailoredResumePdfInputs) {
  const claimIds = inputs.validatedClaims.map(({ id }) => id)
  const documentClaimIds = inputs.document.items.map(({ claimId }) => claimId)
  const factIds = inputs.verifiedFacts.map(({ id }) => id)
  return new Set(claimIds).size === claimIds.length
    && new Set(documentClaimIds).size === documentClaimIds.length
    && new Set(factIds).size === factIds.length
}

function hasSameVerifiedFactIds({ claim, itemFactIds, verifiedFactIds }: Readonly<{
  claim: ResumeClaim
  itemFactIds: readonly SourceProfileFactId[]
  verifiedFactIds: ReadonlySet<SourceProfileFactId>
}>) {
  const claimFactIds = new Set(claim.segments.flatMap(({ factIds }) => factIds))
  const uniqueItemFactIds = new Set(itemFactIds)
  return uniqueItemFactIds.size === itemFactIds.length
    && claimFactIds.size === uniqueItemFactIds.size
    && [...uniqueItemFactIds].every((factId) =>
      claimFactIds.has(factId) && verifiedFactIds.has(factId))
}
