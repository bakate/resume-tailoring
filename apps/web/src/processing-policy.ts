import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'

import { readLanguageModelProvider } from './env'
import type { LanguageModelProvider } from './language-model-configuration'

/**
 * What each Language Model Provider does with what it receives. A provider brings its own policy version, so changing
 * provider is always a material change of the Processing Policy.
 */
const providerDescriptions = {
  openai: {
    provider: 'OpenAI',
    retentionPolicy: 'API inputs and outputs may be retained for abuse monitoring for up to 30 days, or longer when legally required.',
    storageBehavior: 'Candidate content remains browser-local; model requests are stateless with application storage disabled.',
    version: '2026-09-29',
  },
} as const satisfies Record<LanguageModelProvider, Pick<ProcessingPolicy, 'provider' | 'retentionPolicy' | 'storageBehavior' | 'version'>>

export function createProcessingPolicy({ provider }: Readonly<{ provider: LanguageModelProvider }>): ProcessingPolicy {
  const description = providerDescriptions[provider]
  return {
    provider: description.provider,
    purposes: processingPurposes,
    retentionPolicy: description.retentionPolicy,
    storageBehavior: description.storageBehavior,
    transmittedDataCategories,
    version: description.version,
  }
}

/** The policy of the provider the server environment selects, so the Candidate consents to the processor it calls. */
export function readActiveProcessingPolicy({ environment }: Readonly<{ environment: Record<string, unknown> }>) {
  const provider = readLanguageModelProvider({ environment })
  if (!provider.ok) throw new Error(provider.error.type)
  return createProcessingPolicy({ provider: provider.value })
}

const processingPurposes = [
  'Extract and structure professional evidence',
  'Compare Candidate evidence with Job Posting requirements',
  'Write and validate supported Tailored Resume content',
]

const transmittedDataCategories = [
  'Minimized professional content',
  'Job Posting content',
  'Candidate Facts needed for matching, writing, and validation',
]
