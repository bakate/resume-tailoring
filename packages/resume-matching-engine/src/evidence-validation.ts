import type {
  CandidateFact,
  MatchEvidence,
  JobRequirement,
  ProposedFactMatch,
  ProposedMatchEvidence,
} from './resume-matching-engine'
import { canonicalizeKnownTerm, foldText, normalizeText } from './text-normalization'

export function validateMatchEvidence({
  candidateFacts,
  proposedEvidence,
  requirements,
}: Readonly<{
  candidateFacts: readonly CandidateFact[]
  proposedEvidence: readonly ProposedMatchEvidence[]
  requirements: readonly JobRequirement[]
}>) {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const candidateFactById = new Map(candidateFacts.map((fact) => [fact.id, fact]))
  const referencedRequirementIds = new Set<string>()
  const evidence = proposedEvidence.map((proposal) => validateEvidenceProposal({
    candidateFactById, proposal, referencedRequirementIds, requirementById,
  }))
  const validEvidence = evidence.filter((item) => item !== null)
  return proposedEvidence.length > 0 && validEvidence.length === 0 ? null : validEvidence
}

type EvidenceProposalValidation = Readonly<{
  candidateFactById: ReadonlyMap<string, CandidateFact>
  proposal: ProposedMatchEvidence
  referencedRequirementIds: Set<string>
  requirementById: ReadonlyMap<string, JobRequirement>
}>

function validateEvidenceProposal({
  candidateFactById, proposal, referencedRequirementIds, requirementById,
}: EvidenceProposalValidation): MatchEvidence | null {
  const requirement = requirementById.get(proposal.requirementId)
  if (requirement === undefined || referencedRequirementIds.has(proposal.requirementId)) return null
  referencedRequirementIds.add(proposal.requirementId)
  if (!hasValidFactMatches({
    coverage: proposal.coverage,
    candidateFactById,
    factMatches: proposal.factMatches,
    requirement,
  })) {
    return null
  }
  return { coverage: proposal.coverage, requirementId: proposal.requirementId,
    factIds: proposal.factMatches.map(({ factId }) => factId) }
}

function hasValidFactMatches({ candidateFactById, coverage, factMatches, requirement }: Readonly<{
  candidateFactById: ReadonlyMap<string, CandidateFact>
  coverage: ProposedMatchEvidence['coverage']
  factMatches: readonly ProposedFactMatch[]
  requirement: JobRequirement
}>) {
  if (factMatches.length === 0) return false
  const factIds = new Set(factMatches.map(({ factId }) => factId))
  if (factIds.size !== factMatches.length) return false
  return factMatches.every((factMatch) => {
    const fact = candidateFactById.get(factMatch.factId)
    return fact !== undefined && provesRequirement({ coverage, factMatch, fact, requirement })
  })
}

type RequirementProof = Readonly<{
  coverage: ProposedMatchEvidence['coverage']
  fact: CandidateFact
  factMatch: ProposedFactMatch
  requirement: JobRequirement
}>

function provesRequirement({ coverage, fact, factMatch, requirement }: RequirementProof) {
  if (!containsProposedTerms({ fact, factMatch, requirement })) return false
  const factTerm = normalizeTerm({ value: factMatch.factTerm })
  const requirementTerm = normalizeTerm({ value: factMatch.requirementTerm })
  if (rejectsCandidateFact({ fact, factTerm, originalFactTerm: factMatch.factTerm })) return false
  if (!representsCompleteRequirementConcept({ requirement, requirementTerm })) return false
  if (!hasEquivalentEvidenceTerms({
    factTerm,
    relationship: factMatch.relationship,
    requirementTerm,
  })) return false
  const satisfiesConstraints = satisfiesRequirementConstraints({
    fact,
    factTerm: factMatch.factTerm,
    requirement,
    requirementTerm: factMatch.requirementTerm,
  })
  return coverage === 'covered' ? satisfiesConstraints : !satisfiesConstraints
}

function containsProposedTerms({ fact, factMatch, requirement }: Omit<RequirementProof, 'coverage'>) {
  return containsTerm({ content: fact.value, term: factMatch.factTerm })
    && containsTerm({ content: requirement.value, term: factMatch.requirementTerm })
}

function rejectsCandidateFact({ fact, factTerm, originalFactTerm }: Readonly<{
  fact: CandidateFact
  factTerm: string
  originalFactTerm: string
}>) {
  if (nonEvidenceTerms.has(factTerm) || hasNegatedEvidence({ fact })) return true
  return fact.kind === 'experience' && lacksExplicitExperienceEvidence({
    factTerm: originalFactTerm, value: fact.value,
  })
}

