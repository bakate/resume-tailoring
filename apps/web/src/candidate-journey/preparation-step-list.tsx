import { Group, SimpleGrid, Text } from '@mantine/core'
import { IconCircleCheck, IconCircleDashed, IconLoader2 } from '@tabler/icons-react'

import type { CandidateJourneyPhase } from '@resume-tailoring/application/candidate-journey'
import type { Localization } from '../localization/localization'
import { readPreparationSteps } from './preparation-steps'
import type { PreparationStepState } from './preparation-steps'
import './preparation-step-list.css'

const stepIcons = {
  done: IconCircleCheck,
  current: IconLoader2,
  upcoming: IconCircleDashed,
} as const satisfies Record<PreparationStepState, unknown>

/**
 * The three steps of a resume preparation, each with an icon for its state. The icon is decoration: the state is also
 * spoken, and the current step is marked as such for assistive tech.
 */
export function PreparationStepList({ activePhase, localization }: Readonly<{
  activePhase: CandidateJourneyPhase; localization: Localization
}>) {
  return <SimpleGrid className="preparation-step-list" cols={{ base: 1, sm: 3 }} component="ol" spacing="sm">
    {readPreparationSteps({ activePhase }).map(({ phase, state }) => {
      const Icon = stepIcons[state]
      return <Group aria-current={state === 'current' ? 'step' : undefined} component="li" gap="xs" key={phase} wrap="nowrap">
        <Icon aria-hidden="true" className={`preparation-step-icon-${state}`} size={20} stroke={2} />
        <Text c={state === 'upcoming' ? 'dimmed' : undefined} fw={state === 'current' ? 700 : 500} size="sm">
          {localization.translate(`preparationSteps.${phase}`)}
          <span className="sr-only"> ({localization.translate(`preparationSteps.state.${state}`)})</span>
        </Text>
      </Group>
    })}
  </SimpleGrid>
}

/** The spinner shown beside an operation that is not a resume preparation. */
export function OperationSpinner() {
  return <IconLoader2 aria-hidden="true" className="preparation-step-icon-current" size={20} stroke={2} />
}
