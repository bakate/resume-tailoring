import type {
  CandidateFact,
  MatchEvidence,
  MatchRequirement,
  ProposedFactMatch,
  ProposedMatchEvidence,
} from './resume-matching-engine'

export function validateMatchEvidence({
  proposedEvidence,
  requirements,
  verifiedFacts,
}: Readonly<{
  proposedEvidence: readonly ProposedMatchEvidence[]
  requirements: readonly MatchRequirement[]
  verifiedFacts: readonly CandidateFact[]
}>) {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]))
  const verifiedFactById = new Map(verifiedFacts.map((fact) => [fact.id, fact]))
  const referencedRequirementIds = new Set<string>()
  const evidence = proposedEvidence.map((proposal) => validateEvidenceProposal({
    proposal, referencedRequirementIds, requirementById, verifiedFactById,
  }))
  const validEvidence = evidence.filter((item) => item !== null)
  return proposedEvidence.length > 0 && validEvidence.length === 0 ? null : validEvidence
}

type EvidenceProposalValidation = Readonly<{
  proposal: ProposedMatchEvidence
  referencedRequirementIds: Set<string>
  requirementById: ReadonlyMap<string, MatchRequirement>
  verifiedFactById: ReadonlyMap<string, CandidateFact>
}>

function validateEvidenceProposal({
  proposal, referencedRequirementIds, requirementById, verifiedFactById,
}: EvidenceProposalValidation): MatchEvidence | null {
  const requirement = requirementById.get(proposal.requirementId)
  if (requirement === undefined || referencedRequirementIds.has(proposal.requirementId)) return null
  referencedRequirementIds.add(proposal.requirementId)
  if (!hasValidFactMatches({
    coverage: proposal.coverage,
    factMatches: proposal.factMatches,
    requirement,
    verifiedFactById,
  })) {
    return null
  }
  return { coverage: proposal.coverage, requirementId: proposal.requirementId,
    factIds: proposal.factMatches.map(({ factId }) => factId) }
}

function hasValidFactMatches({ coverage, factMatches, requirement, verifiedFactById }: Readonly<{
  coverage: ProposedMatchEvidence['coverage']
  factMatches: readonly ProposedFactMatch[]
  requirement: MatchRequirement
  verifiedFactById: ReadonlyMap<string, CandidateFact>
}>) {
  if (factMatches.length === 0) return false
  const factIds = new Set(factMatches.map(({ factId }) => factId))
  if (factIds.size !== factMatches.length) return false
  return factMatches.every((factMatch) => {
    const fact = verifiedFactById.get(factMatch.factId)
    return fact !== undefined && provesRequirement({ coverage, factMatch, fact, requirement })
  })
}

type RequirementProof = Readonly<{
  coverage: ProposedMatchEvidence['coverage']
  fact: CandidateFact
  factMatch: ProposedFactMatch
  requirement: MatchRequirement
}>

