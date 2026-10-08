import { Text } from '@mantine/core'
import type { Localization } from '../localization/localization'

/** Tells the Candidate a Copied Section reuses their own wording; it is never part of the resume itself. */
export function CopiedNotice({ localization }: Readonly<{ localization: Localization }>) {
  return <Text c="dimmed" fs="italic" size="sm">{localization.translate('resumeSections.copied')}</Text>
}
