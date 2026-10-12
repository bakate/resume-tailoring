import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'

import { readLanguageModelSelection } from './env'
import type { LanguageModelProvider } from './language-model-configuration'

/**
 * What each Language Model Provider does with what it receives. A provider brings its own policy version, so changing
 * provider is always a material change of the Processing Policy. A provider without one (DeepSeek until BAK-168 names
 * its processing country) has no policy to consent to, so no model operation can run on it.
 */
const providerDescriptions = {
  openai: {
    provider: 'OpenAI',
    retentionPolicy: 'API inputs and outputs may be retained for abuse monitoring for up to 30 days, or longer when legally required.',
    storageBehavior: 'Candidate content remains browser-local; model requests are stateless with application storage disabled.',
    version: '2026-09-29',
  },
  deepseek: null,
} as const satisfies Record<LanguageModelProvider, Pick<ProcessingPolicy, 'provider' | 'retentionPolicy' | 'storageBehavior' | 'version'> | null>

export function createProcessingPolicy({ provider }: Readonly<{ provider: LanguageModelProvider }>): ProcessingPolicy | null {
  const description = providerDescriptions[provider]
  if (description === null) return null
  return {
    provider: description.provider,
    purposes: processingPurposes,
    retentionPolicy: description.retentionPolicy,
    storageBehavior: description.storageBehavior,
    transmittedDataCategories,
    version: description.version,
  }
}

/**
 * The policy of the provider the server environment selects, so the Candidate consents to the processor it calls.
 * A selection the server refuses has no policy: no model operation can run, so there is nothing to consent to.
 */
export function readActiveProcessingPolicy({ environment }: Readonly<{
  environment: Record<string, unknown>
}>): ProcessingPolicy | null {
  const selection = readLanguageModelSelection({ environment })
  if (selection.ok) return createProcessingPolicy({ provider: selection.value.provider })
  console.error(JSON.stringify({ category: 'invalid-server-environment', issues: selection.error.issues }))
  return null
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
