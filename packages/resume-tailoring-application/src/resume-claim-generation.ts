import type {
  ResumeClaim,
  ResumeClaimId,
  TailoredResume,
} from '@resume-tailoring/domain/resume-tailoring-state'

import { toProposedResumeClaim, validateProposedResumeClaim } from './resume-claims'
import type {
  ProposedResumeClaim,
  ResumeClaimIdentity,
  ResumeClaimSemanticValidator,
  ResumeClaimValidationFeedback,
  ResumeClaimWriter,
  ResumeClaimWritingInputs,
} from './resume-tailoring-workflow-ports'

type ResumeClaimGenerationDependencies = Readonly<{
  identity: ResumeClaimIdentity
  semanticValidator: ResumeClaimSemanticValidator
  writer: ResumeClaimWriter
}>

type ClaimResult = Readonly<
  | { ok: true; claim: ResumeClaim | null }
  | {
      ok: false
      error: Readonly<{
        type:
          | 'resume-claim-unavailable'
          | 'resume-claim-validation-unavailable'
          | 'resume-claim-writing-unavailable'
      }>
    }
>

export function createResumeClaimGeneration(
  dependencies: ResumeClaimGenerationDependencies,
) {
  return {
    generate: (inputs: ResumeClaimWritingInputs) => generateClaims({ dependencies, inputs }),
    reformulate: (request: Readonly<{
      claim: ResumeClaim
      inputs: ResumeClaimWritingInputs
      request: string
    }>) => reformulateClaim({ dependencies, ...request }),
  }
}

async function generateClaims({
  dependencies,
  inputs,
}: Readonly<{
  dependencies: ResumeClaimGenerationDependencies
  inputs: ResumeClaimWritingInputs
}>) {
  const writing = await dependencies.writer.write(inputs)
  if (!writing.ok) return writing
  return validateGeneratedClaims({ dependencies, inputs, proposals: writing.value })
}

async function validateGeneratedClaims({
  dependencies,
  inputs,
  proposals,
}: Readonly<{
  dependencies: ResumeClaimGenerationDependencies
  inputs: ResumeClaimWritingInputs
  proposals: readonly ProposedResumeClaim[]
}>) {
  const claims: ResumeClaim[] = []
  const exclusions: TailoredResume['exclusions'][number][] = []
  for (const proposal of proposals) {
    const validation = await identifyAndValidateClaim({ dependencies, inputs, proposal })
    if (!validation.ok) return validation
    if (validation.claim === null) exclusions.push(unsupportedClaimExclusion)
    else claims.push(validation.claim)
  }
  return { ok: true, value: { claims, exclusions } } as const
}

async function identifyAndValidateClaim({
  dependencies,
  inputs,
  proposal,
}: Readonly<{
  dependencies: ResumeClaimGenerationDependencies
  inputs: ResumeClaimWritingInputs
  proposal: ProposedResumeClaim
}>): Promise<ClaimResult> {
  const identity = dependencies.identity.create()
  if (!identity.ok) return resumeClaimUnavailableResult
  return validateClaimWithOneRetry({ claimId: identity.value, dependencies, inputs, proposal })
}

async function reformulateClaim({
  claim,
  dependencies,
  inputs,
  request,
}: Readonly<{
  claim: ResumeClaim
  dependencies: ResumeClaimGenerationDependencies
  inputs: ResumeClaimWritingInputs
  request: string
}>): Promise<ClaimResult> {
  const writing = await dependencies.writer.reformulate({
    ...inputs,
    claim: toProposedResumeClaim({ claim }),
    feedback: [],
    request,
  })
  if (!writing.ok) return writing
  return validateClaimWithOneRetry({
    claimId: claim.id,
    dependencies,
    inputs,
    proposal: writing.value,
  })
}

async function validateClaimWithOneRetry({
  claimId,
  dependencies,
  inputs,
  proposal,
}: Readonly<{
  claimId: ResumeClaimId
  dependencies: ResumeClaimGenerationDependencies
  inputs: ResumeClaimWritingInputs
  proposal: ProposedResumeClaim
}>): Promise<ClaimResult> {
  const firstValidation = await validateClaim({ claimId, dependencies, inputs, proposal })
  if (!firstValidation.ok || firstValidation.claim !== null) return firstValidation
  const retryInputs = restrictInputsToProposal({ inputs, proposal })
  const rewrite = await dependencies.writer.reformulate({
    ...retryInputs, claim: proposal, feedback: firstValidation.feedback,
  })
  if (!rewrite.ok) return rewrite
  const secondValidation = await validateClaim({
    claimId, dependencies, inputs: retryInputs, proposal: rewrite.value,
  })
  return secondValidation.ok && secondValidation.claim === null
    ? { ok: true, claim: null }
    : secondValidation
}

function restrictInputsToProposal({ inputs, proposal }: Readonly<{
  inputs: ResumeClaimWritingInputs
  proposal: ProposedResumeClaim
}>) {
  const supportingFactIds = new Set(proposal.segments.flatMap(({ factIds }) => factIds))
  return {
    ...inputs,
    evidence: inputs.evidence.flatMap((item) => {
      const factIds = item.factIds.filter((factId) => supportingFactIds.has(factId))
      return factIds.length === 0 ? [] : [{ ...item, factIds }]
    }),
    verifiedFacts: inputs.verifiedFacts.filter(({ id }) => supportingFactIds.has(id)),
  }
}

async function validateClaim({
  claimId,
  dependencies,
  inputs,
  proposal,
}: Readonly<{
  claimId: ResumeClaimId
  dependencies: ResumeClaimGenerationDependencies
  inputs: ResumeClaimWritingInputs
  proposal: ProposedResumeClaim
}>) {
  const deterministic = validateProposedResumeClaim({
    claimId, proposal, verifiedFacts: inputs.verifiedFacts,
  })
  if (!deterministic.ok) return invalidClaimResult(deterministic.feedback)
  const semantic = await dependencies.semanticValidator.validate({
    claim: deterministic.value, verifiedFacts: inputs.verifiedFacts,
  })
  if (!semantic.ok) return semantic
  if (semantic.value.supported) return { ok: true, claim: deterministic.value } as const
  return invalidClaimResult(readSemanticFeedback(semantic.value.feedback))
}

function readSemanticFeedback(feedback: readonly ResumeClaimValidationFeedback[]) {
  return feedback.length === 0 ? unsupportedMeaningFeedback : feedback
}

function invalidClaimResult(feedback: readonly ResumeClaimValidationFeedback[]) {
  return { ok: true, claim: null, feedback } as const
}

const resumeClaimUnavailableResult = {
  ok: false,
  error: { type: 'resume-claim-unavailable' },
} as const
const unsupportedClaimExclusion = { reason: 'unsupported-after-regeneration' } as const
const unsupportedMeaningFeedback = [{ code: 'unsupported-meaning' }] as const