function hasEquivalentEvidenceTerms({ factTerm, relationship, requirementTerm }: Readonly<{
  factTerm: string
  relationship: ProposedFactMatch['relationship']
  requirementTerm: string
}>) {
  if (factTerm === requirementTerm) return true
  return relationship === 'controlled'
    && canonicalizeKnownTerm({ value: factTerm })
      === canonicalizeKnownTerm({ value: requirementTerm })
}

function representsCompleteRequirementConcept({ requirement, requirementTerm }: Readonly<{
  requirement: JobRequirement
  requirementTerm: string
}>) {
  const requirementClause = readTermClause({
    term: requirementTerm,
    value: requirement.value,
  })
  return requirementClause !== null
    && canonicalizeControlledTerm({ value: requirementClause })
      === canonicalizeControlledTerm({ value: requirementTerm })
}

function canonicalizeControlledTerm({ value }: Readonly<{ value: string }>) {
  const valueWithoutScales = normalizeScaleText({ value }).replaceAll(scalePattern, ' ')
  return normalizeTerm({ value: valueWithoutScales }).replaceAll(durationPattern, ' ').split(' ')
    .filter((term) => term.length > 0 && !isConstraintContextTerm({ term })).join(' ')
}

function isConstraintContextTerm({ term }: Readonly<{ term: string }>) {
  return controlledContextTerms.has(term)
    || qualitativeRequirementTerms.includes(term as typeof qualitativeRequirementTerms[number])
}

function hasNegatedEvidence({ fact }: Readonly<{ fact: CandidateFact }>) {
  return negativeTerms.some((negativeTerm) => containsTerm({
    content: fact.value,
    term: negativeTerm,
  }))
}

function satisfiesRequirementConstraints({ fact, factTerm, requirement, requirementTerm }: Readonly<{
  fact: CandidateFact
  factTerm: string
  requirement: JobRequirement
  requirementTerm: string
}>) {
  const factClause = readTermClause({ term: factTerm, value: fact.value })
  const requirementClause = readTermClause({ term: requirementTerm, value: requirement.value })
  if (factClause === null || requirementClause === null) return false
  const hasQualifiers = satisfiesQualitativeConstraints({ factClause, requirementClause })
  return hasQualifiers && satisfiesDurationConstraint({
    factTerm, factValue: factClause, requirementTerm, requirementValue: requirementClause,
  }) && satisfiesScaleConstraint({
    factTerm, factValue: factClause, requirementTerm, requirementValue: requirementClause,
  })
}

function satisfiesQualitativeConstraints({ factClause, requirementClause }: Readonly<{
  factClause: string
  requirementClause: string
}>) {
  return qualitativeRequirementTerms.every((qualifier) =>
    !containsTerm({ content: requirementClause, term: qualifier })
    || containsTerm({ content: factClause, term: qualifier })
    || satisfiesLevelConstraint({ factClause, requiredLevel: qualifier }))
}

function satisfiesLevelConstraint({ factClause, requiredLevel }: Readonly<{
  factClause: string
  requiredLevel: string
}>) {
  const requiredRank = careerLevelRanks.get(requiredLevel)
  if (requiredRank === undefined) return false
  const factRank = careerLevelTerms.reduce((highestRank, level) =>
    containsTerm({ content: factClause, term: level })
      ? Math.max(highestRank, careerLevelRanks.get(level) ?? 0) : highestRank, 0)
  return factRank >= requiredRank
}

function satisfiesDurationConstraint({
  factTerm, factValue, requirementTerm, requirementValue,
}: Readonly<{
  factTerm: string
  factValue: string
  requirementTerm: string
  requirementValue: string
}>) {
  const requiredMonths = readDurationInMonths({ term: requirementTerm, value: requirementValue })
  if (requiredMonths === null) return true
  const factMonths = readDurationInMonths({ term: factTerm, value: factValue })
  return factMonths !== null && factMonths >= requiredMonths
}

function readTermClause({ term, value }: Readonly<{ term: string; value: string }>) {
  return value.split(clauseSeparatorPattern)
    .find((clause) => containsTerm({ content: clause, term })) ?? null
}

function readDurationInMonths({ term, value }: Readonly<{ term: string; value: string }>) {
  const normalizedValue = normalizeTerm({ value })
  const termIndex = normalizedValue.indexOf(normalizeTerm({ value: term }))
  if (termIndex < 0) return null
  return readDurations({ value: normalizedValue }).toSorted((left, right) =>
    Math.abs(left.index - termIndex) - Math.abs(right.index - termIndex))[0]?.months ?? null
}

