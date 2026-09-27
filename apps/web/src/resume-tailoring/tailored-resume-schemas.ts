import { z } from 'zod'

const resumeClaimIdSchema = z.string().regex(/^resume-claim-[\w-]+$/u).max(200)
  .transform((claimId) => claimId as `resume-claim-${string}`)
const resumeItemSchema = z.object({
  claimId: resumeClaimIdSchema,
  kind: z.enum(['experience', 'skill', 'education', 'language', 'project']),
  text: z.string().trim().min(1).max(500),
}).strict()
const contactItemSchema = z.object({
  kind: z.enum(['address', 'email', 'phone', 'url']),
  value: z.string().trim().min(1).max(500),
}).strict()

export const resumePdfRequestSchema = z.object({
  contactItems: z.array(contactItemSchema).max(20),
  document: z.object({
    items: z.array(resumeItemSchema).min(1).max(100),
    omittedClaimCount: z.number().int().nonnegative().max(100),
    typography: z.enum(['comfortable', 'compact', 'dense']),
  }).strict(),
  locale: z.enum(['en', 'fr']),
  photoDataUrl: z.string()
    .max(2_800_000)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/u)
    .optional(),
}).strict()

export const resumePdfFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    type: z.enum([
      'resume-pdf-content-mismatch',
      'resume-pdf-fonts-not-embedded',
      'resume-pdf-overflow',
      'resume-pdf-page-count-invalid',
      'resume-pdf-rendering-unavailable',
      'resume-pdf-request-invalid',
    ]),
  }).strict(),
}).strict()
