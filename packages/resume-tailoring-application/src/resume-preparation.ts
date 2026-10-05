import { createActor, toPromise } from 'xstate'
import { resumePreparationMachine } from './resume-preparation-machines'
import type { ResumePreparationMachineInput, ResumePreparationMachineOutput } from './resume-preparation-machines'

export type { ResumeSectionsRequest } from './resume-sections'

/**
 * Model qualification seam, not a Candidate path: runs the production section-by-section preparation
 * outside the Candidate Journey, so qualification measures the same planning, concurrency, retries and coherence
 * check a Candidate gets. Behavior tests keep exercising preparation through the Candidate Journey.
 */
export function prepareResumeSections(input: Omit<ResumePreparationMachineInput, 'resumeFrom'>): Promise<ResumePreparationMachineOutput> {
  // Qualification always measures a fresh preparation: no section is restored from a saved snapshot.
  return toPromise(createActor(resumePreparationMachine, { input: { ...input, resumeFrom: [] } }).start())
}
