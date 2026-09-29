import { z } from 'zod'

import {
  correctionKinds,
  journeyPhases,
  matchScoreBands,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type { PrivacySafeTelemetryEvent } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

const matchScoreBandSchema = z.enum(matchScoreBands)

export const privacySafeAnalyticsEventSchema = z.discriminatedUnion('name', [
  z.strictObject({ name: z.literal('resume-tailoring-opened') }),
  z.strictObject({
    name: z.literal('candidate-journey-phase-reached'),
    phase: z.enum(journeyPhases),
  }),
  z.strictObject({ name: z.literal('candidate-session-deleted') }),
  z.strictObject({ name: z.literal('candidate-session-expired') }),
  z.strictObject({
    name: z.literal('resume-usefulness-rated'),
    hasComment: z.boolean(),
    matchScoreBand: matchScoreBandSchema,
    useful: z.boolean(),
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
