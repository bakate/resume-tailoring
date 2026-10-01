import type { JobMatch } from '@resume-tailoring/domain/job-match'
import type { CandidateFact, CandidateFactId } from '@resume-tailoring/domain/source-intake'
import { readExperienceFields, readSectionFields } from './tailored-resume'
import type { TailoredResumeExperience, TailoredResumeField, TailoredResumeLocale, TailoredResumeSection } from './tailored-resume'
import type { ProfessionalResumeDocument } from './structured-resume-contract'
import type { ResumeSectionContent, ResumeSectionKind } from '@resume-tailoring/domain/tailored-resume'

export { resumeSectionKinds } from '@resume-tailoring/domain/tailored-resume'
export type { ResumeSectionContent, ResumeSectionKind } from '@resume-tailoring/domain/tailored-resume'

/** One Resume Section of the deterministic section plan; experiences are keyed `experiences.N`. */
export type ResumeSectionPlanEntry = Readonly<{ key: string; kind: ResumeSectionKind }>

/** Only what the section may cite (every fact for the Value Proposition): never the Job Posting text or Match Analysis details. */
export type ResumeSectionWritingInput = Readonly<{
  section: ResumeSectionPlanEntry
  candidateFacts: readonly CandidateFact[]
  targetRole: string | null
  jobRequirements: readonly string[]
  relevantFactIds: readonly CandidateFactId[]
  locale: TailoredResumeLocale
  purpose: 'tailored' | 'normalized'
  /** Fields of this section's previous attempt that validation rejected; empty on a first write. */
  rejectedFields: readonly ResumeRejectedField[]
}>

/** Why a field was sent back to its writer: unsupported by its facts, or one of the coherence issue kinds. */
export type ResumeFieldRejection = 'unsupported' | ResumeCoherenceIssueKind
export type ResumeRejectedField = Readonly<{ fieldId: string; text: string; reason: ResumeFieldRejection }>

export type ResumeFieldValidationInput = Readonly<{
  section: ResumeSectionPlanEntry
  fields: readonly TailoredResumeField[]
  candidateFacts: readonly CandidateFact[]
  locale: TailoredResumeLocale
  purpose: 'tailored' | 'normalized'
}>
export type ResumeFieldValidation = Readonly<{ fields: readonly Readonly<{ fieldId: string; supported: boolean }>[] }>

export type ResumeCoherenceInput = Readonly<{ document: ProfessionalResumeDocument }>
export const resumeCoherenceIssueKinds = ['chronology', 'mixed-association', 'redundant', 'skill-category',
  'duplicated-skill', 'language'] as const
export type ResumeCoherenceIssueKind = typeof resumeCoherenceIssueKinds[number]
/** A field of the assembled document that the coherence check objects to; its section is rewritten. */
export type ResumeCoherenceIssue = Readonly<{ fieldId: string; kind: ResumeCoherenceIssueKind }>
export type ResumeDocumentCoherence = Readonly<{
  coherent: boolean; languageMatches: boolean; issues: readonly ResumeCoherenceIssue[]
}>

export type ResumeSectionModelFailure = 'transient' | 'timeout' | 'permanent' | 'consent-required'
export type ResumeModelUsage = Readonly<{ inputTokens: number; outputTokens: number }>
export type ResumeSectionModelResult<TValue> =
  | Readonly<{ ok: true; value: TValue; usage?: ResumeModelUsage }>
  | Readonly<{ ok: false; error: Readonly<{ type: ResumeSectionModelFailure }>; usage?: ResumeModelUsage }>

export type ResumeSectionModels = Readonly<{
  writeSection: (input: ResumeSectionWritingInput) => Promise<ResumeSectionModelResult<ResumeSectionContent>>
  validateFields: (input: ResumeFieldValidationInput) => Promise<ResumeSectionModelResult<ResumeFieldValidation>>
  checkCoherence: (input: ResumeCoherenceInput) => Promise<ResumeSectionModelResult<ResumeDocumentCoherence>>
}>

export type ResumeSectionsRequest = Readonly<{
  candidateFacts: readonly CandidateFact[]
  jobMatch: JobMatch
  locale: TailoredResumeLocale
  purpose: 'tailored' | 'normalized'
}>

const fieldSectionKinds = ['skills', 'education', 'languages', 'projects', 'certifications'] as const

export function planResumeSections({ candidateFacts }: Pick<ResumeSectionsRequest, 'candidateFacts'>): readonly ResumeSectionPlanEntry[] {
  const experienceIndexes = [...new Set(candidateFacts.map(({ path }) => /^experiences\.(\d+)\./u.exec(path)?.[1])
    .filter((index) => index !== undefined).map(Number))].sort((left, right) => left - right)
  return [{ key: 'value-proposition', kind: 'value-proposition' },
    ...experienceIndexes.map((index) => ({ key: `experiences.${String(index)}`, kind: 'experience' as const })),
    ...fieldSectionKinds.filter((kind) => candidateFacts.some(({ path, value }) => path.startsWith(`${kind}.`)
      && value.trim().length > 0)).map((kind) => ({ key: kind, kind }))]
}

