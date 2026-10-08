import type { JobMatch } from '@resume-tailoring/application/job-match'

import type { StatusTone } from './status-message'

export type RequirementCoverage = JobMatch['analysis']['requirementGroups'][number]['coverage']
type CriticalReserveState = JobMatch['analysis']['criticalRequirementReserve']['status']

/** Each Requirement Coverage told by its own tone, so its icon, not only its colour, sets it apart. */
export const coverageTones = {
  covered: 'success',
  'partially-covered': 'warning',
  uncovered: 'error',
} as const satisfies Record<RequirementCoverage, StatusTone>

const criticalReserveTones = { clear: 'success', present: 'warning' } as const satisfies Record<CriticalReserveState, StatusTone>

/** The Critical Requirement Reserve headlined by its state: every critical requirement covered, or not all fully. */
export function readCriticalReserveStatus({ status }: Readonly<{ status: CriticalReserveState }>) {
  return {
    tone: criticalReserveTones[status],
    headingKey: `jobMatch.criticalReserve.heading.${status}`,
    messageKey: `jobMatch.criticalReserve.${status}`,
  } as const
}
