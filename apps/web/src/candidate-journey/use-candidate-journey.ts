import { useEffect, useState, useSyncExternalStore } from 'react'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'

import { createBrowserCandidateSessionPersistence } from './browser-candidate-session-persistence'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'
import { createBrowserSourceIntakeDocumentReader } from './source-intake-document-reader'
import { createBrowserJobPostingDocumentReader } from './job-posting-document-reader'
import type { CandidateJourney } from '@resume-tailoring/application/candidate-journey'
import type {
  JobPostingExtractor,
  MatchEvidenceMatcher,
} from '@resume-tailoring/application/job-match'
import type { StructuredSourceProfileExtractor } from '@resume-tailoring/application/source-intake'

export function useCandidateJourney() {
  const [candidateJourneySystem] = useState(createBrowserCandidateJourneySystem)
  const { candidateJourney } = candidateJourneySystem
  useEffect(() => {
    candidateJourney.start()
  }, [candidateJourney])
  const view = useSyncExternalStore(
    candidateJourney.subscribe,
    candidateJourney.readView,
    candidateJourney.readView,
  )
  return {
    deleteCandidateSession: candidateJourney.deleteCandidateSession,
    grantProcessingConsent: candidateJourney.grantProcessingConsent,
    languageModelGateway: candidateJourneySystem.languageModelGateway,
    resolveCriticalAmbiguity: candidateJourney.resolveCriticalAmbiguity,
    startCandidateSession: candidateJourney.startCandidateSession,
    submitJobPosting: candidateJourney.submitJobPosting,
    submitSourceDocument: candidateJourney.submitSourceDocument,
    view,
  } as const
}

function createBrowserCandidateJourneySystem() {
  let candidateJourney: CandidateJourney | null = null
  const languageModelGateway = createOpenAiLanguageModelGateway({
    readProcessingConsent: () => readProcessingConsent({ candidateJourney }),
  })
  candidateJourney = createCandidateJourney({
    dependencies: createBrowserDependencies({ languageModelGateway }),
  })
  return { candidateJourney, languageModelGateway } as const
}

type BrowserLanguageModelGateway = ReturnType<typeof createOpenAiLanguageModelGateway>

function createBrowserDependencies({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>) {
  return {
    createSessionId: () => crypto.randomUUID(),
    jobPostingDocumentReader: createBrowserJobPostingDocumentReader(),
    jobPostingExtractor: createGatewayJobPostingExtractor({ languageModelGateway }),
    languageModelGateway,
    matchEvidenceMatcher: createGatewayMatchEvidenceMatcher({ languageModelGateway }),
    now: () => Date.now(),
    persistence: createBrowserCandidateSessionPersistence({ storage: localStorage }),
    sourceDocumentReader: createBrowserSourceIntakeDocumentReader(),
    sourceProfileExtractor: createGatewaySourceProfileExtractor({ languageModelGateway }),
  }
}

function createGatewayJobPostingExtractor({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>): JobPostingExtractor {
  return { extract: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'explainable-job-posting-extraction',
    })
    return result.ok && result.value.operation === 'explainable-job-posting-extraction'
      ? { ok: true, value: result.value.value }
      : { ok: false, error: 'job-posting-extraction-unavailable' as const }
  } }
}

function createGatewayMatchEvidenceMatcher({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>): MatchEvidenceMatcher {
  return { match: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'explainable-match-evidence',
    })
    return result.ok && result.value.operation === 'explainable-match-evidence'
      ? { ok: true, value: result.value.value }
      : { ok: false, error: 'match-evidence-unavailable' as const }
  } }
}

function createGatewaySourceProfileExtractor({ languageModelGateway }: Readonly<{
  languageModelGateway: BrowserLanguageModelGateway
}>): StructuredSourceProfileExtractor {
  return { extract: async (input) => {
    const result = await languageModelGateway.structured.process({
      input, operation: 'structured-source-profile-extraction',
    })
    if (result.ok && result.value.operation === 'structured-source-profile-extraction') {
      return { ok: true, value: result.value.value }
    }
    return readSourceProfileFailure({ result })
  } }
}

function readSourceProfileFailure({ result }: Readonly<{
  result: Awaited<ReturnType<BrowserLanguageModelGateway['structured']['process']>>
}>) {
  return {
    ok: false as const,
    error: !result.ok && result.error.type === 'processing-consent-required'
      ? 'processing-consent-required' as const
      : 'source-profile-extraction-unavailable' as const,
  }
}

function readProcessingConsent({ candidateJourney }: Readonly<{
  candidateJourney: CandidateJourney | null
}>) {
  const view = candidateJourney?.readView()
  return view?.status === 'candidate-session-open' ? view.session.processingConsent : null
}
