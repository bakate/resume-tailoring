import { Box, List, Stack, Text } from '@mantine/core'

import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'

type LocalizationProps = Readonly<{ localization: Localization }>

export const processingPolicyNoticeId = 'processing-policy-notice'

export function ProcessingPolicyNotice({ candidateJourney, localization }: LocalizationProps & Readonly<{
  candidateJourney: ReturnType<typeof useCandidateJourney>
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const { processingPolicy } = view
  const summary = localization.translate(view.processingConsentStatus === 'granted'
    ? 'processingPolicy.grantedSummary' : 'processingPolicy.consentByGeneration')
    .replace('{provider}', processingPolicy.provider)
  return <Box className="processing-policy-notice">
    <Text c="dimmed" id={processingPolicyNoticeId} size="xs">{summary}</Text>
    <details><summary>{localization.translate('combinedIntake.policyDetails')}</summary>
      <Stack gap="xs" mt="xs"><ProcessingPolicyDetails {...{ localization, processingPolicy }} /></Stack></details>
  </Box>
}

function ProcessingPolicyDetails({ localization, processingPolicy }: LocalizationProps & Readonly<{
  processingPolicy: ProcessingPolicy
}>) {
  return <>
    <PolicyText label={localization.translate('processingPolicy.provider')}
      value={processingPolicy.provider} />
    <PolicyList label={localization.translate('processingPolicy.purposes')}
      values={translateProcessingPolicyValues({
        localization, values: processingPolicy.purposes,
      })} />
    <PolicyList label={localization.translate('processingPolicy.transmittedDataCategories')}
      values={translateProcessingPolicyValues({
        localization, values: processingPolicy.transmittedDataCategories,
      })} />
    <PolicyText label={localization.translate('processingPolicy.retentionPolicy')}
      value={translateProcessingPolicyValue({
        localization, value: processingPolicy.retentionPolicy,
      })} />
    <PolicyText label={localization.translate('processingPolicy.storageBehavior')}
      value={translateProcessingPolicyValue({
        localization, value: processingPolicy.storageBehavior,
      })} />
    <Text size="sm">{localization.translate('processingPolicy.version')}{' '}
      {processingPolicy.version}</Text>
  </>
}

function translateProcessingPolicyValues({ localization, values }: LocalizationProps & Readonly<{
  values: readonly string[]
}>) {
  return values.map((value) => translateProcessingPolicyValue({ localization, value }))
}

function translateProcessingPolicyValue({ localization, value }: LocalizationProps & Readonly<{
  value: string
}>) {
  const key = processingPolicyTranslationKeyByValue.get(value)
  return key === undefined ? value : localization.translate(key)
}

const processingPolicyTranslationKeyByValue = new Map<string, Parameters<
  Localization['translate']
>[0]>([
  ['Extract and structure professional evidence', 'processingPolicy.purpose.extractEvidence'],
  ['Compare Candidate evidence with Job Posting requirements', 'processingPolicy.purpose.compareEvidence'],
  ['Write and validate supported Tailored Resume content', 'processingPolicy.purpose.writeResume'],
  ['Minimized professional content', 'processingPolicy.data.minimizedProfessionalContent'],
  ['Job Posting content', 'processingPolicy.data.jobPostingContent'],
  ['Candidate Facts needed for matching, writing, and validation', 'processingPolicy.data.candidateFacts'],
  ['API inputs and outputs may be retained for abuse monitoring for up to 30 days, or longer when legally required.', 'processingPolicy.retentionValue'],
  ['Candidate content remains browser-local; model requests are stateless with application storage disabled.', 'processingPolicy.storageValue'],
])

function PolicyText({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div><Text fw={700} size="sm">{label}</Text><Text size="sm">{value}</Text></div>
}

function PolicyList({ label, values }: Readonly<{
  label: string
  values: readonly string[]
}>) {
  return <div><Text fw={700} size="sm">{label}</Text><List size="sm">{values.map((value) => (
    <List.Item key={value}>{value}</List.Item>
  ))}</List></div>
}
