import { z } from 'zod'

import {
  correctionKinds,
  fidelityAssessments,
  matchScoreBands,
  relevanceAssessments,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type { PrivacySafeTelemetryEvent } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

const matchScoreBandSchema = z.enum(matchScoreBands)

export const privacySafeAnalyticsEventSchema = z.discriminatedUnion('name', [
  z.strictObject({ name: z.literal('resume-tailoring-opened') }),
  z.strictObject({ name: z.literal('candidate-session-deleted') }),
  z.strictObject({ name: z.literal('candidate-session-expired') }),
  z.strictObject({
    name: z.literal('resume-fidelity-rated'),
    assessment: z.enum(fidelityAssessments),
    matchScoreBand: matchScoreBandSchema,
  }),
  z.strictObject({
    name: z.literal('resume-relevance-rated'),
    assessment: z.enum(relevanceAssessments),
    matchScoreBand: matchScoreBandSchema,
  }),
  z.strictObject({
    name: z.literal('resume-correction-recorded'),
    correctionKind: z.enum(correctionKinds),
    matchScoreBand: matchScoreBandSchema.optional(),
  }),
  z.strictObject({
    name: z.literal('resume-downloaded'),
    matchScoreBand: matchScoreBandSchema,
  }),
]) satisfies z.ZodType<PrivacySafeTelemetryEvent>

export type PrivacySafeAnalyticsEvent = z.infer<typeof privacySafeAnalyticsEventSchema>

type AnalyticsSchemaMatchesContract =
  [PrivacySafeTelemetryEvent] extends [PrivacySafeAnalyticsEvent]
    ? [PrivacySafeAnalyticsEvent] extends [PrivacySafeTelemetryEvent] ? true : false
    : false

export const analyticsSchemaMatchesContract: AnalyticsSchemaMatchesContract = true
