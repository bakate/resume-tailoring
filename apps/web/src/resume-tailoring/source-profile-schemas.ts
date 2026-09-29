import {
  sensitiveContentKinds,
  sourceProfileFactKinds,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

const sourceProfilePropositionKeySchema = z.templateLiteral(['proposition-', z.string().min(1)])

const sourceProfileFactContentSchema = z.object({
  kind: z.enum(sourceProfileFactKinds),
  propositionKey: sourceProfilePropositionKeySchema,
  value: z.string(),
})

export const extractedSourceProfileFactContentSchema = sourceProfileFactContentSchema
  .extend({
    assessment: z.enum(['critical-ambiguity', 'usable']),
  })
  .superRefine((fact, context) => {
    if (!isValidPropositionKey({ kind: fact.kind, value: fact.propositionKey })) {
      context.addIssue({ code: 'custom', path: ['propositionKey'], message: 'Invalid proposition key' })
    }
    if (!isAtomicValue({ value: fact.value })) {
      context.addIssue({ code: 'custom', path: ['value'], message: 'Expected one atomic fact' })
    }
  })

export const sensitiveContentSchema = z.object({
  id: z.templateLiteral(['sensitive-', z.string().min(1)]),
  kind: z.enum(sensitiveContentKinds),
  value: z.string(),
})

export const outcomeFeedbackSchema = z.object({
  comment: z.string().max(1_000).optional(),
  useful: z.boolean(),
})

export const sourceProfileExtractionSuccessSchema = z.object({
  ok: z.literal(true),
  value: z.array(extractedSourceProfileFactContentSchema),
})

export const extractedSourceProfileFactsSchema = z.object({
  facts: z.array(extractedSourceProfileFactContentSchema),
})

// Roughly 12,500 English-language tokens, which bounds model cost while
// remaining well above the expected size of a text-based resume.
export const sourceProfileExtractionMaximumCharacters = 50_000

export const sourceProfileExtractionRequestSchema = z.object({
  professionalContent: z.string()
    .max(sourceProfileExtractionMaximumCharacters)
    .refine((value) => value.trim().length > 0),
})

function isValidPropositionKey({
  kind,
  value,
}: Readonly<{ kind: typeof sourceProfileFactKinds[number]; value: string }>) {
  return value.startsWith(`proposition-${kind}-`)
    && value.length <= 200
    && /^proposition-[a-z]+-[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)
}

function isAtomicValue({ value }: Readonly<{ value: string }>) {
  return value.length > 0
    && value.length <= 500
    && value.trim() === value
    && !value.includes('\n')
    && !value.includes(';')
}
