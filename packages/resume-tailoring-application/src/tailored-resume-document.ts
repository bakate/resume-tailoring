import type {
  JobRequirement,
  MatchAnalysis,
  ResumeClaim,
  ResumeClaimId,
  SourceProfileFact,
  SourceProfileFactId,
  SourceProfileFactKind,
} from '@resume-tailoring/domain/resume-tailoring-state'

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

type DocumentInputs = Readonly<{
  claims: readonly ResumeClaim[]
  facts: readonly SourceProfileFact[]
  matchAnalysis: MatchAnalysis
  requirements: readonly JobRequirement[]
}>

type RankedItem = TailoredResumeDocumentItem & Readonly<{
  estimatedLines: number
  originalIndex: number
  priority: number
}>

const maximumContentLines = 30
const approximateCharactersPerLine = 88
const demonstratedImpactPattern = /(?:\b\d+(?:[.,]\d+)?\s*%|[$€£]\s*\d|\b(?:achieved|amélioré|augmenté|delivered|économisé|géré|grew|improved|increased|livré|managed|réduit|reduced|saved)\b)/iu

export function prepareTailoredResumeDocument(
  inputs: DocumentInputs,
): TailoredResumeDocument | null {
  const rankedItems = rankResumeClaims(inputs)
  if (rankedItems === null) return null
  const retainedItems = retainWithinPageBudget({ rankedItems })
  const omittedClaimCount = inputs.claims.length - retainedItems.length
  return {
    items: restoreCandidateOrder({ items: retainedItems }),
    omittedClaimCount,
    typography: selectTypography({ retainedItems }),
  }
}

function rankResumeClaims(inputs: DocumentInputs): readonly RankedItem[] | null {
  const factById = new Map(inputs.facts
    .filter(({ status }) => status === 'verified')
    .map((fact) => [fact.id, fact]))
  const classificationByFactId = createClassificationByFactId(inputs)
  const rankedItems = inputs.claims.map((claim, originalIndex) => createRankedItem({
    claim, classificationByFactId, factById, originalIndex,
  }))
  return rankedItems.some((item) => item === null)
    ? null
    : rankedItems.flatMap((item) => item === null ? [] : [item])
}

function createClassificationByFactId({ matchAnalysis, requirements }: DocumentInputs) {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const classifications = new Map<SourceProfileFactId, JobRequirement['classification']>()
  for (const evidence of matchAnalysis.evidence) {
    const classification = requirementById.get(evidence.requirementId)?.classification
    if (classification === undefined) continue
    for (const factId of evidence.factIds) {
      if (classification === 'required' || !classifications.has(factId)) {
        classifications.set(factId, classification)
      }
    }
  }
  return classifications
}

function createRankedItem({
  claim,
  classificationByFactId,
  factById,
  originalIndex,
}: Readonly<{
  claim: ResumeClaim
  classificationByFactId: ReadonlyMap<SourceProfileFactId, JobRequirement['classification']>
  factById: ReadonlyMap<SourceProfileFactId, SourceProfileFact>
  originalIndex: number
}>): RankedItem | null {
  const supportingFactIds = claim.segments.flatMap(({ factIds }) => factIds)
  const supportingFacts = readSupportingFacts({ factById, supportingFactIds })
  if (supportingFacts.length !== new Set(supportingFactIds).size) return null
  const text = formatResumeClaimText({ claim })
  return createRankedItemValue({
    claim, classificationByFactId, originalIndex, supportingFactIds, supportingFacts, text,
  })
}

function createRankedItemValue({
  claim, classificationByFactId, originalIndex, supportingFactIds, supportingFacts, text,
}: Readonly<{
  claim: ResumeClaim
  classificationByFactId: ReadonlyMap<SourceProfileFactId, JobRequirement['classification']>
  originalIndex: number
  supportingFactIds: readonly SourceProfileFactId[]
  supportingFacts: readonly SourceProfileFact[]
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
  factById: ReadonlyMap<SourceProfileFactId, SourceProfileFact>
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
  supportingFacts: readonly SourceProfileFact[]
  text: string
}>) {
  if (supportingFacts.some(({ id }) => classificationByFactId.get(id) === 'required')) return 0
  if (demonstratedImpactPattern.test(text)
    || supportingFacts.some(({ value }) => demonstratedImpactPattern.test(value))) return 1
  if (supportingFacts.some(({ id }) => classificationByFactId.get(id) === 'preferred')) return 2
  return 3
}

function retainWithinPageBudget({ rankedItems }: Readonly<{
  rankedItems: readonly RankedItem[]
}>) {
  const prioritizedItems = [...rankedItems].sort((leftItem, rightItem) =>
    leftItem.priority - rightItem.priority || leftItem.originalIndex - rightItem.originalIndex)
  const retainedItems: RankedItem[] = []
  let usedLines = 0
  for (const item of prioritizedItems) {
    if (item.priority === 0) {
      retainedItems.push(item)
      usedLines += item.estimatedLines
      continue
    }
    if (usedLines + item.estimatedLines > maximumContentLines) continue
    retainedItems.push(item)
    usedLines += item.estimatedLines
  }
  return retainedItems
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

export function formatResumeClaimText({ claim }: Readonly<{ claim: ResumeClaim }>) {
  return claim.segments.reduce((claimText, { text }) => {
    const normalizedText = text.trim()
    const needsSpace = claimText.length > 0 && !/^[,.;:!?%…)'\]}’]/u.test(normalizedText)
    return `${claimText}${needsSpace ? ' ' : ''}${normalizedText}`
  }, '')
}
