import { z } from 'zod'

import { hasProcessingConsentForPolicy } from '@resume-tailoring/application/language-model-gateway'
import type { ProcessingConsent, ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'

/**
 * The Processing Policy variant a Candidate consents to when entering a Candidate API Key: the same provider, but
 * processing happens on the Candidate's own provider account under their organization's retention settings.
 */
export const candidateApiKeyProcessingPolicy = {
  provider: 'OpenAI',
  purposes: [
    'Extract and structure professional evidence',
    'Compare Candidate evidence with Job Posting requirements',
    'Write and validate supported Tailored Resume content',
  ],
  retentionPolicy: 'Retention follows the settings of the organization that owns the Candidate API Key.',
  storageBehavior: 'The Candidate API Key stays in this browser tab and transits the server for each model request without being stored or logged; the operator sees neither its billing nor its history.',
  transmittedDataCategories: [
    'Minimized professional content',
    'Job Posting content',
    'Candidate Facts needed for matching, writing, and validation',
    'The Candidate API Key, to sign each model request',
  ],
  version: '2026-10-08-candidate-api-key',
} as const satisfies ProcessingPolicy

export type StoredCandidateApiKey = Readonly<{ apiKey: string; consent: ProcessingConsent }>

export type CandidateApiKeyStore = Readonly<{
  /** The Candidate API Key of this tab, only while its consent matches the current Processing Policy variant. */
  read: () => StoredCandidateApiKey | null
  /** Entering a key is consenting to the Processing Policy variant: one never exists without the other. */
  save: (entry: Readonly<{ apiKey: string; grantedAt: number }>) => void
  remove: () => void
  subscribe: (listener: () => void) => () => void
}>

/**
 * Keeps the Candidate API Key in the tab's `sessionStorage` alone, so it disappears when the tab closes. Without
 * that storage nothing is kept: the key is never remembered anywhere else.
 */
export function createCandidateApiKeyStore({ readStorage }: Readonly<{ readStorage: () => Storage }>): CandidateApiKeyStore {
  const listeners = new Set<() => void>()
  const notify = () => { listeners.forEach((listener) => { listener() }) }
  return {
    read: () => readStoredKey({ readStorage }),
    save: ({ apiKey, grantedAt }) => {
      const entry: StoredCandidateApiKey = { apiKey, consent: { grantedAt, policy: candidateApiKeyProcessingPolicy } }
      try { readStorage().setItem(storageKey, JSON.stringify(entry)) } catch { /* Without tab storage, no key is kept. */ }
      notify()
    },
    remove: () => {
      try { readStorage().removeItem(storageKey) } catch { /* Nothing was kept. */ }
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

function readStoredKey({ readStorage }: Readonly<{ readStorage: () => Storage }>): StoredCandidateApiKey | null {
  try {
    const stored = storedKeySchema.safeParse(JSON.parse(readStorage().getItem(storageKey) ?? 'null'))
    if (!stored.success) return null
    return hasProcessingConsentForPolicy({ consent: stored.data.consent, policy: candidateApiKeyProcessingPolicy })
      ? stored.data : null
  } catch {
    return null
  }
}

const storageKey = 'resume-studio.candidate-api-key'
const storedKeySchema = z.strictObject({
  apiKey: z.string().min(1),
  consent: z.strictObject({
    grantedAt: z.number(),
    policy: z.strictObject({
      provider: z.string(), purposes: z.array(z.string()), retentionPolicy: z.string(), storageBehavior: z.string(),
      transmittedDataCategories: z.array(z.string()), version: z.string(),
    }),
  }),
})
