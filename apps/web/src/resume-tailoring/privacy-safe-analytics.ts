import { z } from 'zod'

import {
  correctionKinds,
  journeyPhases,
  matchScoreBands,
  resumePreparationOutcomes,
  resumeRenderFailureCategories,
  resumeSectionKinds,
  resumeSectionOutcomes,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import type { PrivacySafeTelemetryEvent } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

const matchScoreBandSchema = z.enum(matchScoreBands)
const metricCountSchema = z.number().int().min(0).max(10_000_000)

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
  z.strictObject({
    name: z.literal('resume-section-prepared'),
    sectionKind: z.enum(resumeSectionKinds),
    outcome: z.enum(resumeSectionOutcomes),
    attemptCount: metricCountSchema,
    durationMilliseconds: metricCountSchema,
    inputTokens: metricCountSchema,
    outputTokens: metricCountSchema,
  }),
  z.strictObject({
    name: z.literal('resume-preparation-completed'),
    outcome: z.enum(resumePreparationOutcomes),
    durationMilliseconds: metricCountSchema,
    sectionCount: metricCountSchema,
  }),
  z.strictObject({
    name: z.literal('resume-render-failed'),
    category: z.enum(resumeRenderFailureCategories),
    retried: z.boolean(),
  }),
]) satisfies z.ZodType<PrivacySafeTelemetryEvent>

export type PrivacySafeAnalyticsEvent = z.infer<typeof privacySafeAnalyticsEventSchema>

type AnalyticsSchemaMatchesContract =
  [PrivacySafeTelemetryEvent] extends [PrivacySafeAnalyticsEvent]
    ? [PrivacySafeAnalyticsEvent] extends [PrivacySafeTelemetryEvent] ? true : false
    : false

export const analyticsSchemaMatchesContract: AnalyticsSchemaMatchesContract = true
