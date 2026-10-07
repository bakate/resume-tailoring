import { z } from 'zod'
import { candidateSessionSchema } from './candidate-session'

export const resumeRenderRequestSchema = z.strictObject({
  draft: z.strictObject({
    document: candidateSessionSchema.shape.tailoredResume.unwrap(),
    revision: z.string().min(1).max(200),
  }),
  unsupportedFieldIds: z.array(z.string().min(1)),
  photoDataUrl: z.string().max(2_000_000)
    .regex(/^data:image\/(?:jpeg|png|webp);base64,[a-zA-Z0-9+/]+=*$/u).optional(),
})

const revision = z.string()
const pageCount = z.union([z.literal(1), z.literal(2)])
export const resumeRenderResponseSchema = z.strictObject({
  assessment: z.strictObject({
    layout: z.discriminatedUnion('status', [
      z.strictObject({ status: z.literal('fits'), revision, pageCount }),
      z.strictObject({ status: z.literal('overflow'), revision, pageCount: z.number().int().min(3) }),
    ]),
    exportEligibility: z.discriminatedUnion('status', [
      z.strictObject({ status: z.literal('eligible'), revision, pageCount }),
      z.strictObject({ status: z.literal('blocked'), revision, reasons: z.array(z.enum([
        'unsupported-content', 'missing-identity', 'missing-contact', 'overflow', 'layout-unavailable', 'stale-layout',
      ])) }),
    ]),
  }),
  pdf: z.base64().transform((pdf) => Uint8Array.from(atob(pdf), (value) => value.charCodeAt(0))).nullable(),
})
