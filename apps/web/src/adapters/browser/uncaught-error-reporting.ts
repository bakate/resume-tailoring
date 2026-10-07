import type { PrivacySafeTelemetry } from '@resume-tailoring/application/ports'
import type { uncaughtErrorSources } from '@resume-tailoring/application/privacy-safe-telemetry'

type UncaughtErrorSource = typeof uncaughtErrorSources[number]

/** Reports that an error escaped the application, never what it said: a message or stack can quote Candidate content. */
export function reportUncaughtError({ source, telemetry }: Readonly<{
  source: UncaughtErrorSource
  telemetry: PrivacySafeTelemetry
}>) {
  void telemetry.record({ name: 'uncaught-error-reported', source })
}

/** Reports every error and rejection nothing else handled; returns the function that stops listening. */
export function listenForUncaughtErrors({ page, telemetry }: Readonly<{
  page: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
  telemetry: PrivacySafeTelemetry
}>) {
  const reportError = () => { reportUncaughtError({ source: 'error', telemetry }) }
  const reportRejection = () => { reportUncaughtError({ source: 'unhandled-rejection', telemetry }) }
  page.addEventListener('error', reportError)
  page.addEventListener('unhandledrejection', reportRejection)
  return () => {
    page.removeEventListener('error', reportError)
    page.removeEventListener('unhandledrejection', reportRejection)
  }
}