function provesRequirement({ coverage, fact, factMatch, requirement }: RequirementProof) {
  if (!containsTerm({ content: fact.value, term: factMatch.factTerm })
    || !containsTerm({ content: requirement.value, term: factMatch.requirementTerm })) return false
  const factTerm = normalizeTerm({ value: factMatch.factTerm })
  const requirementTerm = normalizeTerm({ value: factMatch.requirementTerm })
  if (nonEvidenceTerms.has(factTerm) || hasNegatedEvidence({ fact })) return false
  if (fact.kind === 'experience' && isRoleTitleOnlyEvidence({
    factTerm: factMatch.factTerm, value: fact.value,
  })) return false
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

function hasEquivalentEvidenceTerms({ factTerm, relationship, requirementTerm }: Readonly<{
  factTerm: string
  relationship: ProposedFactMatch['relationship']
  requirementTerm: string
}>) {
  if (factTerm === requirementTerm) return true
  return relationship === 'controlled'
    && controlledTermGroups.some((termGroup) => hasTermsFromGroup({
      factTerm, requirementTerm, termGroup,
    }))
}

function representsCompleteRequirementConcept({ requirement, requirementTerm }: Readonly<{
  requirement: MatchRequirement
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

function hasTermsFromGroup({ factTerm, requirementTerm, termGroup }: Readonly<{
  factTerm: string
  requirementTerm: string
  termGroup: ReadonlySet<string>
}>) {
  return termGroup.has(canonicalizeControlledTerm({ value: factTerm }))
    && termGroup.has(canonicalizeControlledTerm({ value: requirementTerm }))
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
  requirement: MatchRequirement
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
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en').replaceAll(/(\d),(\d)/gu, '$1.$2')
    .replaceAll(/[^a-z0-9+#.]+/gu, ' ').trim()
}

function isRoleTitleOnlyEvidence({ factTerm, value }: Readonly<{
  factTerm: string
  value: string
}>) {
  const factClause = readTermClause({ term: factTerm, value })
  return factClause !== null && (hasRoleTitlePhrase({ factTerm, value: factClause })
    || looksLikeRoleTitle({ value: factClause }))
}

function hasRoleTitlePhrase({ factTerm, value }: Readonly<{
  factTerm: string
  value: string
}>) {
  const normalizedTerm = normalizeTerm({ value: factTerm })
  const normalizedValue = normalizeTerm({ value })
  const termIndex = normalizedValue.indexOf(normalizedTerm)
  if (termIndex < 0) return false
  const precedingContent = normalizedValue.slice(0, termIndex)
  const followingContent = normalizedValue.slice(termIndex + normalizedTerm.length)
  return hasTrailingTitleRole({ followingContent, precedingContent })
    || hasUngovernedLeadingRole({ precedingContent })
}

function hasTrailingTitleRole({ followingContent, precedingContent }: Readonly<{
  followingContent: string
  precedingContent: string
}>) {
  if (hasEvidenceVerb({ content: precedingContent })
    && !containsTerm({ content: precedingContent, term: 'as' })) return false
  const followingTerms = followingContent.trim().split(' ')
  return roleTerms.some((roleTerm) => {
    const roleIndex = followingTerms.indexOf(roleTerm)
    if (roleIndex < 0) return false
    return !followingTerms.slice(0, roleIndex).includes('as')
  })
}

function hasUngovernedLeadingRole({ precedingContent }: Readonly<{ precedingContent: string }>) {
  const precedingTerms = precedingContent.trim().split(' ')
  return roleTerms.some((roleTerm) => {
    const roleIndex = precedingTerms.lastIndexOf(roleTerm)
    if (roleIndex < 0) return false
    return !hasEvidenceVerb({ content: precedingTerms.slice(roleIndex + 1).join(' ') })
  })
}

function hasEvidenceVerb({ content }: Readonly<{ content: string }>) {
  return evidenceVerbs.some((verb) => containsTerm({ content, term: verb }))
}

function readScaleMultiplier({ magnitude }: Readonly<{ magnitude: string | undefined }>) {
  if (magnitude === 'm' || magnitude?.startsWith('million') === true) return 1_000_000
  if (magnitude === 'k' || magnitude?.startsWith('thousand') === true) return 1_000
  return 1
}

function looksLikeRoleTitle({ value }: Readonly<{ value: string }>) {
  const normalizedValue = normalizeTerm({ value })
  const hasRoleWord = roleTerms.some((roleTerm) => normalizedValue.includes(roleTerm))
  const hasEvidenceVerb = evidenceVerbs.some((verb) => normalizedValue.includes(verb))
  return hasRoleWord && !hasEvidenceVerb
}

function containsTerm({ content, term }: Readonly<{ content: string; term: string }>) {
  const normalizedContent = ` ${normalizeTerm({ value: content })} `
  const normalizedTerm = normalizeTerm({ value: term })
  return normalizedTerm.length > 1 && normalizedContent.includes(` ${normalizedTerm} `)
}

function normalizeTerm({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en').replaceAll(/[^a-z0-9+#]+/gu, ' ').trim()
}

const controlledTermGroups = [
  ['typescript', 'ts'],
  ['javascript', 'js'],
  ['react', 'react js', 'reactjs'],
  ['french', 'francais'],
  ['english', 'anglais'],
  ['bilingual', 'bilingue'],
].map((terms) => new Set(terms))
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
const clauseSeparatorPattern = /[,;\n]|[.!?](?:\s+|$)|\b(?:and|et)\b/iu
const durationPattern = /\b(\d+)\s*\+?\s*(years?|yrs?|ans?|months?|mois)\b/gu
const scalePattern = /\b(\d+(?:[.,]\d+)?)\s*(k|m|millions?|thousands?)?\s*(users?|requests?|transactions?|people|engineers?|developers?)\b/gu
const roleTerms = ['developer', 'engineer', 'manager', 'architect', 'consultant'] as const
const evidenceVerbs = [
  'built', 'created', 'delivered', 'designed', 'developed', 'implemented', 'used', 'using',
  'worked with',
] as const
