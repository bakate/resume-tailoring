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
  const supports = proposal.factMatches.map((factMatch) => {
    const fact = candidateFactById.get(factMatch.factId)
    return fact === undefined ? null : readEvidenceSupport({ fact, factMatch, requirement })
  })
  if (supports.some((support) => support === null)) return null
  const weakestSupport = evidenceSupports.findLast((support) => supports.includes(support)) ?? 'full'
  if (proposal.coverage === 'covered' && weakestSupport === 'short-quantity') return null
  return {
    coverage: proposal.coverage === 'covered' && weakestSupport === 'full' ? 'covered' : 'partially-covered',
    factIds,
    requirementId: proposal.requirementId,
  }
}

type RequirementProofInput = Readonly<{
  fact: CandidateFact
  factMatch: ProposedFactMatch
  requirement: JobRequirement
}>

// How far one cited fact supports its requirement, from strongest to weakest: full coverage,
// a missing qualitative qualifier, or an explicit duration or scale that the fact does not reach.
const evidenceSupports = ['full', 'missing-qualifier', 'short-quantity'] as const
type EvidenceSupport = typeof evidenceSupports[number]

function readEvidenceSupport({ fact, factMatch, requirement }: RequirementProofInput): EvidenceSupport | null {
  if (!provesRelevance({ fact, factMatch, requirement })) return null
  const factContext = readExcerptContext({
    excerpt: factMatch.factExcerpt, separatorPattern: constraintSeparatorPattern, value: fact.value,
  })
  const requirementContext = readExcerptContext({
    excerpt: factMatch.requirementExcerpt, separatorPattern: sentenceSeparatorPattern, value: requirement.value,
  })
  if (!reachesQuantities({ factContext, requirementContext })) return 'short-quantity'
  return showsQualitativeConstraints({ factContext, requirementContext }) ? 'full' : 'missing-qualifier'
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
  if (nonEvidenceTerms.has(normalizeText({ value: factExcerpt }))) return true
  const clause = readExcerptContext({ excerpt: factExcerpt, separatorPattern: clauseSeparatorPattern, value: fact.value })
  if (isNegatedBeforeExcerpt({ clause, factExcerpt })) return true
  return fact.kind === 'experience' && isLikelyRoleTitle({ factContext: clause, factExcerpt })
}

function isNegatedBeforeExcerpt({ clause, factExcerpt }: Readonly<{ clause: string; factExcerpt: string }>) {
  const normalizedClause = ` ${normalizeText({ value: clause })} `
  const excerptIndex = normalizedClause.indexOf(` ${normalizeText({ value: factExcerpt })} `)
  const precedingText = normalizedClause.slice(0, excerptIndex + 1)
  return negativeTerms.some((negativeTerm) => precedingText.includes(` ${negativeTerm} `))
}

// Returns the smallest run of segments of `value` that contains the excerpt. The separator
// pattern has one capture group, so `split` keeps each separator at an odd index between segments.
function readExcerptContext({ excerpt, separatorPattern, value }: Readonly<{
  excerpt: string
  separatorPattern: RegExp
  value: string
}>) {
  const parts = value.split(separatorPattern)
  const segmentCount = Math.ceil(parts.length / 2)
  for (let width = 1; width <= segmentCount; width += 1) {
    for (let first = 0; first + width <= segmentCount; first += 1) {
      const context = parts.slice(first * 2, (first + width) * 2 - 1).join('')
      if (containsTerm({ content: context, term: excerpt })) return context
    }
  }
  return value
}

function showsQualitativeConstraints({ factContext, requirementContext }: Readonly<{
  factContext: string
  requirementContext: string
}>) {
  return qualitativeRequirementTerms.every((qualifier) =>
    !requiresQualifier({ qualifier, requirementContext })
    || containsTerm({ content: factContext, term: qualifier })
    || satisfiesLevelConstraint({ factContext, requiredLevel: qualifier }))
}

