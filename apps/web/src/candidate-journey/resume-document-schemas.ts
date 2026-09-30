import { z } from 'zod'
import { jobMatchSchema, sourceIntakeSchema, tailoredResumeSchema } from './candidate-session'

export const professionalResumeDocumentSchema = tailoredResumeSchema.omit({ identity: true, contactDetails: true, sectionOrder: true })
export const resumeWritingInputSchema = z.strictObject({
  candidateFacts: sourceIntakeSchema.shape.candidateFacts.max(2_000),
  jobMatch: jobMatchSchema,
  locale: z.enum(['en', 'fr']), purpose: z.enum(['tailored', 'normalized']),
})
export const resumeValidationInputSchema = z.strictObject({
  candidateFacts: sourceIntakeSchema.shape.candidateFacts.max(2_000),
  document: professionalResumeDocumentSchema,
})
export const resumeDocumentValidationSchema = z.strictObject({
  coherent: z.boolean(), languageMatches: z.boolean(),
  fields: z.array(z.strictObject({ fieldId: z.string().min(1), supported: z.boolean() })),
})
export const resumeModelFailureSchema = z.strictObject({ ok: z.literal(false),
  error: z.strictObject({ type: z.literal('unavailable'), transient: z.boolean().optional() }) })

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
