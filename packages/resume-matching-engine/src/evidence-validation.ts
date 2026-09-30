import type {
  CandidateFact,
  MatchEvidence,
  JobRequirement,
  ProposedFactMatch,
  ProposedMatchEvidence,
  ProposedRelevantFact,
} from './resume-matching-engine'
import { foldText, normalizeText } from './text-normalization'

export function validateMatchEvidence({
  candidateFacts,
  proposedEvidence,
  requirements,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  proposedEvidence: readonly ProposedMatchEvidence[]
  requirements: readonly JobRequirement[]
}>): readonly MatchEvidence[] {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const candidateFactById = new Map(candidateFacts.map((fact) => [fact.id, fact]))
  const evidenceByRequirementId = new Map<string, MatchEvidence>()
  for (const proposal of proposedEvidence) {
    if (evidenceByRequirementId.has(proposal.requirementId)) continue
    const evidence = validateEvidenceProposal({ candidateFactById, proposal, requirementById })
    if (evidence !== null) evidenceByRequirementId.set(proposal.requirementId, evidence)
  }
  return [...evidenceByRequirementId.values()]
}

export function validateRelevantFactProposals({
  candidateFacts, proposals, requirements,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  proposals: readonly ProposedRelevantFact[]
  requirements: readonly JobRequirement[]
}>): readonly string[] {
  const candidateFactById = new Map(candidateFacts.map((fact) => [fact.id, fact]))
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  return [...new Set(proposals.flatMap((proposal) => {
    const fact = candidateFactById.get(proposal.factMatch.factId)
    const requirement = requirementById.get(proposal.requirementId)
    return fact !== undefined && requirement !== undefined
      && provesRelevance({ fact, factMatch: proposal.factMatch, requirement }) ? [fact.id] : []
  }))]
}

function validateEvidenceProposal({ candidateFactById, proposal, requirementById }: Readonly<{
  candidateFactById: ReadonlyMap<string, CandidateFact>
  proposal: ProposedMatchEvidence
  requirementById: ReadonlyMap<string, JobRequirement>
}>): MatchEvidence | null {
  const requirement = requirementById.get(proposal.requirementId)
  const factIds = proposal.factMatches.map(({ factId }) => factId)
  if (requirement === undefined || factIds.length === 0 || new Set(factIds).size !== factIds.length) {
    return null
  }
  const proofs = proposal.factMatches.map((factMatch) => {
    const fact = candidateFactById.get(factMatch.factId)
    return fact === undefined ? null : readRequirementProof({ fact, factMatch, requirement })
  })
  if (proofs.some((proof) => proof === null)) return null
  if (proposal.coverage === 'covered' && proofs.some((proof) => proof?.reachesQuantities !== true)) return null
  const showsQualifiers = proofs.every((proof) => proof?.showsQualifiers === true)
  return {
    coverage: proposal.coverage === 'covered' && showsQualifiers ? 'covered' : 'partially-covered',
    factIds,
    requirementId: proposal.requirementId,
  }
}

type RequirementProofInput = Readonly<{
  fact: CandidateFact
  factMatch: ProposedFactMatch
  requirement: JobRequirement
}>

function readRequirementProof({ fact, factMatch, requirement }: RequirementProofInput) {
  if (!provesRelevance({ fact, factMatch, requirement })) return null
  const factContext = readExcerptContext({ excerpt: factMatch.factExcerpt, value: fact.value })
  return {
    reachesQuantities: reachesDuration({ factContext, requirementValue: requirement.value })
      && reachesScale({ factContext, requirementValue: requirement.value }),
    showsQualifiers: showsQualitativeConstraints({ factContext, requirementValue: requirement.value }),
  }
}

function provesRelevance({ fact, factMatch, requirement }: RequirementProofInput) {
  return containsTerm({ content: fact.value, term: factMatch.factExcerpt })
    && containsTerm({ content: requirement.value, term: factMatch.requirementExcerpt })
    && !rejectsCandidateFact({ fact, factExcerpt: factMatch.factExcerpt })
}

