import { Group, SimpleGrid, Text } from '@mantine/core'
import { IconCircleCheck, IconCircleDashed, IconCircleDot } from '@tabler/icons-react'

import type { CandidateJourneyPhase } from '@resume-tailoring/application/candidate-journey'
import type { Localization } from '../localization/localization'
import { readPhaseProgress } from './phase-progress'
import type { PhaseProgressState } from './phase-progress'
import './phase-progress-list.css'

const stateIcons = {
  done: IconCircleCheck,
  current: IconCircleDot,
  upcoming: IconCircleDashed,
} as const satisfies Record<PhaseProgressState, unknown>

/**
 * The three Candidate Journey phases of a preparation, each with an icon for its state. The icon is decoration: the
 * state is also spoken, and the current phase is marked as the current step for assistive tech. The current phase
 * holds still: the step under way, shown below, carries the only spinner of the panel.
 */
export function PhaseProgressList({ activePhase, localization }: Readonly<{
  activePhase: CandidateJourneyPhase; localization: Localization
}>) {
  return <SimpleGrid className="phase-progress-list" cols={{ base: 1, sm: 3 }} component="ol" spacing="sm">
    {readPhaseProgress({ activePhase }).map(({ phase, state }) => {
      const Icon = stateIcons[state]
      return <Group aria-current={state === 'current' ? 'step' : undefined} component="li" gap="xs" key={phase} wrap="nowrap">
        <Icon aria-hidden="true" className={`phase-progress-icon-${state}`} size={20} stroke={2} />
        <Text c={state === 'upcoming' ? 'dimmed' : undefined} fw={state === 'current' ? 700 : 500} size="sm">
          {localization.translate(`phaseProgress.${phase}`)}
          <span className="sr-only"> ({localization.translate(`phaseProgress.state.${state}`)})</span>
        </Text>
      </Group>
    })}
  </SimpleGrid>
}