export function createSectionWritingInput({ request, section }: Readonly<{
  request: ResumeSectionsRequest; section: ResumeSectionPlanEntry
}>): ResumeSectionWritingInput {
  const tailored = request.purpose === 'tailored'
  const relevantFactIds = tailored ? readRelevantFactIds(request.jobMatch) : new Set<string>()
  const candidateFacts = readSectionFacts({ candidateFacts: request.candidateFacts, section })
  return { section, candidateFacts, locale: request.locale, purpose: request.purpose, rejectedFields: [],
    targetRole: tailored ? request.jobMatch.targetRole?.value ?? null : null,
    jobRequirements: tailored ? request.jobMatch.requirements.map(({ value }) => value) : [],
    relevantFactIds: candidateFacts.filter(({ id }) => relevantFactIds.has(id)).map(({ id }) => id) }
}

// Writing may highlight Adjacent Evidence facts, so they reach it as relevant facts; the
// Match Analysis itself keeps them out of relevance and Generation Eligibility (ADR-0015).
function readRelevantFactIds(jobMatch: JobMatch): ReadonlySet<string> {
  return new Set([...jobMatch.analysis.relevantFactIds,
    ...jobMatch.analysis.adjacentEvidence.flatMap(({ factIds }) => factIds)])
}

function readSectionFacts({ candidateFacts, section }: Readonly<{
  candidateFacts: readonly CandidateFact[]; section: ResumeSectionPlanEntry
}>) {
  // The Value Proposition sees every fact so it can name roles and context; relevantFactIds says what to emphasize.
  return section.kind === 'value-proposition' ? candidateFacts
    : candidateFacts.filter(({ path }) => path.startsWith(`${section.key}.`))
}

/** Applies the deterministic normalization owned by the application, never by the writing role. */
export function normalizeSectionContent({ content, purpose, section }: Readonly<{
  content: ResumeSectionContent; purpose: 'tailored' | 'normalized'; section: ResumeSectionPlanEntry
}>): ResumeSectionContent {
  if (content.kind === 'experience') {
    const { experience } = content
    return { kind: 'experience', experience: { ...experience, id: section.key,
      chronology: purpose === 'normalized' && experience.chronology === 'relevant' ? 'context' : experience.chronology,
      achievements: deduplicateFields(experience.achievements) } }
  }
  if (content.kind === 'skills') {
    return { kind: 'skills', groups: content.groups.map((group) => ({ ...group, items: deduplicateFields(group.items) })) }
  }
  return content
}

function deduplicateFields(fields: readonly TailoredResumeField[]) {
  const unique = new Map<string, TailoredResumeField>()
  for (const field of fields) {
    const key = field.text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
    const previous = unique.get(key)
    unique.set(key, previous === undefined ? field : { ...previous,
      factIds: [...new Set([...previous.factIds, ...field.factIds])] })
  }
  return [...unique.values()]
}

export function readSectionContentFields(content: ResumeSectionContent): readonly TailoredResumeField[] {
  if (content.kind === 'value-proposition') return content.paragraphs
  if (content.kind === 'experience') return readExperienceFields({ experience: content.experience })
  if (content.kind === 'skills') return readSectionFields({ section: { section: 'skills', groups: content.groups } })
  return content.fields
}

/** The existing deterministic structure checks, restricted to one section and the facts it may cite. */
export function hasSupportedSectionStructure({ content, input }: Readonly<{
  content: ResumeSectionContent; input: ResumeSectionWritingInput
}>) {
  if (content.kind !== input.section.kind) return false
  const fields = readSectionContentFields(content)
  const factIds = new Set(input.candidateFacts.filter(({ status }) => status === 'attested').map(({ id }) => id))
  return fields.length > 0 && new Set(fields.map(({ id }) => id)).size === fields.length
    && fields.every((field) => field.text.trim().length > 0 && field.factIds.length > 0
      && field.factIds.every((factId) => factIds.has(factId)))
    && (content.kind !== 'skills' || new Set(content.groups.map(({ id }) => id)).size === content.groups.length)
    && (content.kind !== 'experience' || experienceRetainsAssociations({ candidateFacts: input.candidateFacts,
      experience: content.experience }))
}

