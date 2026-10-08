import type { JobMatch } from '@resume-tailoring/application/job-match'

import type { StatusTone } from './status-message'

type RequirementCoverage = JobMatch['analysis']['requirementGroups'][number]['coverage']
type CriticalReserveState = JobMatch['analysis']['criticalRequirementReserve']['status']

/** Each Requirement Coverage told by its own tone, so its icon, not only its colour, sets it apart. */
export const coverageTones = {
  covered: 'success',
  'partially-covered': 'warning',
  uncovered: 'error',
} as const satisfies Record<RequirementCoverage, StatusTone>

/** The Critical Requirement Reserve headlined by its state: every critical requirement covered, or not. */
export function readCriticalReserveStatus({ status }: Readonly<{ status: CriticalReserveState }>) {
  return {
    tone: status === 'clear' ? 'success' : 'warning',
    headingKey: `jobMatch.criticalReserve.heading.${status}`,
    messageKey: `jobMatch.criticalReserve.${status}`,
  } as const
}
