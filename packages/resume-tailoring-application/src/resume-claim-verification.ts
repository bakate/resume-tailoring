/**
 * Verifies Tailored Resume wording against Candidate Facts. Structural rules run here before any content is sent; the
 * model ports only judge or reword one claim at a time.
 */
import type { CandidateFact } from '@resume-tailoring/domain/source-intake'
import type { TailoredResumeField, TailoredResumeLocale } from '@resume-tailoring/domain/tailored-resume'
import type { ResumeClaimModelFailure, ResumeDocumentPorts } from './ports'
import { validateProposedResumeClaim } from './resume-claims'
import type { ResumeClaimWritingInputs } from './resume-claims'

type ClaimModels = Pick<ResumeDocumentPorts, 'validateClaim'>

export type ResumeFieldVerification =
  | Readonly<{ status: 'supported' }>
  | Readonly<{ status: 'unsupported' }>
  | Readonly<{ status: 'failed'; error: ResumeClaimModelFailure }>

export type ResumeFieldCondensation =
  | Readonly<{ status: 'condensed'; field: TailoredResumeField }>
  | Readonly<{ status: 'unsupported' }>
  | Readonly<{ status: 'failed'; error: ResumeClaimModelFailure }>

/**
 * A field is supported only by the attested Candidate Facts it cites: it must pass the structural claim rules before
 * its meaning is sent for semantic validation.
 */
export async function verifyResumeField({ models, candidateFacts, field }: Readonly<{
  models: ClaimModels; candidateFacts: readonly CandidateFact[]; field: TailoredResumeField
}>): Promise<ResumeFieldVerification> {
  const verifiedFacts = readVerifiedFacts({ candidateFacts, field })
  const claim = validateProposedResumeClaim({ claimId: `resume-claim-${field.id}`,
    proposal: { segments: [{ text: field.text, factIds: field.factIds }] }, verifiedFacts })
  if (!claim.ok) return { status: 'unsupported' }
  const result = await models.validateClaim({ claim: claim.value, verifiedFacts })
  if (!result.ok) return { status: 'failed', error: result.error }
  return result.value.supported ? { status: 'supported' } : { status: 'unsupported' }
}

/**
 * Shorter wording replaces a field only when it keeps exactly the field's fact references and means the same thing
 * in both directions: the condensed text is supported by the facts, and the original text is supported by the
 * condensed text, so no evidence is dropped and no meaning is strengthened.
 */
export async function condenseResumeField({ models, candidateFacts, field, locale }: Readonly<{
  models: ClaimModels & Pick<ResumeDocumentPorts, 'condenseClaim'>
  candidateFacts: readonly CandidateFact[]
  field: TailoredResumeField
  locale: TailoredResumeLocale
}>): Promise<ResumeFieldCondensation> {
  const result = await models.condenseClaim({ claim: { segments: [{ text: field.text, factIds: field.factIds }] },
    locale, verifiedFacts: readVerifiedFacts({ candidateFacts, field }) })
  if (!result.ok) return { status: 'failed', error: result.error }
  const references = new Set(result.value.segments.flatMap(({ factIds }) => factIds))
  if (references.size !== field.factIds.length || field.factIds.some((factId) => !references.has(factId))) {
    return { status: 'unsupported' }
  }
  const condensed = { ...field, text: result.value.segments.map(({ text }) => text.trim()).join(' ') }
  const forward = await verifyResumeField({ models, candidateFacts, field: condensed })
  if (forward.status !== 'supported') return forward
  const reverse = await verifyResumeField({ models, field: { ...field, factIds: [condensedEvidenceId] },
    candidateFacts: [{ id: condensedEvidenceId, path: 'experiences.0.achievements.0', status: 'attested', value: condensed.text }] })
  return reverse.status === 'supported' ? { status: 'condensed', field: condensed } : reverse
}

const condensedEvidenceId = 'source-fact-condensed-evidence'

function readVerifiedFacts({ candidateFacts, field }: Readonly<{
  candidateFacts: readonly CandidateFact[]; field: TailoredResumeField
}>): ResumeClaimWritingInputs['verifiedFacts'] {
  return candidateFacts.filter(({ id, status }) => status === 'attested' && field.factIds.includes(id))
    .map(({ id, path, value }) => ({ id, value, kind: readFactKind({ path }) }))
}

function readFactKind({ path }: Readonly<{ path: string }>): ResumeClaimWritingInputs['verifiedFacts'][number]['kind'] {
  if (path.startsWith('skills.')) return 'skill'
  if (path.startsWith('education.') || path.startsWith('certifications.')) return 'education'
  if (path.startsWith('languages.')) return 'language'
  return path.startsWith('projects.') ? 'project' : 'experience'
}
