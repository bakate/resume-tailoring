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
  const { color, Icon } = tones[tone]
  return <Group gap="xs" justify="space-between" wrap="wrap">
    <Group gap="xs" wrap="nowrap" align="flex-start" role={tone === 'error' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" className="status-message-icon" size={20} stroke={2}
        color={`var(--mantine-color-${color}-8)`} />
      <Text id={id} size="sm" c={tone === 'error' ? 'danger.8' : undefined}>{children}</Text>
    </Group>
    {action ?? null}
  </Group>
}
