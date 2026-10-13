import { Box, Group, List, Stack, Text } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'

import type { ReactNode } from 'react'
import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'

type LocalizationProps = Readonly<{ localization: Localization }>

export const processingPolicyNoticeId = 'processing-policy-notice'

/** The only place the intake speaks of privacy: a lock, one sentence, and the Processing Policy behind "Learn more". */
export function PrivacyStatement({ localization, processingPolicy }: LocalizationProps & Readonly<{
  processingPolicy: ProcessingPolicy
}>) {
  return <Box className="privacy-statement" data-processing-policy-version={processingPolicy.version} mt="lg">
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <IconLock aria-hidden="true" className="privacy-statement-icon" size={20} stroke={2} />
      <Text>{localization.translate('candidateJourney.privacyStatement')}</Text>
    </Group>
    <ProcessingLocationStatement {...{ localization, processingPolicy }} />
    <details><summary>{localization.translate('candidateJourney.privacyLearnMore')}</summary>
      <Stack gap="xs" mt="xs"><ProcessingPolicyDetails {...{ localization, processingPolicy }} /></Stack></details>
  </Box>
}

/**
 * A processing country is a transfer the Candidate must know of before choosing to start, so it is stated on the
 * landing rather than only behind "Learn more".
 */
function ProcessingLocationStatement({ localization, processingPolicy }: LocalizationProps & Readonly<{
  processingPolicy: ProcessingPolicy
}>) {
  const { processingCountry, provider } = processingPolicy
  if (processingCountry === undefined) return null
  return <Text mt="xs">{localization.translate('processingPolicy.processingLocationStatement')
    .replace('{provider}', provider)
    .replace('{processingCountry}', translateProcessingPolicyValue({ localization, value: processingCountry }))}</Text>
}

/** A smaller privacy line elsewhere on the page: the same lock as the privacy statement, beside one sentence. */
export function PrivacyNote({ children, id }: Readonly<{ children: ReactNode; id?: string }>) {
  return <Group gap="xs" wrap="nowrap" align="flex-start">
    <IconLock aria-hidden="true" className="privacy-statement-icon" size={16} stroke={2} />
    <Text c="dimmed" id={id} size="sm">{children}</Text>
  </Group>
}

/** What generating agrees to, read as the description of the generation action. */
export function ProcessingPolicyNotice({ candidateJourney, localization }: LocalizationProps & Readonly<{
  candidateJourney: ReturnType<typeof useCandidateJourney>
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const { processingPolicy } = view
  const granted = view.processingConsentStatus === 'granted'
  const summary = localization.translate(granted ? 'processingPolicy.grantedSummary' : 'processingPolicy.consentByGeneration')
    .replace('{provider}', processingPolicy.provider)
  // Before consent, the privacy statement above is the intake's one lock; once granted, this line carries its own.
  return granted ? <PrivacyNote id={processingPolicyNoticeId}>{summary}</PrivacyNote>
    : <Text c="dimmed" id={processingPolicyNoticeId} size="sm">{summary}</Text>
}

function ProcessingPolicyDetails({ localization, processingPolicy }: LocalizationProps & Readonly<{
  processingPolicy: ProcessingPolicy
}>) {
  return <>
    <PolicyText label={localization.translate('processingPolicy.provider')}
      value={processingPolicy.provider} />
    {processingPolicy.processingCountry === undefined ? null : (
      <PolicyText label={localization.translate('processingPolicy.processingCountry')}
        value={translateProcessingPolicyValue({ localization, value: processingPolicy.processingCountry })} />
    )}
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
  ['China (outside the European Union)', 'processingPolicy.country.chinaOutsideEuropeanUnion'],
  ['API inputs and outputs are retained as long as needed to provide the service, or longer for legal obligations, safety or legal claims, with no fixed period; they may be used to train DeepSeek models unless opted out.', 'processingPolicy.deepSeekRetentionValue'],
  ['Candidate content remains browser-local; each model request is written to the provider\'s disk cache, usually cleared within a few hours to a few days.', 'processingPolicy.deepSeekStorageValue'],
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
