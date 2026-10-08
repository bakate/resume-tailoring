import { Button, Group, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FailureCause, Recovery, ResumeOperationFailure } from '@resume-tailoring/application/candidate-journey'
import type { Localization } from '../localization/localization'

type FailureRecoveryProps = Readonly<{
  /** Absent when the failure was not a model call; the Recovery then has no explanation of its own. */
  cause: FailureCause | undefined
  recovery: Recovery
  localization: Localization
  busy?: boolean
  /** Runs the failed operation again; renewing access happens when the replayed request asks for it. */
  onRetry: () => void
  /** Leads the Candidate to the text to shorten; without it, the text is already in view and no button is needed. */
  onShortenInput?: () => void
}>

/** Why an operation failed, in the Candidate's words. */
export function FailureExplanation({ cause, localization }: Readonly<{ cause: FailureCause; localization: Localization }>) {
  return <Text size="sm">{localization.translate(`failure.${cause.type}.explanation`)}</Text>
}

/** The Recovery the application derived, offered as the one button that lets the Candidate continue. */
export function RecoveryAction({ busy = false, cause, localization, onRetry, onShortenInput, recovery }: FailureRecoveryProps) {
  const remainingSeconds = useRemainingSeconds(cause)
  if (recovery === 'shorten-input' && onShortenInput === undefined) return null
  const run = recovery === 'reload' ? () => { window.location.reload() }
    : recovery === 'shorten-input' ? onShortenInput : onRetry
  const waited = cause?.type === 'rate-limited' && cause.retryAfterSeconds > 0
  return <><Button disabled={busy || remainingSeconds > 0} onClick={run} variant="default">
    {remainingSeconds > 0 ? <Countdown label={readActionLabel({ cause, localization, remainingSeconds })}
      name={localization.translate('failure.retry')} /> : readActionLabel({ cause, localization, remainingSeconds })}</Button>
    {waited ? <WaitOverAnnouncement {...{ localization, remainingSeconds }} /> : null}</>
}

/**
 * The button sits in an alert, which re-reads any text that changes inside it: the ticking label is hidden from
 * assistive technology behind a stable name, so the countdown never interrupts the explanation.
 */
function Countdown({ label, name }: Readonly<{ label: string; name: string }>) {
  return <><span aria-hidden="true">{label}</span><span className="sr-only">{name}</span></>
}

/**
 * Speaks once, when the wait is over. The region is present from the start, and rendered outside the alert so the
 * alert does not read the message out a second time.
 */
function WaitOverAnnouncement({ localization, remainingSeconds }: Readonly<{ localization: Localization; remainingSeconds: number }>) {
  if (typeof document === 'undefined') return null
  return createPortal(<span aria-atomic="true" aria-live="polite" className="sr-only" role="status">
    {remainingSeconds === 0 ? localization.translate('failure.rate-limited.ready') : ''}</span>, document.body)
}

function readActionLabel({ cause, localization, remainingSeconds }: Readonly<{
  cause: FailureCause | undefined; localization: Localization; remainingSeconds: number
}>) {
  if (cause === undefined) return localization.translate('failure.retry')
  if (cause.type !== 'rate-limited') return localization.translate(`failure.${cause.type}.action`)
  return remainingSeconds > 0
    ? localization.translate('failure.rate-limited.action').replace('{seconds}', String(remainingSeconds))
    : localization.translate('failure.retry')
}

/** Counts down a rate limit from when the failure was first shown. */
function useRemainingSeconds(cause: FailureCause | undefined) {
  const waitSeconds = cause?.type === 'rate-limited' ? cause.retryAfterSeconds : 0
  const [shownAt] = useState(() => Date.now())
  const [now, setNow] = useState(shownAt)
  const remaining = Math.max(0, waitSeconds - Math.floor((now - shownAt) / 1000))
  useEffect(() => {
    if (remaining === 0) return
    const timer = setInterval(() => { setNow(Date.now()) }, 250)
    return () => { clearInterval(timer) }
  }, [remaining])
  return remaining
}

/**
 * A failed edit or proposal on the current resume. A Failure Cause explains it and its Recovery becomes a button; a
 * failure the Candidate resolves in the editor itself says what to do instead.
 */
export function ResumeOperationFailureAlert({ failure, localization, onRetry }: Readonly<{
  failure: Pick<ResumeOperationFailure, 'cause' | 'recovery'>; localization: Localization
  /** Runs the operation that failed again; absent when nothing can be run again. */
  onRetry: (() => void) | undefined
}>) {
  const { cause, recovery } = failure
  return <Stack c="danger.8" gap="xs" role="alert">
    <Text>{localization.translate('failure.review.title')}</Text>
    {cause !== undefined ? <FailureExplanation {...{ cause, localization }} />
      : isEditorResolution(recovery) ? <Text size="sm">{localization.translate(`failure.review.${recovery}`)}</Text> : null}
    {isEditorResolution(recovery) || (onRetry === undefined && recovery !== 'reload') ? null
      : <Group><RecoveryAction {...{ cause, localization, recovery }} onRetry={onRetry ?? noRetry} /></Group>}
  </Stack>
}

function isEditorResolution(recovery: ResumeOperationFailure['recovery']): recovery is Exclude<ResumeOperationFailure['recovery'], Recovery> {
  return recovery === 'renew-consent' || recovery === 'correct-content' || recovery === 'retry-current-draft'
}

function noRetry() { /* A reload needs no operation to run again. */ }
