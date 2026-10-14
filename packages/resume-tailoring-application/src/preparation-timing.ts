import type { PreparationPhase } from './combined-intake'
import type { PrivacySafeTelemetryEvent, SpeculativeFitOutcome, TimedPreparationPhase } from './privacy-safe-telemetry'
import type { ResumeRenderResult } from './resume-export'
import type { ResumePreparationStep } from './resume-preparation-machines'

/**
 * The Preparation Timing of one preparation: when it started, the phase now running, and whether it extracted its
 * Job Posting. Its identifier is random and generated when the preparation starts; only its own timings carry it.
 */
export type PreparationTiming = Readonly<{
  preparationId: string
  startedAt: number
  running: Readonly<{ phase: RunningPhase; startedAt: number }> | null
  extractedJobPosting: boolean
}>

/** A phase timed from its own start; the first downloadable PDF is timed from the start of the preparation. */
export type RunningPhase = Exclude<TimedPreparationPhase, 'first-downloadable-pdf'>

type TimingClock = Readonly<{ now: () => number; record: (event: PrivacySafeTelemetryEvent) => void }>

type TimingUpdate = Readonly<{ timing: PreparationTiming | null; clock: TimingClock }>

const timedSteps = {
  'extracting-source': 'source-intake', 'extracting-posting': 'job-posting-extraction', matching: 'match-evidence',
  'writing-sections': 'resume-sections', 'checking-coherence': 'coherence',
} as const satisfies Record<PreparationPhase | ResumePreparationStep, RunningPhase>

/** The preparation phase a step of the combined intake or of the resume preparation belongs to. */
export function readPreparationStepPhase(step: PreparationPhase | ResumePreparationStep): RunningPhase {
  return timedSteps[step]
}

export function startPreparationTiming({ createIdentifier, now }: Readonly<{
  createIdentifier: () => string; now: () => number
}>): PreparationTiming {
  return { preparationId: createIdentifier(), startedAt: now(), running: null, extractedJobPosting: false }
}

/** Records the running phase as completed, if any, and starts timing the phase of this step. */
export function enterPreparationStep({ timing, clock, step }: TimingUpdate & Readonly<{
  step: PreparationPhase | ResumePreparationStep
}>): PreparationTiming | null {
  return enterPhase({ timing, clock, phase: readPreparationStepPhase(step) })
}

/** Records the phase of the last step as completed, then starts timing Overflow Reduction. */
export function enterOverflowReduction(update: TimingUpdate): PreparationTiming | null {
  return enterPhase({ ...update, phase: 'overflow-reduction' })
}

/** Records the running phase as completed. */
export function completePreparationStep({ timing, clock }: TimingUpdate): PreparationTiming | null {
  if (timing?.running == null || timing.running.phase === 'overflow-reduction') return timing
  const { preparationId, running: { phase, startedAt } } = timing
  clock.record({ name: 'preparation-phase-timed', preparationId, phase, durationMilliseconds: elapsedSince({ clock, startedAt }) })
  return { ...timing, running: null }
}

/**
 * Records Overflow Reduction with the renders it used and whether the fit started during the coherence check was kept;
 * without a render count it did not run and is not timed. It is timed from the end of the coherence check, so a kept
 * fit times only the wait it left. The preparation is still timed to its first downloadable PDF.
 */
export function completeOverflowReduction({ timing, clock, renderCount, speculativeFit }: TimingUpdate & Readonly<{
  renderCount: number | null; speculativeFit: SpeculativeFitOutcome
}>): PreparationTiming | null {
  if (timing?.running?.phase !== 'overflow-reduction') return timing
  const { preparationId, running: { startedAt } } = timing
  if (renderCount !== null) clock.record({ name: 'preparation-phase-timed', preparationId, phase: 'overflow-reduction',
    durationMilliseconds: elapsedSince({ clock, startedAt }), renderCount, speculativeFit })
  return { ...timing, running: null }
}

/**
 * Records the wait from the start of a finished preparation to the first render the preview can offer for download,
 * then stops timing. Only a preparation that extracted its Job Posting is the start of a Tailored Resume: a retry or a
 * language change reuses its inputs, and its shorter wait is not one the Candidate had.
 */
export function timeFirstDownloadablePdf({ timing, clock, result }: TimingUpdate & Readonly<{
  result: ResumeRenderResult | null
}>): PreparationTiming | null {
  if (timing === null || timing.running !== null || result?.pdf == null
    || result.assessment.exportEligibility.status !== 'eligible') return timing
  if (timing.extractedJobPosting) clock.record({ name: 'preparation-phase-timed', preparationId: timing.preparationId,
    phase: 'first-downloadable-pdf', durationMilliseconds: elapsedSince({ clock, startedAt: timing.startedAt }) })
  return null
}

function enterPhase({ timing, clock, phase }: TimingUpdate & Readonly<{ phase: RunningPhase }>): PreparationTiming | null {
  if (timing?.running?.phase === phase) return timing
  const completed = completePreparationStep({ timing, clock })
  return completed === null ? null : { ...completed, running: { phase, startedAt: clock.now() },
    extractedJobPosting: completed.extractedJobPosting || phase === 'job-posting-extraction' }
}

function elapsedSince({ clock, startedAt }: Readonly<{ clock: TimingClock; startedAt: number }>) {
  return Math.max(0, clock.now() - startedAt)
}
