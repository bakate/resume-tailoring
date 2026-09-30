import type { ProfessionalResumeDocument, ResumeDocumentPorts, ResumeOperationFailure, ResumeSectionChange } from '@resume-tailoring/application/candidate-journey'
import type { LanguageModelFailure } from '@resume-tailoring/application/language-model-gateway'
import { validateProposedResumeClaim } from '@resume-tailoring/application/resume-claims'
import type { ResumeClaimWritingInputs } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import { readExperienceFields, readSectionFields } from '@resume-tailoring/application/tailored-resume'
import type { TailoredResumeField } from '@resume-tailoring/application/tailored-resume'
import type { OpenAiLanguageModelGateway } from './openai-language-model-gateway'

type AdapterOptions = Readonly<{ gateway: OpenAiLanguageModelGateway; createProposalId?: () => string }>
type FieldValidation = Readonly<{ status: 'supported' | 'unsupported' }> | ResumeOperationFailure

export function createResumeDocumentModelAdapters({ gateway, createProposalId = () => crypto.randomUUID() }: AdapterOptions):
Pick<ResumeDocumentPorts, 'validateSectionChange' | 'proposeCondensation'> {
  return {
    validateSectionChange: async ({ candidateFacts, change, currentDocument }) => {
      const currentFields = new Map(readDocumentFields({ document: currentDocument }).map((field) => [field.id, field]))
      const unsupported: string[] = []
      for (const field of readChangeFields({ change })) {
        if (JSON.stringify(currentFields.get(field.id)) === JSON.stringify(field)) continue
        const result = await validateField({ candidateFacts, field, gateway })
        if (result.status === 'failed') return result
        if (result.status === 'unsupported') unsupported.push(field.id)
      }
      return unsupported.length > 0
        ? { status: 'unsupported', baseRevision: change.baseRevision, fieldIds: unsupported }
        : { status: 'validated', change }
    },
    proposeCondensation: (request) => proposeCondensation({ ...request, gateway, createProposalId }),
  }
}

async function validateField({ candidateFacts, field, gateway }: Readonly<{
  candidateFacts: readonly CandidateFact[]; field: TailoredResumeField; gateway: OpenAiLanguageModelGateway
}>): Promise<FieldValidation> {
  const verifiedFacts = readVerifiedFacts({ candidateFacts, field })
  const claim = validateProposedResumeClaim({ claimId: `resume-claim-${field.id}`,
    proposal: { segments: [{ text: field.text, factIds: field.factIds }] }, verifiedFacts })
  if (!claim.ok) return { status: 'unsupported' }
  const result = await gateway.structured.process({ operation: 'resume-claim-validation',
    input: { claim: claim.value, verifiedFacts } })
  if (!result.ok) return operationFailure({ error: result.error })
  if (result.value.operation !== 'resume-claim-validation') return unavailable
  return { status: result.value.value.supported ? 'supported' : 'unsupported' }
}

function readVerifiedFacts({ candidateFacts, field }: Readonly<{
  candidateFacts: readonly CandidateFact[]; field: TailoredResumeField
}>): ResumeClaimWritingInputs['verifiedFacts'] {
  return candidateFacts.filter(({ id, status }) => status === 'attested' && field.factIds.includes(id))
    .map(({ id, path, value }) => ({ id, value, kind: factKind({ path }) }))
}

function factKind({ path }: Readonly<{ path: string }>): ResumeClaimWritingInputs['verifiedFacts'][number]['kind'] {
  if (path.startsWith('skills.')) return 'skill'
  if (path.startsWith('education.') || path.startsWith('certifications.')) return 'education'
  if (path.startsWith('languages.')) return 'language'
  return path.startsWith('projects.') ? 'project' : 'experience'
}

function readChangeFields({ change }: Readonly<{ change: ResumeSectionChange }>) {
  if (change.section === 'value-proposition') return change.replacement.paragraphs
  if (change.section === 'experiences') return change.replacement.flatMap((experience) => readExperienceFields({ experience }))
  if (change.section === 'skills') return readSectionFields({ section: change.replacement })
  return change.replacement
}

function readDocumentFields({ document }: Readonly<{ document: ProfessionalResumeDocument }>) {
  return [...document.valueProposition.paragraphs,
    ...document.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...document.sections.flatMap((section) => readSectionFields({ section }))]
}