function rejectsCandidateFact({ fact, factExcerpt }: Readonly<{
  fact: CandidateFact
  factExcerpt: string
}>) {
  if (nonEvidenceTerms.has(normalizeTerm({ value: factExcerpt })) || hasNegatedEvidence({ fact })) return true
  return fact.kind === 'experience' && isLikelyRoleTitle({
    factContext: readExcerptContext({ excerpt: factExcerpt, value: fact.value }), factExcerpt,
  })
}

function hasNegatedEvidence({ fact }: Readonly<{ fact: CandidateFact }>) {
  return negativeTerms.some((negativeTerm) => containsTerm({
    content: fact.value,
    term: negativeTerm,
  }))
}

// The smallest run of clauses containing the excerpt binds durations, scales, and
// qualifiers to the cited capability instead of to another clause of the same fact.
function readExcerptContext({ excerpt, value }: Readonly<{ excerpt: string; value: string }>) {
  const parts = value.split(clauseSeparatorPattern)
  const clauseCount = Math.ceil(parts.length / 2)
  for (let width = 1; width <= clauseCount; width += 1) {
    for (let first = 0; first + width <= clauseCount; first += 1) {
      const context = parts.slice(first * 2, (first + width) * 2 - 1).join('')
      if (containsTerm({ content: context, term: excerpt })) return context
    }
  }
  return value
}

function showsQualitativeConstraints({ factContext, requirementValue }: Readonly<{
  factContext: string
  requirementValue: string
}>) {
  return qualitativeRequirementTerms.every((qualifier) =>
    !containsTerm({ content: requirementValue, term: qualifier })
    || containsTerm({ content: factContext, term: qualifier })
    || satisfiesLevelConstraint({ factContext, requiredLevel: qualifier }))
}

function satisfiesLevelConstraint({ factContext, requiredLevel }: Readonly<{
  factContext: string
  requiredLevel: string
}>) {
  const requiredRank = careerLevelRanks.get(requiredLevel)
  if (requiredRank === undefined) return false
  const factRank = careerLevelTerms.reduce((highestRank, level) =>
    containsTerm({ content: factContext, term: level })
      ? Math.max(highestRank, careerLevelRanks.get(level) ?? 0) : highestRank, 0)
  return factRank >= requiredRank
}

function reachesDuration({ factContext, requirementValue }: Readonly<{
  factContext: string
  requirementValue: string
}>) {
  const requiredMonths = readLongestDurationInMonths({ value: requirementValue })
  if (requiredMonths === null) return true
  const factMonths = readLongestDurationInMonths({ value: factContext })
  return factMonths !== null && factMonths >= requiredMonths
}

function readLongestDurationInMonths({ value }: Readonly<{ value: string }>) {
  const months = readDurations({ value: normalizeTerm({ value }) }).map((duration) => duration.months)
  return months.length === 0 ? null : Math.max(...months)
}

function reachesScale({ factContext, requirementValue }: Readonly<{
  factContext: string
  requirementValue: string
}>) {
  const requiredScales = readScales({ value: normalizeScaleText({ value: requirementValue }) })
  const factScales = readScales({ value: normalizeScaleText({ value: factContext }) })
  return requiredScales.every((requiredScale) => factScales.some((factScale) =>
    factScale.unit === requiredScale.unit && factScale.amount >= requiredScale.amount))
}

function readDurations({ value }: Readonly<{ value: string }>) {
  return [...value.matchAll(durationPattern)].flatMap((match) => {
    const amount = match[1] === undefined ? Number.NaN : Number(match[1])
    const unit = match[2]
    if (!Number.isFinite(amount) || unit === undefined) return []
    const months = unit.startsWith('year') || unit.startsWith('yr')
      || unit.startsWith('an') ? amount * 12 : amount
    return [{ months }]
  })
}

