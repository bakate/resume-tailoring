import { Group, Text } from '@mantine/core'
import { IconAlertTriangle, IconCircleCheck, IconCircleX, IconInfoCircle } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import './status-message.css'

export type StatusTone = 'success' | 'warning' | 'error' | 'info'

const tones = {
  success: { color: 'forest', Icon: IconCircleCheck },
  warning: { color: 'caution', Icon: IconAlertTriangle },
  error: { color: 'danger', Icon: IconCircleX },
  info: { color: 'informative', Icon: IconInfoCircle },
} as const satisfies Record<StatusTone, unknown>

/**
 * One state told the same way everywhere: an icon for its tone, one sentence, and at most one action. An error is
 * announced as an alert, any other tone politely; the icon is decoration, so the sentence carries the meaning.
 */
export function StatusMessage({ tone, children, action, id }: Readonly<{
  tone: StatusTone; children: string; action?: ReactNode; id?: string
}>) {
  return <Group gap="xs" justify="space-between" wrap="wrap">
    <Group gap="xs" wrap="nowrap" align="flex-start" role={tone === 'error' ? 'alert' : 'status'}>
      <StatusIcon tone={tone} />
      <Text id={id} size="sm" c={tone === 'error' ? 'danger.8' : undefined}>{children}</Text>
    </Group>
    {action ?? null}
  </Group>
}

/** The icon of a tone, decoration beside the words that carry its meaning. */
export function StatusIcon({ tone, size = 20 }: Readonly<{ tone: StatusTone; size?: number }>) {
  const { color, Icon } = tones[tone]
  return <Icon aria-hidden="true" className="status-message-icon" size={size} stroke={2}
    color={`var(--mantine-color-${color}-8)`} />
}

/** The theme colour of a tone, for a surface such as a badge that carries its icon. */
export function readStatusColor({ tone }: Readonly<{ tone: StatusTone }>) {
  return tones[tone].color
}
