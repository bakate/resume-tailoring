import { apiFailureTypes } from './api-failure'
import { resumeSectionKinds } from './resume-sections'

export { resumeSectionKinds }

export const matchScoreBands = ['0-24', '25-49', '50-74', '75-100'] as const
export const correctionKinds = [
  'source-profile-fact',
  'resume-claim-removal',
  'resume-claim-reorder',
  'resume-claim-reformulation',
  'resume-claim-edit',
] as const
export const journeyPhases = [
  'source-intake',
  'job-match',
  'tailored-resume-preparation',
] as const
/** A failed section reports the API Failure its last model call read, so retries can be measured per type. */
export const resumeSectionOutcomes = [
  'validated', 'unsupported', 'consent-required', ...apiFailureTypes, 'network', 'unexpected-response',
] as const
export const resumePreparationOutcomes = ['prepared', 'failed'] as const
export const resumeRenderFailureCategories = [
  'timeout', 'server', 'network', 'access', 'schema', 'revision-mismatch', 'render',
] as const

export type MatchScoreBand = typeof matchScoreBands[number]

export type PrivacySafeTelemetryEvent =
  | Readonly<{ name: 'resume-tailoring-opened' }>
  | Readonly<{
      name: 'candidate-journey-phase-reached'
      phase: typeof journeyPhases[number]
    }>
  | Readonly<{ name: 'candidate-session-deleted' }>
  | Readonly<{ name: 'candidate-session-expired' }>
  | Readonly<{
      name: 'resume-usefulness-rated'
      hasComment: boolean
      matchScoreBand: MatchScoreBand
      useful: boolean
    }>
  | Readonly<{
      name: 'resume-correction-recorded'
      correctionKind: typeof correctionKinds[number]
      matchScoreBand?: MatchScoreBand
    }>
  | Readonly<{
      name: 'resume-downloaded'
      matchScoreBand: MatchScoreBand
    }>
  | Readonly<{
      name: 'resume-section-prepared'
      sectionKind: typeof resumeSectionKinds[number]
      outcome: typeof resumeSectionOutcomes[number]
      attemptCount: number
      durationMilliseconds: number
      inputTokens: number
      outputTokens: number
    }>
  | Readonly<{
      name: 'resume-preparation-completed'
      outcome: typeof resumePreparationOutcomes[number]
      durationMilliseconds: number
      sectionCount: number
    }>
  | Readonly<{
      name: 'resume-render-failed'
      category: typeof resumeRenderFailureCategories[number]
      retried: boolean
    }>
