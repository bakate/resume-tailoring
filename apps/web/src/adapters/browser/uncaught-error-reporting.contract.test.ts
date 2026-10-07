import { describe, expect, it, vi } from 'vitest'

import type { PrivacySafeTelemetry } from '@resume-tailoring/application/ports'
import { listenForUncaughtErrors, reportUncaughtError } from './uncaught-error-reporting'

describe('uncaught error reporting', () => {
  it('reports an uncaught error without its message', () => {
    const { page, telemetry } = createReportingPage()

    page.dispatchEvent(createUncaughtError({ message: 'Alex Morgan cannot be rendered' }))

    expect(telemetry.record).toHaveBeenCalledExactlyOnceWith({ name: 'uncaught-error-reported', source: 'error' })
  })

  it('reports an unhandled rejection without its reason', () => {
    const { page, telemetry } = createReportingPage()

    page.dispatchEvent(createUnhandledRejection({ reason: new Error('alex@example.com') }))

    expect(telemetry.record).toHaveBeenCalledExactlyOnceWith({
      name: 'uncaught-error-reported', source: 'unhandled-rejection',
    })
  })

  it('stops reporting once it stops listening', () => {
    const { page, stopListening, telemetry } = createReportingPage()

    stopListening()
    page.dispatchEvent(createUncaughtError({ message: 'Script error.' }))

    expect(telemetry.record).not.toHaveBeenCalled()
  })

  it('reports a render error caught by the safety net', () => {
    const telemetry = createTelemetry()

    reportUncaughtError({ source: 'render', telemetry })

    expect(telemetry.record).toHaveBeenCalledExactlyOnceWith({ name: 'uncaught-error-reported', source: 'render' })
  })
})

function createReportingPage() {
  const page = new EventTarget()
  const telemetry = createTelemetry()
  const stopListening = listenForUncaughtErrors({ page, telemetry })
  return { page, stopListening, telemetry }
}

function createTelemetry() {
  return { record: vi.fn<PrivacySafeTelemetry['record']>().mockResolvedValue({ ok: true, value: undefined }) }
}

/** Node has neither ErrorEvent nor PromiseRejectionEvent; the listener only reads the event type. */
function createUncaughtError({ message }: Readonly<{ message: string }>) {
  return Object.assign(new Event('error'), { message })
}

function createUnhandledRejection({ reason }: Readonly<{ reason: unknown }>) {
  return Object.assign(new Event('unhandledrejection'), { reason })
}