function experienceRetainsAssociations({ candidateFacts, experience }: Readonly<{
  candidateFacts: readonly CandidateFact[]; experience: TailoredResumeExperience
}>) {
  return (['role', 'organization', 'startDate', 'endDate', 'context'] as const).every((name) => {
    const expectedFacts = candidateFacts.filter(({ path }) => path.startsWith(`${experience.id}.${name}.`))
    const field = experience[name]
    if (field === null) return name === 'context' || expectedFacts.length === 0
    return expectedFacts.length > 0 && field.factIds.every((factId) => expectedFacts.some(({ id }) => id === factId))
  })
}

export function isSectionFullyValidated({ content, validation }: Readonly<{
  content: ResumeSectionContent; validation: ResumeFieldValidation
}>) {
  const fields = readSectionContentFields(content)
  return validation.fields.length === fields.length
    && new Set(validation.fields.map(({ fieldId }) => fieldId)).size === fields.length
    && fields.every(({ id }) => validation.fields.some(({ fieldId, supported }) => fieldId === id && supported))
}

/** The fields a validation did not confirm as supported; a field it omitted counts as rejected. */
export function readRejectedFields({ content, validation }: Readonly<{
  content: ResumeSectionContent; validation: ResumeFieldValidation
}>): readonly ResumeRejectedField[] {
  return readSectionContentFields(content).filter(({ id }) => !validation.fields.some(({ fieldId, supported }) =>
    fieldId === id && supported)).map(({ id, text }) => ({ fieldId: id, text, reason: 'unsupported' }))
}

export function citedCandidateFacts({ content, candidateFacts }: Readonly<{
  content: ResumeSectionContent; candidateFacts: readonly CandidateFact[]
}>) {
  const cited = new Set(readSectionContentFields(content).flatMap(({ factIds }) => factIds))
  return candidateFacts.filter(({ id }) => cited.has(id))
}

export function assembleResumeDocument(request: Readonly<{
  contents: readonly ResumeSectionContent[]; request: ResumeSectionsRequest
}>): ProfessionalResumeDocument {
  return assembleResumeDocumentWithOrigins(request).document
}

/** The Resume Section key and the section's own field behind one field id of the assembled document. */
export type AssembledFieldOrigin = Readonly<{ sectionKey: string; field: TailoredResumeField }>

/**
 * Assembles validated sections in plan order; a field identifier reused across sections is made unique.
 * `origins` maps each assembled field id back to its section, so a document-level verdict can reach the section.
 */
export function assembleResumeDocumentWithOrigins({ contents, request }: Readonly<{
  contents: readonly ResumeSectionContent[]; request: ResumeSectionsRequest
}>): Readonly<{ document: ProfessionalResumeDocument; origins: ReadonlyMap<string, AssembledFieldOrigin> }> {
  const origins = new Map<string, AssembledFieldOrigin>()
  // `key` is always the section key: experiences carry it as their id, every other section kind is its own key.
  const unique = (field: TailoredResumeField, key: string): TailoredResumeField => {
    const id = origins.has(field.id) ? `${key}.${field.id}` : field.id
    origins.set(id, { sectionKey: key, field })
    return id === field.id ? field : { ...field, id }
  }
  const uniqueOrNull = (field: TailoredResumeField | null, key: string) => field === null ? null : unique(field, key)
  const paragraphs = contents.flatMap((content) => content.kind === 'value-proposition'
    ? content.paragraphs.map((field) => unique(field, 'value-proposition')) : [])
  const experiences = contents.flatMap((content) => content.kind !== 'experience' ? [] : [{ ...content.experience,
    role: uniqueOrNull(content.experience.role, content.experience.id),
    organization: uniqueOrNull(content.experience.organization, content.experience.id),
    startDate: uniqueOrNull(content.experience.startDate, content.experience.id),
    endDate: uniqueOrNull(content.experience.endDate, content.experience.id),
    context: uniqueOrNull(content.experience.context, content.experience.id),
    achievements: content.experience.achievements.map((field) => unique(field, content.experience.id)) }])
  const sections = contents.flatMap((content): TailoredResumeSection[] => {
    if (content.kind === 'skills') return [{ section: 'skills', groups: content.groups.map((group) => ({ ...group,
      category: uniqueOrNull(group.category, 'skills'), items: group.items.map((field) => unique(field, 'skills')) })) }]
    if (content.kind === 'value-proposition' || content.kind === 'experience') return []
    return [{ section: content.kind, fields: content.fields.map((field) => unique(field, content.kind)) }]
  })
  return { origins, document: { purpose: request.purpose, locale: request.locale,
    targetRole: request.purpose === 'normalized' ? null : request.jobMatch.targetRole,
    valueProposition: { kind: 'prose', paragraphs }, experiences, sections } }
}

export function readProfessionalResumeFields(document: ProfessionalResumeDocument) {
  return [...document.valueProposition.paragraphs,
    ...document.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...document.sections.flatMap((section) => readSectionFields({ section }))]
}
