import type {
  JobRequirement,
  ResumeClaim,
  ResumeClaimId,
  ResumeClaimSegment,
  SourceProfileFactId,
  SourceProfileFactKind,
} from '@resume-tailoring/domain/resume-tailoring-state'

import { validateProposedResumeClaim } from './resume-claims'
import type { ResumeClaimSemanticValidator } from './resume-tailoring-workflow-ports'

export type TailoredResumeTypography = 'comfortable' | 'compact' | 'dense'

export type TailoredResumeDocumentItem = Readonly<{
  claimId: ResumeClaimId
  factIds: readonly SourceProfileFactId[]
  kind: SourceProfileFactKind
  text: string
}>

export type TailoredResumeDocument = Readonly<{
  items: readonly TailoredResumeDocumentItem[]
  omittedClaimCount: number
  typography: TailoredResumeTypography
}>

export type TailoredResumeDocumentInputs = Readonly<{
  claims: readonly ResumeClaim[]
  evidence: readonly Readonly<{
    requirementId: JobRequirement['id']
    factIds: readonly SourceProfileFactId[]
  }>[]
  requirements: readonly Pick<JobRequirement, 'classification' | 'id'>[]
  verifiedFacts: readonly VerifiedResumeFact[]
}>

export type TailoredResumeLayoutMeasurer = Readonly<{
  fits: (request: Readonly<{ document: TailoredResumeDocument }>) => Promise<
    | Readonly<{ ok: true; value: boolean }>
    | Readonly<{ ok: false }>
  >
}>

export type TailoredResumePreparationFailureType =
  | 'tailored-resume-layout-unavailable'
  | 'tailored-resume-provenance-invalid'
  | 'tailored-resume-required-content-overflow'
  | 'tailored-resume-validation-unavailable'

export type TailoredResumePreparationResult =
  | Readonly<{ ok: true; value: TailoredResumeDocument }>
  | Readonly<{
      ok: false
      error: Readonly<{ type: TailoredResumePreparationFailureType }>
    }>

type VerifiedResumeFact = Readonly<{
  id: SourceProfileFactId
  kind: SourceProfileFactKind
  value: string
}>

type RankedItem = TailoredResumeDocumentItem & Readonly<{
  estimatedLines: number
  originalIndex: number
  priority: number
}>

const approximateCharactersPerLine = 88
const maximumContentLines = 30
const demonstratedImpactPattern = /(?:\b\d+(?:[.,]\d+)?\s*%|[$€£]\s*\d|\b(?:achieved|amélioré|augmenté|delivered|économisé|géré|grew|improved|increased|livré|managed|réduit|reduced|saved)\b)/iu

export async function prepareTailoredResumeDocument({
  inputs,
  layoutMeasurer,
}: Readonly<{
  inputs: TailoredResumeDocumentInputs
  layoutMeasurer: TailoredResumeLayoutMeasurer
}>): Promise<TailoredResumePreparationResult> {
  const rankedItems = rankResumeClaims(inputs)
  if (rankedItems === null || rankedItems.length === 0) return provenanceInvalidResult
  return fitRankedItems({ layoutMeasurer, rankedItems })
}

export async function prepareValidatedTailoredResumeDocument({
  inputs,
  layoutMeasurer,
  semanticValidator,
}: Readonly<{
  inputs: TailoredResumeDocumentInputs
  layoutMeasurer: TailoredResumeLayoutMeasurer
  semanticValidator: ResumeClaimSemanticValidator
}>): Promise<TailoredResumePreparationResult> {
  const preparation = await prepareTailoredResumeDocument({ inputs, layoutMeasurer })
  if (!preparation.ok) return preparation
  return validateRetainedClaims({ document: preparation.value, inputs, semanticValidator })
}

function rankResumeClaims(inputs: TailoredResumeDocumentInputs): readonly RankedItem[] | null {
  const factById = new Map(inputs.verifiedFacts.map((fact) => [fact.id, fact]))
  const classificationByFactId = createClassificationByFactId(inputs)
  const rankedItems = inputs.claims.map((claim, originalIndex) => createRankedItem({
    claim, classificationByFactId, factById, originalIndex, verifiedFacts: inputs.verifiedFacts,
  }))
  return rankedItems.some((item) => item === null)
    ? null
    : rankedItems.flatMap((item) => item === null ? [] : [item])
}

function createClassificationByFactId({ evidence, requirements }: TailoredResumeDocumentInputs) {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const classifications = new Map<SourceProfileFactId, JobRequirement['classification']>()
  for (const matchEvidence of evidence) {
    const classification = requirementById.get(matchEvidence.requirementId)?.classification
    if (classification === undefined) continue
    recordClassification({ classification, classifications, factIds: matchEvidence.factIds })
  }
  return classifications
}

