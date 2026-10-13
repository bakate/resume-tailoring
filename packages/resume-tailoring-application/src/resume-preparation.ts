import { createActor, toPromise } from 'xstate'
import { readPreparationFailureReasons, resumePreparationMachine } from './resume-preparation-machines'
import type { ResumePreparationFailureReason, ResumePreparationMachineInput, ResumePreparationMachineOutput }
  from './resume-preparation-machines'

export type { ResumeAttemptRejection, ResumePreparationFailureReason } from './resume-preparation-machines'
export type { ResumeSectionsRequest } from './resume-sections'

/** A failed preparation also says, content-free, why it failed; the Candidate is never shown this. */
export type ResumeSectionsPreparation = Exclude<ResumePreparationMachineOutput, Readonly<{ status: 'failed' }>>
  | (Extract<ResumePreparationMachineOutput, Readonly<{ status: 'failed' }>>
    & Readonly<{ failureReasons: readonly ResumePreparationFailureReason[] }>)

/**
 * Model qualification seam, not a Candidate path: runs the production section-by-section preparation
 * outside the Candidate Journey, so qualification measures the same planning, concurrency, retries and coherence
 * check a Candidate gets. Behavior tests keep exercising preparation through the Candidate Journey.
 */
export async function prepareResumeSections(input: Omit<ResumePreparationMachineInput, 'resumeFrom'>): Promise<ResumeSectionsPreparation> {
  // Qualification always measures a fresh preparation: no section is restored from a saved snapshot.
  const actor = createActor(resumePreparationMachine, { input: { ...input, resumeFrom: [] } }).start()
  const output = await toPromise(actor)
  return output.status === 'failed' ? { ...output, failureReasons: readPreparationFailureReasons(actor.getSnapshot().context) } : output
}