function readDurations({ value }: Readonly<{ value: string }>) {
  return [...value.matchAll(durationPattern)].flatMap((match) => {
    const amount = match[1] === undefined ? Number.NaN : Number(match[1])
    const unit = match[2]
    if (!Number.isFinite(amount) || unit === undefined) return []
    const months = unit.startsWith('year') || unit.startsWith('yr')
      || unit.startsWith('an') ? amount * 12 : amount
    return [{ index: match.index, months }]
  })
}

function satisfiesScaleConstraint({
  factTerm, factValue, requirementTerm, requirementValue,
}: Readonly<{
  factTerm: string
  factValue: string
  requirementTerm: string
  requirementValue: string
}>) {
  const requiredScale = readNearestScale({ term: requirementTerm, value: requirementValue })
  if (requiredScale === null) return true
  const factScale = readNearestScale({ term: factTerm, value: factValue })
  return factScale !== null && factScale.unit === requiredScale.unit
    && factScale.amount >= requiredScale.amount
}

function readNearestScale({ term, value }: Readonly<{ term: string; value: string }>) {
  const normalizedValue = normalizeScaleText({ value })
  const termIndex = normalizedValue.indexOf(normalizeTerm({ value: term }))
  if (termIndex < 0) return null
  return readScales({ value: normalizedValue }).toSorted((left, right) =>
    Math.abs(left.index - termIndex) - Math.abs(right.index - termIndex))[0] ?? null
}

function readScales({ value }: Readonly<{ value: string }>) {
  return [...value.matchAll(scalePattern)].flatMap((match) => {
    const baseAmount = match[1] === undefined ? Number.NaN : Number(match[1])
    const magnitude = match[2]
    const unit = match[3]
    if (!Number.isFinite(baseAmount) || unit === undefined) return []
    return [{ amount: baseAmount * readScaleMultiplier({ magnitude }), index: match.index,
      unit: normalizeScaleUnit({ unit }) }]
  })
}

function normalizeScaleUnit({ unit }: Readonly<{ unit: string }>) {
  return unit.endsWith('s') ? unit.slice(0, -1) : unit
}

function normalizeScaleText({ value }: Readonly<{ value: string }>) {
  return foldText({ value }).replaceAll(/(\d),(\d)/gu, '$1.$2')
    .replaceAll(/[^a-z0-9+#.]+/gu, ' ').trim()
}

function lacksExplicitExperienceEvidence({ factTerm, value }: Readonly<{
  factTerm: string
  value: string
}>) {
  const factClause = readTermClause({ term: factTerm, value })
  return factClause !== null && !hasEvidenceSignal({ content: factClause })
}

function hasEvidenceSignal({ content }: Readonly<{ content: string }>) {
  return evidenceVerbs.some((verb) => containsTerm({ content, term: verb }))
    || evidenceNouns.some((noun) => containsTerm({ content, term: noun }))
    || content.match(durationPattern) !== null
    || content.match(scalePattern) !== null
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
const controlledContextTerms = new Set([
  'a', 'appliquer', 'assurer', 'au', 'aux', 'avoir', 'connaitre', 'courant', 'courante',
  'dans', 'de', 'des', 'disposer', 'du', 'en', 'etre', 'experience', 'faire', 'fluent',
  'in', 'know', 'knowledge', 'la', 'language', 'le', 'les', 'level', 'maitrise', 'maitriser',
  'for', 'of', 'pour', 'proficiency', 'speak', 'spoken', 'sur', 'un', 'une', 'use', 'used',
  'using', 'with',
])

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
const clauseSeparatorPattern = /[,;\n]|[.!?](?:\s+|$)|\b(?:and|et|qui|who)\b/iu
const durationPattern = /\b(\d+)\s*\+?\s*(years?|yrs?|ans?|months?|mois)\b/gu
const scalePattern = /\b(\d+(?:[.,]\d+)?)\s*(k|m|millions?|thousands?)?\s*(users?|requests?|transactions?|people|engineers?|developers?)\b/gu
const evidenceVerbs = [
  'applique', 'assure', 'built', 'concu', 'created', 'cree', 'delivered', 'designed',
  'developed', 'developpe', 'dirige', 'gere', 'implemented', 'led', 'managed', 'negocie',
  'negotiated', 'operated', 'owned', 'planifie', 'planned', 'used', 'using', 'utilise',
  'worked with',
] as const
const evidenceNouns = ['experience', 'expertise', 'knowledge', 'maitrise', 'proficiency'] as const