function readScales({ value }: Readonly<{ value: string }>) {
  return [...value.matchAll(scalePattern)].flatMap((match) => {
    const baseAmount = match[1] === undefined ? Number.NaN : Number(match[1])
    const magnitude = match[2]
    const unit = match[3]
    if (!Number.isFinite(baseAmount) || unit === undefined) return []
    return [{ amount: baseAmount * readScaleMultiplier({ magnitude }), unit: normalizeScaleUnit({ unit }) }]
  })
}

function normalizeScaleUnit({ unit }: Readonly<{ unit: string }>) {
  return unit.endsWith('s') ? unit.slice(0, -1) : unit
}

function normalizeScaleText({ value }: Readonly<{ value: string }>) {
  return foldText({ value }).replaceAll(/(\d),(\d)/gu, '$1.$2')
    .replaceAll(/[^a-z0-9+#.]+/gu, ' ').trim()
}

function isLikelyRoleTitle({ factContext, factExcerpt }: Readonly<{
  factContext: string
  factExcerpt: string
}>) {
  if (!hasTitleLikeStart({ factContext, factExcerpt })) return false
  const words = factContext.match(/\p{L}[\p{L}\p{M}+#.-]*/gu) ?? []
  const titleWords = words.filter((word) => !titleConnectorTerms.has(normalizeTerm({ value: word })))
  if (titleWords.length === 0) return false
  const titleCaseWords = titleWords.filter((word) => /^\p{Lu}/u.test(word))
  return titleCaseWords.length / titleWords.length >= 0.75
}

function hasTitleLikeStart({ factContext, factExcerpt }: Readonly<{
  factContext: string
  factExcerpt: string
}>) {
  const normalizedContext = normalizeTerm({ value: factContext })
  const normalizedExcerpt = normalizeTerm({ value: factExcerpt })
  return normalizedContext === normalizedExcerpt
    || normalizedContext.startsWith(`${normalizedExcerpt} `)
    || careerLevelTerms.some((level) => normalizedContext.startsWith(`${level} `))
}

function readScaleMultiplier({ magnitude }: Readonly<{ magnitude: string | undefined }>) {
  if (magnitude === 'm' || magnitude?.startsWith('million') === true) return 1_000_000
  if (magnitude === 'k' || magnitude?.startsWith('thousand') === true) return 1_000
  return 1
}

function containsTerm({ content, term }: Readonly<{ content: string; term: string }>) {
  const normalizedContent = ` ${normalizeTerm({ value: content })} `
  const normalizedTerm = normalizeTerm({ value: term })
  return normalizedTerm.length > 1 && normalizedContent.includes(` ${normalizedTerm} `)
}

const normalizeTerm = normalizeText
const nonEvidenceTerms = new Set([
  'advanced', 'expert', 'junior', 'lead', 'mid level', 'senior',
])
const negativeTerms = ['aucun', 'jamais', 'no', 'not', 'never', 'pas', 'sans', 'without'] as const
const qualitativeRequirementTerms = [
  'advanced', 'expert', 'junior', 'lead', 'mid', 'middle', 'principal', 'production', 'senior',
  'staff',
] as const
const careerLevelTerms = ['junior', 'mid', 'middle', 'senior', 'lead', 'staff', 'principal'] as const
const careerLevelRanks = new Map<string, number>([
  ['junior', 1], ['mid', 2], ['middle', 2], ['senior', 3],
  ['lead', 4], ['staff', 4], ['principal', 5],
])
const clauseSeparatorPattern = /([,;\n]|[.!?](?:\s+|$)|\b(?:and|et|qui|who)\b)/iu
const durationPattern = /\b(\d+)\s*\+?\s*(years?|yrs?|ans?|months?|mois)\b/gu
const scalePattern = /\b(\d+(?:[.,]\d+)?)\s*(k|m|millions?|thousands?)?\s*(users?|requests?|transactions?|people|engineers?|developers?)\b/gu
const titleConnectorTerms = new Set(['at', 'chez', 'de', 'of'])
