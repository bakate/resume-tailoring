import { Group, Progress, Stack, Text } from '@mantine/core'
import { IconLoader2 } from '@tabler/icons-react'

import type { PreparationProgress, PreparationProgressPhase } from '@resume-tailoring/application/candidate-journey'
import type { Localization } from '../localization/localization'
import { readPreparationCompletion } from './phase-progress'
import './preparation-phase-status.css'

/** The translation key naming each preparation phase, which the polite status region also announces. */
export function readPreparationPhaseKey(phase: PreparationProgressPhase) {
  return `preparationPhase.${phase}` as const
}

/**
 * The phase a preparation is in, how much of the preparation is done, and the Resume Sections written out of the
 * total once they are planned. The count keeps its line before then, so the panel does not grow when it appears; the
 * phase is announced elsewhere, politely, so the progress bar is only read when the Candidate reaches it.
 */
export function PreparationPhaseStatus({ localization, progress }: Readonly<{
  localization: Localization; progress: PreparationProgress
}>) {
  const { sectionCount } = progress
  return <Stack className="preparation-phase-status" gap={6}>
    <Group gap="xs" wrap="nowrap">
      <IconLoader2 aria-hidden="true" className="progress-spinner" size={20} stroke={2} />
      <Text fw={700}>{localization.translate(readPreparationPhaseKey(progress.phase))}</Text>
    </Group>
    <Progress.Root radius="xl" size="sm" transitionDuration={400}>
      <Progress.Section animated aria-label={localization.translate('preparationPhase.completion')} color="forest"
        value={readPreparationCompletion(progress)} />
    </Progress.Root>
    <Text c="dimmed" className="preparation-phase-status-count" size="sm">
      {sectionCount === null ? ' ' : localization.translate('preparationPhase.sectionCount')
        .replace('{written}', String(sectionCount.written)).replace('{total}', String(sectionCount.total))}
    </Text>
  </Stack>
}
