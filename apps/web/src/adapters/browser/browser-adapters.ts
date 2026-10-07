
import {
  hasOnlyResumeClaimInputReferences,
  resumeClaimValidationResultSchema,
  resumeClaimWritingResultSchema,
} from '../../resume-tailoring/resume-claim-schemas'
import { privacySafeAnalyticsEventSchema } from '../../resume-tailoring/privacy-safe-analytics'
import type { PrivacySafeTelemetry, ReadApiFailure, ResumeClaimReformulator, ResumeClaimSemanticValidator,
} from '@resume-tailoring/application/ports'
import { networkFailure, readApiFailure, unexpectedResponse } from './api-failure-reader'

export function createPrivacySafeBrowserTelemetry({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): PrivacySafeTelemetry {
  return {
    record: (event) => recordPrivacySafeAnalyticsEvent({ event, request }),
  }
}

async function recordPrivacySafeAnalyticsEvent({ event, request }: Readonly<{
  event: Parameters<PrivacySafeTelemetry['record']>[0]
  request: typeof fetch
}>) {
  const validatedEvent = privacySafeAnalyticsEventSchema.safeParse(event)
  if (!validatedEvent.success) return unavailableResult
  try {
    const response = await request('/api/analytics', createJsonRequest(validatedEvent.data))
    return response.ok ? { ok: true, value: undefined } as const : unavailableResult
  } catch {
    return unavailableResult
  }
}

export function createBrowserResumeClaimReformulator({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): ResumeClaimReformulator {
  return {
    reformulate: (reformulation) => reformulateBrowserResumeClaim({ request, reformulation }),
  }
}

export function createBrowserResumeClaimSemanticValidator({
  request = fetch,
}: Readonly<{ request?: typeof fetch }> = {}): ResumeClaimSemanticValidator {
  return {
    validate: (validationRequest) => requestResumeClaimValidation({ request, validationRequest }),
  }
}

async function reformulateBrowserResumeClaim({ request, reformulation }: Readonly<{
  request: typeof fetch
  reformulation: Parameters<ResumeClaimReformulator['reformulate']>[0]
}>) {
  const { claim, feedback, request: candidateRequest, ...writingInputs } = reformulation
  const value = {
    operation: 'reformulate', ...writingInputs, claim, feedback,
    ...(candidateRequest === undefined ? {} : { request: candidateRequest }),
  }
  const result = await requestResumeClaimWriting({ request, value, writingInputs })
  if (!result.ok) return result
  return result.value.claims.length === 1
    ? { ok: true, value: result.value.claims[0] ?? claim } as const
    : resumeClaimWritingUnavailable(unexpectedResponse)
}

async function requestResumeClaimValidation({ request, validationRequest }: Readonly<{
  request: typeof fetch
  validationRequest: Parameters<ResumeClaimSemanticValidator['validate']>[0]
}>) {
  try {
    const response = await request('/api/resume-claim-validation', createJsonRequest(validationRequest))
    if (!response.ok) return resumeClaimValidationUnavailable(await readApiFailure(response))
    const result = resumeClaimValidationResultSchema.safeParse(await response.json().catch(() => undefined))
    return result.success && result.data.ok ? result.data : resumeClaimValidationUnavailable(unexpectedResponse)
  } catch {
    return resumeClaimValidationUnavailable(networkFailure)
  }
}

async function requestResumeClaimWriting({
  request,
  value,
  writingInputs,
}: Readonly<{
  request: typeof fetch
  value: unknown
  writingInputs: Parameters<typeof hasOnlyResumeClaimInputReferences>[0]['inputs']
  }>) {
  try {
    const response = await request('/api/resume-claim-writing', createJsonRequest(value))
    if (!response.ok) return resumeClaimWritingUnavailable(await readApiFailure(response))
    const result = resumeClaimWritingResultSchema.safeParse(await response.json().catch(() => undefined))
    if (!result.success || !result.data.ok) return resumeClaimWritingUnavailable(unexpectedResponse)
    return hasOnlyResumeClaimInputReferences({
      claims: result.data.value.claims,
      inputs: writingInputs,
    }) ? result.data : resumeClaimWritingUnavailable(unexpectedResponse)
  } catch {
    return resumeClaimWritingUnavailable(networkFailure)
  }
}

function createJsonRequest(value: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    cache: 'no-store',
  } as const
}

const unavailableResult = {
  ok: false,
  error: { type: 'adapter-unavailable' },
} as const

function resumeClaimWritingUnavailable(apiFailure: ReadApiFailure) {
  return { ok: false, error: { type: 'resume-claim-writing-unavailable', apiFailure } } as const
}

function resumeClaimValidationUnavailable(apiFailure: ReadApiFailure) {
  return { ok: false, error: { type: 'resume-claim-validation-unavailable', apiFailure } } as const
}
