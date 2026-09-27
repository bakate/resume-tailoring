import { z } from 'zod'

import { resumePdfFailureTypes } from './tailored-resume-contract'

const resumeClaimIdSchema = z.string().regex(/^resume-claim-[\w-]+$/u).max(200)
  .transform((claimId) => claimId as `resume-claim-${string}`)
const sourceProfileFactIdSchema = z.string().regex(/^source-fact-[\w-]+$/u).max(200)
  .transform((factId) => factId as `source-fact-${string}`)
const resumeItemSchema = z.object({
  claimId: resumeClaimIdSchema,
  factIds: z.array(sourceProfileFactIdSchema).min(1).max(20),
  kind: z.enum(['experience', 'skill', 'education', 'language', 'project']),
  text: z.string().trim().min(1).max(500),
}).strict()
const validatedClaimSchema = z.object({
  id: resumeClaimIdSchema,
  segments: z.array(z.object({
    factIds: z.array(sourceProfileFactIdSchema).min(1).max(20),
    text: z.string().trim().min(1).max(500),
  }).strict()).min(1).max(20),
}).strict()
const verifiedFactSchema = z.object({
  id: sourceProfileFactIdSchema,
  kind: z.enum(['experience', 'skill', 'education', 'language', 'project']),
  value: z.string().trim().min(1).max(500),
}).strict()
const contactItemSchema = z.object({
  kind: z.enum(['address', 'email', 'phone', 'url']),
  value: z.string().trim().min(1).max(500),
}).strict()

export const resumePdfRequestSchema = z.object({
  contactItems: z.array(contactItemSchema).max(20),
  document: z.object({
    items: z.array(resumeItemSchema).min(1).max(30),
    omittedClaimCount: z.number().int().nonnegative().max(100),
    typography: z.enum(['comfortable', 'compact', 'dense']),
  }).strict(),
  locale: z.enum(['en', 'fr']),
  photoDataUrl: z.string()
    .max(2_800_000)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/u)
    .optional(),
  validatedClaims: z.array(validatedClaimSchema).min(1).max(30),
  verifiedFacts: z.array(verifiedFactSchema).min(1).max(500),
}).strict()

export const resumePdfFailureSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    type: z.enum(resumePdfFailureTypes),
  }).strict(),
}).strict()
