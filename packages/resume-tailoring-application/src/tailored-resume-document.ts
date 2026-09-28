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
  pageCount: 1 | 2
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
  | 'tailored-resume-content-overflow'
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
  classification: JobRequirement['classification'] | null
  estimatedLines: number
  originalIndex: number
  priority: number
}>

const approximateCharactersPerLine = 88
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
  const classification = readRequirementClassification({ classificationByFactId, supportingFacts })
  return {
    claimId: claim.id,
    classification,
    factIds: [...new Set(supportingFactIds)],
    kind: supportingFacts[0]?.kind ?? 'experience',
    text,
    estimatedLines: Math.max(1, Math.ceil(text.length / approximateCharactersPerLine)) + 1,
    originalIndex,
    priority: readEditorialPriority({ classification, supportingFacts, text }),
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

function readRequirementClassification({ classificationByFactId, supportingFacts }: Readonly<{
  classificationByFactId: ReadonlyMap<SourceProfileFactId, JobRequirement['classification']>
  supportingFacts: readonly VerifiedResumeFact[]
}>) {
  if (supportingFacts.some(({ id }) => classificationByFactId.get(id) === 'required')) {
    return 'required' as const
  }
  return supportingFacts.some(({ id }) => classificationByFactId.get(id) === 'preferred')
    ? 'preferred' as const : null
}

function readEditorialPriority({ classification, supportingFacts, text }: Readonly<{
  classification: JobRequirement['classification'] | null
  supportingFacts: readonly VerifiedResumeFact[]
  text: string
}>) {
  if (classification === 'required') return 0
  if (demonstratedImpactPattern.test(text)
    || supportingFacts.some(({ value }) => demonstratedImpactPattern.test(value))) return 1
  if (classification === 'preferred') return 2
  return 3
}

async function fitRankedItems({ layoutMeasurer, rankedItems }: Readonly<{
  layoutMeasurer: TailoredResumeLayoutMeasurer
  rankedItems: readonly RankedItem[]
}>): Promise<TailoredResumePreparationResult> {
  const prioritizedItems = [...rankedItems].sort(compareEditorialPriority)
  const onePageResult = await removeOverflowingItems({
    layoutMeasurer, pageCount: 1, rankedItems, retainedItems: prioritizedItems,
  })
  if (!onePageResult.ok) {
    if (onePageResult.error.type !== 'tailored-resume-required-content-overflow') {
      return onePageResult
    }
    return removeOverflowingItems({
      layoutMeasurer, pageCount: 2, rankedItems, retainedItems: prioritizedItems,
    })
  }
  if (!shouldUseSecondPage({ document: onePageResult.value, rankedItems })) return onePageResult
  const twoPageResult = await removeOverflowingItems({
    layoutMeasurer, pageCount: 2, rankedItems, retainedItems: prioritizedItems,
  })
  return twoPageResult
}

async function removeOverflowingItems({
  layoutMeasurer, pageCount, rankedItems, retainedItems: initialItems,
}: Readonly<{
  layoutMeasurer: TailoredResumeLayoutMeasurer
  pageCount: 1 | 2
  rankedItems: readonly RankedItem[]
  retainedItems: readonly RankedItem[]
}>): Promise<TailoredResumePreparationResult> {
  let retainedItems = initialItems
  while (retainedItems.length > 0) {
    const fit = await measureItems({ layoutMeasurer, pageCount, rankedItems, retainedItems })
    if (!fit.ok) return fit
    if (fit.value) {
      return { ok: true, value: createDocument({ pageCount, rankedItems, retainedItems }) }
    }
    const removableItem = [...retainedItems].reverse().find(({ priority }) => priority !== 0)
    if (removableItem === undefined) return requiredContentOverflowResult
    retainedItems = retainedItems.filter(({ claimId }) => claimId !== removableItem.claimId)
  }
  return contentOverflowResult
}

async function measureItems({ layoutMeasurer, pageCount, rankedItems, retainedItems }: Readonly<{
  layoutMeasurer: TailoredResumeLayoutMeasurer
  pageCount: 1 | 2
  rankedItems: readonly RankedItem[]
  retainedItems: readonly RankedItem[]
}>): Promise<
  | Readonly<{ ok: true; value: boolean }>
  | Extract<TailoredResumePreparationResult, { readonly ok: false }>
> {
  const result = await layoutMeasurer.fits({
    document: createDocument({ pageCount, rankedItems, retainedItems }),
  })
  return result.ok ? result : layoutUnavailableResult
}

function createDocument({ pageCount, rankedItems, retainedItems }: Readonly<{
  pageCount: 1 | 2
  rankedItems: readonly RankedItem[]
  retainedItems: readonly RankedItem[]
}>): TailoredResumeDocument {
  return {
    items: restoreCandidateOrder({ items: retainedItems }),
    omittedClaimCount: rankedItems.length - retainedItems.length,
    pageCount,
    typography: selectTypography({ retainedItems }),
  }
}

function shouldUseSecondPage({ document, rankedItems }: Readonly<{
  document: TailoredResumeDocument
  rankedItems: readonly RankedItem[]
}>) {
  const retainedClaimIds = new Set(document.items.map(({ claimId }) => claimId))
  const omittedItems = rankedItems.filter(({ claimId }) => !retainedClaimIds.has(claimId))
  return omittedItems.some(({ classification }) => classification === 'required')
    || omittedItems.filter(({ classification }) => classification === 'preferred').length >= 2
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
const contentOverflowResult = {
  ok: false,
  error: { type: 'tailored-resume-content-overflow' },
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
