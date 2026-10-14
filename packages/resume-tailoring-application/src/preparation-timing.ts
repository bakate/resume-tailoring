import type { PrivacySafeTelemetryEvent, TimedPreparationPhase } from './privacy-safe-telemetry'

/**
 * The clock of one preparation: when it started, and the phase now running. Its identifier is random and generated
 * when the preparation starts; only this preparation's timings carry it.
 */
export type PreparationTiming = Readonly<{
  preparationId: string
  startedAt: number
  phase: Readonly<{ name: TimedPhase; startedAt: number }> | null
}>

type TimedPhase = Exclude<TimedPreparationPhase, 'first-downloadable-pdf'>

type TimingClock = Readonly<{ now: () => number; record: (event: PrivacySafeTelemetryEvent) => void }>

export function startPreparationTiming({ createIdentifier, now }: Readonly<{
  createIdentifier: () => string; now: () => number
}>): PreparationTiming {
  return { preparationId: createIdentifier(), startedAt: now(), phase: null }
}

/** Records the running phase as completed, if any, and starts timing the next one. */
export function enterPreparationPhase({ timing, phase, clock }: Readonly<{
  timing: PreparationTiming | null; phase: TimedPhase; clock: TimingClock
}>): PreparationTiming | null {
  if (timing?.phase?.name === phase) return timing
  const completed = completePreparationPhase({ timing, clock })
  return completed === null ? null : { ...completed, phase: { name: phase, startedAt: clock.now() } }
}

/** Records the running phase as completed; Overflow Reduction also reports how many renders it used. */
export function completePreparationPhase({ timing, clock, renderCount = 0 }: Readonly<{
  timing: PreparationTiming | null; clock: TimingClock; renderCount?: number
}>): PreparationTiming | null {
  if (timing?.phase == null) return timing
  const { preparationId, phase: { name, startedAt } } = timing
  const durationMilliseconds = Math.max(0, clock.now() - startedAt)
  clock.record(name === 'overflow-reduction'
    ? { name: 'preparation-phase-timed', preparationId, phase: name, durationMilliseconds, renderCount }
    : { name: 'preparation-phase-timed', preparationId, phase: name, durationMilliseconds })
  return { ...timing, phase: null }
}

/** Records the wait from the start of the preparation to its first downloadable PDF; nothing is timed after it. */
export function recordFirstDownloadablePdf({ timing, clock }: Readonly<{
  timing: PreparationTiming; clock: TimingClock
}>): null {
  clock.record({ name: 'preparation-phase-timed', preparationId: timing.preparationId, phase: 'first-downloadable-pdf',
    durationMilliseconds: Math.max(0, clock.now() - timing.startedAt) })
  return null
}