function operationFailure({ error }: Readonly<{ error: LanguageModelFailure }>): ResumeOperationFailure {
  return error.type === 'processing-consent-required'
    ? { status: 'failed', reason: 'processing-consent-required', recovery: 'renew-consent' }
    : unavailable
}

const unavailable = { status: 'failed', reason: 'unavailable', recovery: 'retry' } as const


type CondensationRequest = Parameters<ResumeDocumentPorts['proposeCondensation']>[0]
  & Readonly<{ gateway: OpenAiLanguageModelGateway; createProposalId: () => string }>

async function proposeCondensation(request: CondensationRequest): ReturnType<ResumeDocumentPorts['proposeCondensation']> {
  const replacements = new Map<string, TailoredResumeField>()
  for (const field of readCondensableFields({ document: request.document })) {
    const result = await condenseField({ ...request, field })
    if (result.status === 'failed') return result
    replacements.set(field.id, result.field)
  }
  return { status: 'proposed', proposal: { id: request.createProposalId(), baseRevision: request.baseRevision,
    document: replaceProseFields({ document: request.document, replacements }),
    layout: { status: 'unavailable', revision: request.baseRevision } } }
}

async function condenseField({ candidateFacts, document, field, gateway }: CondensationRequest & Readonly<{
  field: TailoredResumeField
}>): Promise<Readonly<{ status: 'condensed'; field: TailoredResumeField }> | ResumeOperationFailure> {
  const result = await gateway.writing.process({ operation: 'resume-claim-reformulation', input: {
    claim: { segments: [{ text: field.text, factIds: field.factIds }] }, feedback: [],
    verifiedFacts: readVerifiedFacts({ candidateFacts, field }), locale: document.locale,
    requirements: [], evidence: [],
    request: 'Shorten this resume wording to help fit two pages. Preserve every factual detail and every fact reference; do not remove evidence or strengthen meaning. Keep unchanged if faithful shortening is impossible.',
  } })
  if (!result.ok) return operationFailure({ error: result.error })
  if (result.value.operation !== 'resume-claim-reformulation') return unavailable
  const segments = result.value.value.segments
  const references = new Set(segments.flatMap(({ factIds }) => factIds))
  if (references.size !== field.factIds.length || field.factIds.some((factId) => !references.has(factId))) return unsupportedContent
  const condensed = { ...field, text: segments.map(({ text }) => text.trim()).join(' ') }
  return validateCondensation({ candidateFacts, condensed, field, gateway })
}

async function validateCondensation({ candidateFacts, condensed, field, gateway }: Readonly<{
  candidateFacts: readonly CandidateFact[]; condensed: TailoredResumeField; field: TailoredResumeField;
  gateway: OpenAiLanguageModelGateway
}>): Promise<Readonly<{ status: 'condensed'; field: TailoredResumeField }> | ResumeOperationFailure> {
  const forward = await validateField({ candidateFacts, field: condensed, gateway })
  if (forward.status === 'failed') return forward
  if (forward.status === 'unsupported') return unsupportedContent
  const reverse = await validateField({ gateway,
    field: { ...field, factIds: ['source-fact-condensed-evidence'] },
    candidateFacts: [{ id: 'source-fact-condensed-evidence', path: 'experiences.0.achievements.0',
      status: 'attested', value: condensed.text }],
  })
  if (reverse.status === 'failed') return reverse
  return reverse.status === 'unsupported' ? unsupportedContent : { status: 'condensed', field: condensed }
}

function readCondensableFields({ document }: Readonly<{ document: ProfessionalResumeDocument }>) {
  return [...document.valueProposition.paragraphs, ...document.experiences.flatMap(({ context, achievements }) =>
    context === null ? achievements : [context, ...achievements])]
}

function replaceProseFields({ document, replacements }: Readonly<{
  document: ProfessionalResumeDocument; replacements: ReadonlyMap<string, TailoredResumeField>
}>): ProfessionalResumeDocument {
  const replace = (field: TailoredResumeField) => replacements.get(field.id) ?? field
  return { ...document,
    valueProposition: { ...document.valueProposition, paragraphs: document.valueProposition.paragraphs.map(replace) },
    experiences: document.experiences.map((experience) => ({ ...experience,
      context: experience.context === null ? null : replace(experience.context),
      achievements: experience.achievements.map(replace),
    })),
  }
}

const unsupportedContent = { status: 'failed', reason: 'unsupported-content', recovery: 'correct-content' } as const
