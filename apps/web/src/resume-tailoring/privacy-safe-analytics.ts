import { z } from 'zod'

import { correctionKinds, journeyPhases, matchScoreBands, resumePreparationOutcomes, resumeRenderFailureCategories, resumeSectionKinds, resumeSectionOutcomes, timedPreparationPhases, uncaughtErrorSources } from '@resume-tailoring/application/privacy-safe-telemetry'
import type { PrivacySafeTelemetryEvent } from '@resume-tailoring/application/privacy-safe-telemetry'

const matchScoreBandSchema = z.enum(matchScoreBands)
const metricCountSchema = z.number().int().min(0).max(10_000_000)
/** A random UUID, so no Candidate content can travel in place of the preparation identifier. */
const preparationIdSchema = z.uuid()

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
  z.discriminatedUnion('phase', [
    z.strictObject({
      name: z.literal('preparation-phase-timed'),
      preparationId: preparationIdSchema,
      phase: z.enum(timedPreparationPhases).exclude(['overflow-reduction']),
      durationMilliseconds: metricCountSchema,
    }),
    z.strictObject({
      name: z.literal('preparation-phase-timed'),
      preparationId: preparationIdSchema,
      phase: z.literal('overflow-reduction'),
      durationMilliseconds: metricCountSchema,
      renderCount: metricCountSchema,
    }),
  ]),
  z.strictObject({
    name: z.literal('uncaught-error-reported'),
    source: z.enum(uncaughtErrorSources),
  }),
]) satisfies z.ZodType<PrivacySafeTelemetryEvent>

export type PrivacySafeAnalyticsEvent = z.infer<typeof privacySafeAnalyticsEventSchema>

type AnalyticsSchemaMatchesContract =
  [PrivacySafeTelemetryEvent] extends [PrivacySafeAnalyticsEvent]
    ? [PrivacySafeAnalyticsEvent] extends [PrivacySafeTelemetryEvent] ? true : false
    : false

export const analyticsSchemaMatchesContract: AnalyticsSchemaMatchesContract = true
