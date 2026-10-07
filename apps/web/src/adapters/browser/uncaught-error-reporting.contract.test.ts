import { createRecordingTelemetry } from '@resume-tailoring/application/testing'
import { describe, expect, it } from 'vitest'

import { listenForUncaughtErrors } from './uncaught-error-reporting'

describe('uncaught error reporting', () => {
  it('reports an uncaught error without its message', () => {
    const { page, telemetry } = createReportingPage()

    page.dispatchEvent(createUncaughtError({ message: 'Alex Morgan cannot be rendered' }))

    expect(telemetry.events).toEqual([{ name: 'uncaught-error-reported', source: 'error' }])
  })

  it('reports an unhandled rejection without its reason', () => {
    const { page, telemetry } = createReportingPage()

    page.dispatchEvent(createUnhandledRejection({ reason: new Error('alex@example.com') }))

    expect(telemetry.events).toEqual([{ name: 'uncaught-error-reported', source: 'unhandled-rejection' }])
  })

  it('stops reporting once it stops listening', () => {
    const { page, stopListening, telemetry } = createReportingPage()

    stopListening()
    page.dispatchEvent(createUncaughtError({ message: 'Script error.' }))

    expect(telemetry.events).toEqual([])
  })
})

function createReportingPage() {
  const page = new EventTarget()
  const telemetry = createRecordingTelemetry()
  const stopListening = listenForUncaughtErrors({ page, telemetry })
  return { page, stopListening, telemetry }
}

/** Node has neither ErrorEvent nor PromiseRejectionEvent; the listener only reads the event type. */
function createUncaughtError({ message }: Readonly<{ message: string }>) {
  return Object.assign(new Event('error'), { message })
}

function createUnhandledRejection({ reason }: Readonly<{ reason: unknown }>) {
  return Object.assign(new Event('unhandledrejection'), { reason })
}