function recordClassification({ classification, classifications, factIds }: Readonly<{
  classification: JobRequirement['classification']
  classifications: Map<SourceProfileFactId, JobRequirement['classification']>
  factIds: readonly SourceProfileFactId[]
}>) {
  for (const factId of factIds) {
    if (classification === 'required' || !classifications.has(factId)) {
      classifications.set(factId, classification)
    }
  }
}

function createRankedItem({
  claim, classificationByFactId, factById, originalIndex, verifiedFacts,
}: Readonly<{
  claim: ResumeClaim
  classificationByFactId: ReadonlyMap<SourceProfileFactId, JobRequirement['classification']>
  factById: ReadonlyMap<SourceProfileFactId, VerifiedResumeFact>
  originalIndex: number
  verifiedFacts: readonly VerifiedResumeFact[]
}>): RankedItem | null {
  if (!validateProposedResumeClaim({
    claimId: claim.id, proposal: { segments: claim.segments }, verifiedFacts,
  }).ok) return null
  const supportingFactIds = claim.segments.flatMap(({ factIds }) => factIds)
  const supportingFacts = readSupportingFacts({ factById, supportingFactIds })
  if (supportingFacts.length !== new Set(supportingFactIds).size) return null
  return createRankedItemValue({
    claim, classificationByFactId, originalIndex, supportingFactIds, supportingFacts,
    text: formatResumeClaimText({ segments: claim.segments }),
  })
}

function createRankedItemValue({
  claim, classificationByFactId, originalIndex, supportingFactIds, supportingFacts, text,
}: Readonly<{
  claim: ResumeClaim
  classificationByFactId: ReadonlyMap<SourceProfileFactId, JobRequirement['classification']>
  originalIndex: number
  supportingFactIds: readonly SourceProfileFactId[]
  supportingFacts: readonly VerifiedResumeFact[]
  text: string
}>): RankedItem {
  return {
    claimId: claim.id,
    factIds: [...new Set(supportingFactIds)],
    kind: supportingFacts[0]?.kind ?? 'experience',
    text,
    estimatedLines: Math.max(1, Math.ceil(text.length / approximateCharactersPerLine)) + 1,
    originalIndex,
    priority: readEditorialPriority({ classificationByFactId, supportingFacts, text }),
  }
}

function readSupportingFacts({ factById, supportingFactIds }: Readonly<{
  factById: ReadonlyMap<SourceProfileFactId, VerifiedResumeFact>
  supportingFactIds: readonly SourceProfileFactId[]
}>) {
  return supportingFactIds.flatMap((factId) => {
    const fact = factById.get(factId)
    return fact === undefined ? [] : [fact]
  })
}

function readEditorialPriority({
  classificationByFactId,
  supportingFacts,
  text,
}: Readonly<{
  classificationByFactId: ReadonlyMap<SourceProfileFactId, JobRequirement['classification']>
  supportingFacts: readonly VerifiedResumeFact[]
  text: string
}>) {
  if (supportingFacts.some(({ id }) => classificationByFactId.get(id) === 'required')) return 0
  if (demonstratedImpactPattern.test(text)
    || supportingFacts.some(({ value }) => demonstratedImpactPattern.test(value))) return 1
  if (supportingFacts.some(({ id }) => classificationByFactId.get(id) === 'preferred')) return 2
  return 3
}

async function fitRankedItems({ layoutMeasurer, rankedItems }: Readonly<{
  layoutMeasurer: TailoredResumeLayoutMeasurer
  rankedItems: readonly RankedItem[]
}>): Promise<TailoredResumePreparationResult> {
  const prioritizedItems = [...rankedItems].sort(compareEditorialPriority)
  const retainedItems = retainWithinEstimatedBudget({ prioritizedItems })
  return removeOverflowingItems({ layoutMeasurer, rankedItems, retainedItems })
}

function retainWithinEstimatedBudget({ prioritizedItems }: Readonly<{
  prioritizedItems: readonly RankedItem[]
}>) {
  const retainedItems: RankedItem[] = []
  let usedLines = 0
  for (const item of prioritizedItems) {
    if (item.priority !== 0 && usedLines + item.estimatedLines > maximumContentLines) continue
    retainedItems.push(item)
    usedLines += item.estimatedLines
  }
  return retainedItems
}

async function removeOverflowingItems({
  layoutMeasurer, rankedItems, retainedItems: initialItems,
}: Readonly<{
  layoutMeasurer: TailoredResumeLayoutMeasurer
  rankedItems: readonly RankedItem[]
  retainedItems: readonly RankedItem[]
}>): Promise<TailoredResumePreparationResult> {
  let retainedItems = initialItems
  while (retainedItems.length > 0) {
    const fit = await measureItems({ layoutMeasurer, rankedItems, retainedItems })
    if (!fit.ok) return fit
    if (fit.value) return { ok: true, value: createDocument({ rankedItems, retainedItems }) }
    const removableItem = [...retainedItems].reverse().find(({ priority }) => priority !== 0)
    if (removableItem === undefined) return requiredContentOverflowResult
    retainedItems = retainedItems.filter(({ claimId }) => claimId !== removableItem.claimId)
  }
  return provenanceInvalidResult
}