function requiresQualifier({ qualifier, requirementContext }: Readonly<{
  qualifier: string
  requirementContext: string
}>) {
  if (!containsTerm({ content: requirementContext, term: qualifier })) return false
  // "Lead the migration" asks for an activity, not a lead-level role.
  return qualifier !== 'lead' || !leadAsVerbPattern.test(` ${normalizeText({ value: requirementContext })} `)
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

function reachesQuantities({ factContext, requirementContext }: Readonly<{
  factContext: string
  requirementContext: string
}>) {
  return reachesDuration({ factContext, requirementContext }) && reachesScales({ factContext, requirementContext })
}

function reachesDuration({ factContext, requirementContext }: Readonly<{
  factContext: string
  requirementContext: string
}>) {
  const requiredMonths = readLongestDurationInMonths({ value: requirementContext })
  if (requiredMonths === null) return true
  const factMonths = readLongestDurationInMonths({ value: factContext })
  return factMonths !== null && factMonths >= requiredMonths
}

function readLongestDurationInMonths({ value }: Readonly<{ value: string }>) {
  const months = readDurations({ value: normalizeText({ value }) }).map((duration) => duration.months)
  return months.length === 0 ? null : Math.max(...months)
}

function reachesScales({ factContext, requirementContext }: Readonly<{
  factContext: string
  requirementContext: string
}>) {
  const factScales = readScales({ value: normalizeScaleText({ value: factContext }) })
  return readScales({ value: normalizeScaleText({ value: requirementContext }) }).every((requiredScale) =>
    factScales.some(({ amount, unit }) => unit === requiredScale.unit && amount >= requiredScale.amount))
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
  return foldText({ value }).replaceAll(thousandsSeparatorPattern, '').replaceAll(/(\d),(\d)/gu, '$1.$2')
    .replaceAll(/[^a-z0-9+#.]+/gu, ' ').trim()
}

function isLikelyRoleTitle({ factContext, factExcerpt }: Readonly<{
  factContext: string
  factExcerpt: string
}>) {
  if (!hasTitleLikeStart({ factContext, factExcerpt })) return false
  const words = factContext.match(/\p{L}[\p{L}\p{M}+#.-]*/gu) ?? []
  const titleWords = words.filter((word) => !titleConnectorTerms.has(normalizeText({ value: word })))
  if (titleWords.length === 0) return false
  const titleCaseWords = titleWords.filter((word) => /^\p{Lu}/u.test(word))
  return titleCaseWords.length / titleWords.length >= 0.75
}

function hasTitleLikeStart({ factContext, factExcerpt }: Readonly<{
  factContext: string
  factExcerpt: string
}>) {
  const normalizedContext = normalizeText({ value: factContext })
  const normalizedExcerpt = normalizeText({ value: factExcerpt })
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
  const normalizedContent = ` ${normalizeText({ value: content })} `
  const normalizedTerm = normalizeText({ value: term })
  return normalizedTerm.length > 1 && normalizedContent.includes(` ${normalizedTerm} `)
}

const nonEvidenceTerms = new Set([
  'advanced', 'expert', 'junior', 'lead', 'mid level', 'senior',
])
const negativeTerms = ['aucun', 'jamais', 'no', 'not', 'never', 'pas', 'sans', 'without'] as const
const qualitativeRequirementTerms = [
  'advanced', 'expert', 'junior', 'lead', 'mid', 'middle', 'principal', 'production', 'senior',
  'staff',
] as const
const careerLevelRanks = new Map<string, number>([
  ['junior', 1], ['mid', 2], ['middle', 2], ['senior', 3],
  ['lead', 4], ['staff', 4], ['principal', 5],
])
const careerLevelTerms = [...careerLevelRanks.keys()]
const clauseSeparatorPattern = /(,(?!\d)|[;\n]|[.!?](?:\s+|$)|\b(?:and|et|qui|who)\b)/iu
// Constraints stay bound across relative clauses ("Senior engineer who built…"), and a
// comma between digits separates thousands, not clauses.
const constraintSeparatorPattern = /(,(?!\d)|[;\n]|[.!?](?:\s+|$)|\b(?:and|et)\b)/iu
const sentenceSeparatorPattern = /([;\n]|[.!?](?:\s+|$))/u
const leadAsVerbPattern = / lead (?:a|an|our|the|their|your|d|des|l|la|le|les|un|une) /u
// A range such as "3-5 years" or "3 à 5 ans" requires its lower bound.
const durationPattern = /\b(\d+)(?:\s+(?:to\s+|a\s+)?\d+)?\s*\+?\s*(years?|yrs?|ans?|months?|mois)\b/gu
// "20,000" and "20 000" are one number; "1,5" stays a decimal comma.
const thousandsSeparatorPattern = /(?<=\d)[,\s](?=\d{3}(?!\d))/gu
const scalePattern = /\b(\d+(?:[.,]\d+)?)\s*(k|m|millions?|thousands?)?\s*(users?|requests?|transactions?|people|engineers?|developers?)\b/gu
const titleConnectorTerms = new Set(['at', 'chez', 'de', 'of'])
