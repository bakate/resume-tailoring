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
  'validated', 'copied-from-source', 'unsupported', 'consent-required', ...apiFailureTypes, 'network', 'unexpected-response',
] as const
export const resumePreparationOutcomes = ['prepared', 'failed'] as const
export const resumeRenderFailureCategories = [
  'timeout', 'server', 'network', 'access', 'schema', 'revision-mismatch', 'render',
] as const
/**
 * The timed phases of one preparation, in the order they run, then the wait from its start to the first PDF the
 * Candidate can download. Resume Sections and coherence repeat when coherence sends sections back for rewriting.
 */
export const timedPreparationPhases = [
  'intake', 'job-posting-extraction', 'match-evidence', 'resume-sections', 'coherence', 'overflow-reduction',
  'first-downloadable-pdf',
] as const
/** Where an uncaught error surfaced; its message and stack are never reported, as they can quote Candidate content. */
export const uncaughtErrorSources = ['render', 'error', 'unhandled-rejection'] as const

export type TimedPreparationPhase = typeof timedPreparationPhases[number]
export type MatchScoreBand = typeof matchScoreBands[number]
export type UncaughtErrorSource = typeof uncaughtErrorSources[number]

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
  /**
   * One completed phase of one preparation. The preparation identifier is random, generated when the preparation starts
   * and carried only by its own timings, so it links them to nothing else: not the Candidate, the session or the content.
   */
  | Readonly<{
      name: 'preparation-phase-timed'
      preparationId: string
      phase: Exclude<TimedPreparationPhase, 'overflow-reduction'>
      durationMilliseconds: number
    }>
  | Readonly<{
      name: 'preparation-phase-timed'
      preparationId: string
      phase: 'overflow-reduction'
      durationMilliseconds: number
      /** How many times Overflow Reduction rendered the resume to measure it. */
      renderCount: number
    }>
  | Readonly<{
      name: 'uncaught-error-reported'
      source: UncaughtErrorSource
    }>
