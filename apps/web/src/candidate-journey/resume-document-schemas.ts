import { z } from 'zod'
import { resumeCoherenceIssueKinds, resumeSectionKinds } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionKind } from '@resume-tailoring/application/candidate-journey'
import { sourceIntakeSchema, tailoredResumeFieldSchema, tailoredResumeSchema } from './candidate-session'

export const professionalResumeDocumentSchema = tailoredResumeSchema.omit({ identity: true, contactDetails: true, sectionOrder: true })

const fieldsSchema = z.strictObject({ fields: z.array(tailoredResumeFieldSchema) })

/** One strict structured-output schema per Resume Section kind, each a slice of the professional document. */
export const resumeSectionOutputSchemas = {
  'value-proposition': z.strictObject({ paragraphs: z.array(tailoredResumeFieldSchema) }),
  // Strict structured output requires every key, so the writer always states a location, or null.
  experience: tailoredResumeSchema.shape.experiences.element.extend({ location: tailoredResumeFieldSchema.nullable() }),
  skills: z.strictObject({ groups: z.array(z.strictObject({ id: z.string().min(1),
    category: tailoredResumeFieldSchema.nullable(), items: z.array(tailoredResumeFieldSchema) })) }),
  education: fieldsSchema, languages: fieldsSchema, projects: fieldsSchema, certifications: fieldsSchema,
} as const satisfies Record<ResumeSectionKind, z.ZodType>

/** A Resume Section as the application holds it: each section output schema tagged with its kind. */
export const resumeSectionContentSchema = z.union([
  z.strictObject({ kind: z.literal('value-proposition'), ...resumeSectionOutputSchemas['value-proposition'].shape }),
  z.strictObject({ kind: z.literal('experience'), experience: resumeSectionOutputSchemas.experience }),
  z.strictObject({ kind: z.literal('skills'), ...resumeSectionOutputSchemas.skills.shape }),
  z.strictObject({ kind: z.enum(['education', 'languages', 'projects', 'certifications']), ...resumeSectionOutputSchemas.education.shape }),
])

const sectionSchema = z.strictObject({ key: z.string().regex(/^(?:value-proposition|experiences\.\d+|skills|education|languages|projects|certifications)$/u),
  kind: z.enum(resumeSectionKinds),
  // Absent from clients loaded before code classified experiences, and from every other section kind.
  experienceShape: z.strictObject({ chronology: z.enum(['context', 'earlier', 'relevant']),
    achievementBudget: z.number().int().min(0).max(6) }).optional() })
const candidateFactsSchema = sourceIntakeSchema.shape.candidateFacts.max(500)
const localeSchema = z.enum(['en', 'fr'])
const purposeSchema = z.enum(['tailored', 'normalized'])

export const resumeSectionWritingInputSchema = z.strictObject({
  section: sectionSchema, candidateFacts: candidateFactsSchema,
  targetRole: z.string().max(500).nullable(), jobRequirements: z.array(z.string().max(1_000)).max(60),
  relevantFactIds: z.array(sourceIntakeSchema.shape.candidateFacts.element.shape.id).max(500),
  locale: localeSchema, purpose: purposeSchema,
  // Absent from clients loaded before rewrites learned their rejected fields, and `reason` before the coherence check named fields.
  rejectedFields: z.array(z.strictObject({ fieldId: z.string().min(1), text: z.string().max(5_000),
    reason: z.enum(['unsupported', ...resumeCoherenceIssueKinds]).default('unsupported'),
    unsupportedProposition: z.string().max(5_000).optional() })).max(200).default([]),
  // Absent from clients loaded before coherence rewrites started from the previous version.
  previousContent: resumeSectionContentSchema.nullable().default(null),
})
export const resumeFieldValidationInputSchema = z.strictObject({
  section: sectionSchema, fields: z.array(tailoredResumeFieldSchema).max(200), candidateFacts: candidateFactsSchema,
  locale: localeSchema, purpose: purposeSchema,
  // Sent by browsers that read unsupported propositions; a tab loaded before them would reject the key.
  namesUnsupportedPropositions: z.literal(true).optional(),
})
export const resumeCoherenceInputSchema = z.strictObject({ document: professionalResumeDocumentSchema })

export const resumeFieldValidationSchema = z.strictObject({
  // Strict structured output requires every key, so a supported field states a null proposition.
  fields: z.array(z.strictObject({ fieldId: z.string().min(1), supported: z.boolean(),
    unsupportedProposition: z.string().max(5_000).nullable() })),
})
/** The validation a route returns to the browser: a supported field carries no proposition. */
export const resumeFieldValidationResponseSchema = z.strictObject({ fields: z.array(
  resumeFieldValidationSchema.shape.fields.element.extend({ unsupportedProposition: z.string().max(5_000).optional() })) })
export const resumeDocumentCoherenceSchema = z.strictObject({ coherent: z.boolean(), languageMatches: z.boolean(),
  issues: z.array(z.strictObject({ fieldId: z.string().min(1), kind: z.enum(resumeCoherenceIssueKinds) })).max(200) })

export const resumeModelUsageSchema = z.strictObject({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) })
export function resumeStructuredOutputFormat({ name, schema }: Readonly<{ name: string; schema: z.ZodType }>) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-7', override: useAnyOfForUnions })
  return { type: 'json_schema', name, strict: true,
    schema: Object.fromEntries(Object.entries(jsonSchema).filter(([key]) => key !== '$schema')) } as const
}

// Strict structured outputs reject oneOf; discriminated unions stay exclusive through their literal discriminator.
function useAnyOfForUnions({ jsonSchema }: Readonly<{ jsonSchema: { anyOf?: unknown; oneOf?: unknown } }>) {
  if (jsonSchema.oneOf === undefined) return
  jsonSchema.anyOf = jsonSchema.oneOf
  delete jsonSchema.oneOf
}
