import { z } from 'zod'
import { resumeSectionKinds } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionKind } from '@resume-tailoring/application/candidate-journey'
import { sourceIntakeSchema, tailoredResumeFieldSchema, tailoredResumeSchema } from './candidate-session'

export const professionalResumeDocumentSchema = tailoredResumeSchema.omit({ identity: true, contactDetails: true, sectionOrder: true })

const fieldsSchema = z.strictObject({ fields: z.array(tailoredResumeFieldSchema) })

/** One strict structured-output schema per Resume Section kind, each a slice of the professional document. */
export const resumeSectionOutputSchemas = {
  'value-proposition': z.strictObject({ paragraphs: z.array(tailoredResumeFieldSchema) }),
  experience: tailoredResumeSchema.shape.experiences.element,
  skills: z.strictObject({ groups: z.array(z.strictObject({ id: z.string().min(1),
    category: tailoredResumeFieldSchema.nullable(), items: z.array(tailoredResumeFieldSchema) })) }),
  education: fieldsSchema, languages: fieldsSchema, projects: fieldsSchema, certifications: fieldsSchema,
} as const satisfies Record<ResumeSectionKind, z.ZodType>

const sectionSchema = z.strictObject({ key: z.string().regex(/^(?:value-proposition|experiences\.\d+|skills|education|languages|projects|certifications)$/u),
  kind: z.enum(resumeSectionKinds) })
const candidateFactsSchema = sourceIntakeSchema.shape.candidateFacts.max(500)
const localeSchema = z.enum(['en', 'fr'])
const purposeSchema = z.enum(['tailored', 'normalized'])

export const resumeSectionWritingInputSchema = z.strictObject({
  section: sectionSchema, candidateFacts: candidateFactsSchema,
  targetRole: z.string().max(500).nullable(), jobRequirements: z.array(z.string().max(1_000)).max(60),
  relevantFactIds: z.array(sourceIntakeSchema.shape.candidateFacts.element.shape.id).max(500),
  locale: localeSchema, purpose: purposeSchema,
  rejectedFields: z.array(z.strictObject({ fieldId: z.string().min(1), text: z.string().max(5_000) })).max(200),
})
export const resumeFieldValidationInputSchema = z.strictObject({
  section: sectionSchema, fields: z.array(tailoredResumeFieldSchema).max(200), candidateFacts: candidateFactsSchema,
  locale: localeSchema, purpose: purposeSchema,
})
export const resumeCoherenceInputSchema = z.strictObject({ document: professionalResumeDocumentSchema })

export const resumeFieldValidationSchema = z.strictObject({
  fields: z.array(z.strictObject({ fieldId: z.string().min(1), supported: z.boolean() })),
})
export const resumeDocumentCoherenceSchema = z.strictObject({ coherent: z.boolean(), languageMatches: z.boolean() })

export const resumeModelUsageSchema = z.strictObject({ inputTokens: z.number().int().min(0), outputTokens: z.number().int().min(0) })
export const resumeSectionModelFailureSchema = z.strictObject({ ok: z.literal(false),
  error: z.strictObject({ type: z.enum(['transient', 'timeout', 'permanent']) }), usage: resumeModelUsageSchema.optional() })

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
