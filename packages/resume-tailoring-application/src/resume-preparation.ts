import type { CandidateFact } from './source-intake'
import { readExperienceFields, readSectionFields } from './tailored-resume'
import type { TailoredResumeField } from './tailored-resume'
import type { ProfessionalResumeDocument, ResumeDocumentPorts, ResumePreparationRequest, ResumePreparationOutcome } from './structured-resume-contract'

export type ResumeModelFailure = Readonly<{ ok: false; error: Readonly<{ type: 'unavailable'; transient?: boolean }> }>
export type ResumeWritingInput = Omit<ResumePreparationRequest, 'revision' | 'onProgress'>
export type ResumeDocumentWriter = Readonly<{
  write: (request: ResumeWritingInput) => Promise<Readonly<{ ok: true; value: ProfessionalResumeDocument }> | ResumeModelFailure>
}>
export type ResumeValidationInput = Readonly<{
  candidateFacts: readonly CandidateFact[]; document: ProfessionalResumeDocument
}>
export type ResumeDocumentValidation = Readonly<{
  coherent: boolean
  languageMatches: boolean
  fields: readonly Readonly<{ fieldId: string; supported: boolean }>[]
}>
export type ResumeDocumentValidator = Readonly<{
  validate: (request: ResumeValidationInput) => Promise<Readonly<{ ok: true; value: ResumeDocumentValidation }> | ResumeModelFailure>
}>

type PreparationModels = Readonly<{ writer: ResumeDocumentWriter; validator: ResumeDocumentValidator }>

export function createResumePreparation(models: PreparationModels): Pick<ResumeDocumentPorts, 'prepare'> {
  return { prepare: (request) => prepareResume({ models, request }) }
}

async function prepareResume({ models, request }: Readonly<{
  models: PreparationModels; request: ResumePreparationRequest
}>): Promise<ResumePreparationOutcome> {
  if (request.purpose === 'tailored' && request.jobMatch.analysis.generationEligibility === 'denied') {
    return { status: 'no-relevant-evidence', revision: request.revision, alternative: 'normalized' }
  }
  const retry = createTransientRetry()
  const input = professionalWritingInput(request)
  request.onProgress?.('writing')
  const written = await retry(() => models.writer.write(input))
  if (!written.ok) return unavailable
  const document = normalizeDocument({ document: written.value, request })
  if (!hasSupportedStructure({ candidateFacts: input.candidateFacts, document })) return unsupported
  request.onProgress?.('validating')
  const validation = await retry(() => models.validator.validate({ candidateFacts: input.candidateFacts, document }))
  if (!validation.ok) return unavailable
  return isFullyValidated({ document, validation: validation.value })
    ? { status: 'prepared', revision: request.revision, document } : unsupported
}

function professionalWritingInput(request: ResumePreparationRequest): ResumeWritingInput {
  return { candidateFacts: request.candidateFacts.filter(({ status }) => status === 'attested'),
    jobMatch: request.jobMatch, locale: request.locale, purpose: request.purpose }
}

function createTransientRetry() {
  let remainingRetries = 1
  return async <TValue>(operation: () => Promise<Readonly<{ ok: true; value: TValue }> | ResumeModelFailure>): Promise<Readonly<{ ok: true; value: TValue }> | ResumeModelFailure> => {
    try {
      const result = await operation()
      if (result.ok || result.error.transient !== true || remainingRetries === 0) return result
      remainingRetries -= 1
      return await operation()
    } catch { return { ok: false, error: { type: 'unavailable' } } as const }
  }
}

function normalizeDocument({ document, request }: Readonly<{
  document: ProfessionalResumeDocument; request: ResumePreparationRequest
}>): ProfessionalResumeDocument {
  return { purpose: request.purpose, locale: request.locale,
    targetRole: request.purpose === 'normalized' ? null : request.jobMatch.targetRole,
    valueProposition: document.valueProposition,
    experiences: document.experiences.map((experience) => ({ ...experience,
      chronology: request.purpose === 'normalized' && experience.chronology === 'relevant' ? 'context' : experience.chronology,
      achievements: deduplicateFields(experience.achievements) })),
    sections: document.sections.map((section) => section.section !== 'skills' ? section : {
      ...section, groups: section.groups.map((group) => ({ ...group, items: deduplicateFields(group.items) })),
    }),
  }
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

export function readProfessionalResumeFields(document: ProfessionalResumeDocument) {
  return [...document.valueProposition.paragraphs,
    ...document.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...document.sections.flatMap((section) => readSectionFields({ section }))]
}

function hasSupportedStructure({ candidateFacts, document }: ResumeValidationInput) {
  const fields = readProfessionalResumeFields(document)
  const factIds = new Set(candidateFacts.filter(({ status }) => status === 'attested').map(({ id }) => id))
  return document.valueProposition.kind === 'prose' && document.valueProposition.paragraphs.length > 0
    && new Set(fields.map(({ id }) => id)).size === fields.length
    && new Set(document.experiences.map(({ id }) => id)).size === document.experiences.length
    && new Set(document.sections.map(({ section }) => section)).size === document.sections.length
    && document.sections.every((section) => section.section !== 'skills'
      || new Set(section.groups.map(({ id }) => id)).size === section.groups.length)
    && fields.every((field) => field.text.trim().length > 0 && field.factIds.length > 0
      && field.factIds.every((factId) => factIds.has(factId)))
    && experiencesRetainAssociations({ candidateFacts, document })
}

function experiencesRetainAssociations({ candidateFacts, document }: ResumeValidationInput) {
  const entryIds = [...new Set(candidateFacts.filter(({ path }) => path.startsWith('experiences.'))
    .map(({ path }) => path.split('.').slice(0, 2).join('.')))]
  return entryIds.every((entryId) => document.experiences.some(({ id }) => id === entryId))
    && document.experiences.every((experience) => entryIds.includes(experience.id)
      && (['role', 'organization', 'startDate', 'endDate', 'context'] as const).every((name) => {
        const expectedFacts = candidateFacts.filter(({ path }) => path.startsWith(`${experience.id}.${name}.`))
        const field = experience[name]
        if (field === null) return name === 'context' || expectedFacts.length === 0
        return expectedFacts.length > 0 && field.factIds.every((factId) => expectedFacts.some(({ id }) => id === factId))
      }) && experience.achievements.every((field) => field.factIds.every((factId) =>
        candidateFacts.some(({ id, path }) => id === factId && path.startsWith(`${experience.id}.`)))))
}

function isFullyValidated({ document, validation }: Readonly<{
  document: ProfessionalResumeDocument; validation: ResumeDocumentValidation
}>) {
  const fields = readProfessionalResumeFields(document)
  return validation.coherent && validation.languageMatches && validation.fields.length === fields.length
    && new Set(validation.fields.map(({ fieldId }) => fieldId)).size === fields.length
    && fields.every(({ id }) => validation.fields.some(({ fieldId, supported }) => fieldId === id && supported))
}

const unavailable = { status: 'failed', reason: 'unavailable', recovery: 'retry' } as const
const unsupported = { status: 'failed', reason: 'unsupported-content', recovery: 'correct-content' } as const
