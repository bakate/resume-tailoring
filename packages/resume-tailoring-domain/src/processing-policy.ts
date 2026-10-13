export type ProcessingPolicy = Readonly<{
  /** Where the provider processes and stores what it receives; stated when it is a transfer the Candidate must know of. */
  processingCountry?: string
  provider: string
  purposes: readonly string[]
  retentionPolicy: string
  storageBehavior: string
  transmittedDataCategories: readonly string[]
  version: string
}>

export type ProcessingConsent = Readonly<{
  grantedAt: number
  policy: ProcessingPolicy
}>

export function hasProcessingConsentForPolicy({ consent, policy }: Readonly<{
  consent: ProcessingConsent | null
  policy: ProcessingPolicy
}>) {
  if (consent === null) return false
  return hasSameProcessingPolicy({ activePolicy: policy, consentedPolicy: consent.policy })
}

function hasSameProcessingPolicy({ activePolicy, consentedPolicy }: Readonly<{
  activePolicy: ProcessingPolicy
  consentedPolicy: ProcessingPolicy
}>) {
  return consentedPolicy.provider === activePolicy.provider
    && consentedPolicy.processingCountry === activePolicy.processingCountry
    && consentedPolicy.retentionPolicy === activePolicy.retentionPolicy
    && consentedPolicy.storageBehavior === activePolicy.storageBehavior
    && consentedPolicy.version === activePolicy.version
    && hasSameValues({ activeValues: activePolicy.purposes, consentedValues: consentedPolicy.purposes })
    && hasSameValues({
      activeValues: activePolicy.transmittedDataCategories,
      consentedValues: consentedPolicy.transmittedDataCategories,
    })
}

function hasSameValues({ activeValues, consentedValues }: Readonly<{
  activeValues: readonly string[]
  consentedValues: readonly string[]
}>) {
  return consentedValues.length === activeValues.length
    && consentedValues.every((value, valueIndex) => value === activeValues[valueIndex])
}
