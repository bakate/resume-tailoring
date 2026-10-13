import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'

import { readLanguageModelSelection } from './env'
import type { LanguageModelProvider } from './language-model-configuration'

/**
 * What each Language Model Provider does with what it receives. A provider brings its own policy version, so changing
 * provider is always a material change of the Processing Policy. A provider that processes outside the European Union
 * states its processing country. DeepSeek's wording follows its privacy policy (2026-02-10) and context caching guide.
 */
const providerDescriptions = {
  openai: {
    provider: 'OpenAI',
    retentionPolicy: 'API inputs and outputs may be retained for abuse monitoring for up to 30 days, or longer when legally required.',
    storageBehavior: 'Candidate content remains browser-local; model requests are stateless with application storage disabled.',
    version: '2026-09-29',
  },
  deepseek: {
    processingCountry: 'China (outside the European Union)',
    provider: 'DeepSeek',
    retentionPolicy: 'API inputs and outputs are retained as long as needed to provide the service, or longer for legal obligations, legitimate interests such as safety and security, or legal claims, with no fixed period; they may be used to train DeepSeek models unless opted out.',
    storageBehavior: 'Candidate content remains browser-local; each model request is written to the provider\'s disk cache, usually cleared within a few hours to a few days.',
    version: '2026-10-13',
  },
} as const satisfies Record<LanguageModelProvider, Pick<ProcessingPolicy, 'processingCountry' | 'provider' | 'retentionPolicy' | 'storageBehavior' | 'version'>>

export function createProcessingPolicy({ provider }: Readonly<{ provider: LanguageModelProvider }>): ProcessingPolicy {
  return { ...providerDescriptions[provider], purposes: processingPurposes, transmittedDataCategories }
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
