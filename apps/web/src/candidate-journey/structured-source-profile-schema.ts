import { z } from 'zod'

export const structuredSourceProfileSchema = z.strictObject({
  certifications: z.array(z.strictObject({
    issuedAt: z.string().min(1).nullable(),
    issuer: z.string().min(1).nullable(),
    name: z.string().min(1),
  })),
  education: z.array(z.strictObject({
    institution: z.string().min(1).nullable(),
    qualification: z.string().min(1).nullable(),
  })),
  experiences: z.array(z.strictObject({
    achievements: z.array(z.string().min(1)),
    context: z.string().min(1).nullable(),
    endDate: z.string().min(1).nullable(),
    // Optional so a Source Profile saved before locations were extracted still restores.
    location: z.string().min(1).nullable().optional(),
    organization: z.string().min(1).nullable(),
    role: z.string().min(1).nullable(),
    startDate: z.string().min(1).nullable(),
  })),
  languages: z.array(z.strictObject({
    name: z.string().min(1),
    proficiency: z.string().min(1).nullable(),
  })),
  projects: z.array(z.strictObject({
    description: z.string().min(1).nullable(),
    name: z.string().min(1),
  })),
  skills: z.array(z.strictObject({
    category: z.string().min(1).nullable(),
    name: z.string().min(1),
  })),
})

export const structuredSourceProfileExtractionSchema = structuredSourceProfileSchema.extend({
  // Strict structured output requires every key, so the model always states a location, or null.
  experiences: z.array(structuredSourceProfileSchema.shape.experiences.element.extend({
    location: z.string().min(1).nullable(),
  })),
  criticalAmbiguities: z.array(z.strictObject({
    path: z.string().regex(/^(?:experiences|projects|skills|education|languages|certifications)\.\d+\.[a-zA-Z]+\.\d+$/u),
    question: z.string().min(1).max(300),
  })),
})

export const structuredSourceProfileRequestSchema = z.strictObject({
  professionalContent: z.string().trim().min(1).max(50_000),
})

export const structuredSourceProfileSuccessSchema = z.strictObject({
  ok: z.literal(true),
  value: structuredSourceProfileExtractionSchema,
})

export const structuredSourceProfileResponseFormat = {
  type: 'json_schema',
  name: 'structured_source_profile',
  strict: true,
  schema: z.toJSONSchema(structuredSourceProfileExtractionSchema, { target: 'draft-7' }),
} as const