async function measureItems({ layoutMeasurer, rankedItems, retainedItems }: Readonly<{
  layoutMeasurer: TailoredResumeLayoutMeasurer
  rankedItems: readonly RankedItem[]
  retainedItems: readonly RankedItem[]
}>): Promise<
  | Readonly<{ ok: true; value: boolean }>
  | Extract<TailoredResumePreparationResult, { readonly ok: false }>
> {
  const result = await layoutMeasurer.fits({
    document: createDocument({ rankedItems, retainedItems }),
  })
  return result.ok ? result : layoutUnavailableResult
}

function createDocument({ rankedItems, retainedItems }: Readonly<{
  rankedItems: readonly RankedItem[]
  retainedItems: readonly RankedItem[]
}>): TailoredResumeDocument {
  return {
    items: restoreCandidateOrder({ items: retainedItems }),
    omittedClaimCount: rankedItems.length - retainedItems.length,
    typography: selectTypography({ retainedItems }),
  }
}

function compareEditorialPriority(leftItem: RankedItem, rightItem: RankedItem) {
  return leftItem.priority - rightItem.priority || leftItem.originalIndex - rightItem.originalIndex
}

function restoreCandidateOrder({ items }: Readonly<{ items: readonly RankedItem[] }>) {
  return removeEditorialMetadata({
    items: [...items].sort((leftItem, rightItem) => leftItem.originalIndex - rightItem.originalIndex),
  })
}

function removeEditorialMetadata({ items }: Readonly<{ items: readonly RankedItem[] }>) {
  return items.map(({ claimId, factIds, kind, text }) => ({ claimId, factIds, kind, text }))
}

function selectTypography({ retainedItems }: Readonly<{ retainedItems: readonly RankedItem[] }>) {
  const estimatedLines = retainedItems.reduce(
    (lineCount, item) => lineCount + item.estimatedLines,
    0,
  )
  if (estimatedLines <= 18) return 'comfortable'
  if (estimatedLines <= 24) return 'compact'
  return 'dense'
}

export function formatResumeClaimText({ segments }: Readonly<{
  segments: readonly ResumeClaimSegment[]
}>) {
  return segments.reduce((claimText, { text }) => {
    const normalizedText = text.trim()
    const needsSpace = claimText.length > 0 && !/^[,.;:!?%…)'\]}’]/u.test(normalizedText)
    return `${claimText}${needsSpace ? ' ' : ''}${normalizedText}`
  }, '')
}

async function validateRetainedClaims({ document, inputs, semanticValidator }: Readonly<{
  document: TailoredResumeDocument
  inputs: TailoredResumeDocumentInputs
  semanticValidator: ResumeClaimSemanticValidator
}>): Promise<TailoredResumePreparationResult> {
  const retainedClaimIds = new Set(document.items.map(({ claimId }) => claimId))
  const retainedClaims = inputs.claims.filter(({ id }) => retainedClaimIds.has(id))
  try {
    for (const claim of retainedClaims) {
      const result = await validateRetainedClaim({ claim, inputs, semanticValidator })
      if (!result.ok) return result
    }
    return { ok: true, value: document }
  } catch {
    return validationUnavailableResult
  }
}

async function validateRetainedClaim({ claim, inputs, semanticValidator }: Readonly<{
  claim: ResumeClaim
  inputs: TailoredResumeDocumentInputs
  semanticValidator: ResumeClaimSemanticValidator
}>): Promise<Readonly<{ ok: true }> | Extract<TailoredResumePreparationResult, { ok: false }>> {
  const factIds = new Set(claim.segments.flatMap(({ factIds: segmentFactIds }) => segmentFactIds))
  const verifiedFacts = inputs.verifiedFacts.filter(({ id }) => factIds.has(id))
  const result = await semanticValidator.validate({ claim, verifiedFacts })
  if (!result.ok) return validationUnavailableResult
  return result.value.supported ? { ok: true } : provenanceInvalidResult
}

const layoutUnavailableResult = {
  ok: false,
  error: { type: 'tailored-resume-layout-unavailable' },
} as const satisfies TailoredResumePreparationResult
const provenanceInvalidResult = {
  ok: false,
  error: { type: 'tailored-resume-provenance-invalid' },
} as const satisfies TailoredResumePreparationResult
const requiredContentOverflowResult = {
  ok: false,
  error: { type: 'tailored-resume-required-content-overflow' },
} as const satisfies TailoredResumePreparationResult
const validationUnavailableResult = {
  ok: false,
  error: { type: 'tailored-resume-validation-unavailable' },
} as const satisfies TailoredResumePreparationResult
