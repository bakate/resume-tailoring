import { hasProcessingConsentForPolicy } from '@resume-tailoring/domain/processing-policy'
import type {
  ProcessingConsent,
  ProcessingPolicy,
} from '@resume-tailoring/domain/processing-policy'
import type { LanguageModelGatewayAdapter, LanguageModelRole } from './ports'

export type { ProcessingConsent, ProcessingPolicy }

export type LanguageModelGateway<
  TStructuredRequest,
  TStructuredValue,
  TWritingRequest = TStructuredRequest,
  TWritingValue = TStructuredValue,
> = LanguageModelGatewayAdapter<
  TStructuredRequest,
  TStructuredValue,
  TWritingRequest,
  TWritingValue
>

type CreateLanguageModelGatewayOptions<
  TStructuredRequest,
  TStructuredValue,
  TWritingRequest,
  TWritingValue,
> = Readonly<{
  adapter: LanguageModelGatewayAdapter<
    TStructuredRequest,
    TStructuredValue,
    TWritingRequest,
    TWritingValue
  >
  readProcessingConsent: () => ProcessingConsent | null
}>

export function createLanguageModelGateway<
  TStructuredRequest, TStructuredValue, TWritingRequest = TStructuredRequest,
  TWritingValue = TStructuredValue,
>(options: CreateLanguageModelGatewayOptions<TStructuredRequest, TStructuredValue,
TWritingRequest, TWritingValue>): LanguageModelGateway<TStructuredRequest, TStructuredValue,
TWritingRequest, TWritingValue> {
  const { adapter, readProcessingConsent } = options
  return {
    processingPolicy: adapter.processingPolicy,
    structured: createConsentBoundRole({
      processingPolicy: adapter.processingPolicy, readProcessingConsent, role: adapter.structured,
    }),
    writing: createConsentBoundRole({
      processingPolicy: adapter.processingPolicy, readProcessingConsent, role: adapter.writing,
    }),
  }
}

function createConsentBoundRole<TRequest, TValue>({
  processingPolicy,
  readProcessingConsent,
  role,
}: Readonly<{
  processingPolicy: ProcessingPolicy
  readProcessingConsent: () => ProcessingConsent | null
  role: LanguageModelRole<TRequest, TValue>
}>): LanguageModelRole<TRequest, TValue> {
  return {
    process: (request) => hasProcessingConsentForPolicy({
      consent: readProcessingConsent(),
      policy: processingPolicy,
    })
      ? role.process(request)
      : Promise.resolve({ ok: false, error: { type: 'processing-consent-required' } }),
  }
}
