import { useEffect, useState, useSyncExternalStore } from 'react'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'

import { createBrowserCandidateSessionPersistence } from './browser-candidate-session-persistence'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'
import { createBrowserSourceIntakeDocumentReader } from './source-intake-document-reader'
import type { CandidateJourney } from '@resume-tailoring/application/candidate-journey'

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
    dependencies: {
      createSessionId: () => crypto.randomUUID(),
      languageModelGateway,
      now: () => Date.now(),
      persistence: createBrowserCandidateSessionPersistence({ storage: localStorage }),
      sourceDocumentReader: createBrowserSourceIntakeDocumentReader(),
      sourceProfileExtractor: { extract: async (input) => {
        const result = await languageModelGateway.structured.process({
          input,
          operation: 'structured-source-profile-extraction',
        })
        if (!result.ok) {
          return {
            ok: false,
            error: result.error.type === 'processing-consent-required'
              ? 'processing-consent-required' as const
              : 'source-profile-extraction-unavailable' as const,
          }
        }
        return result.value.operation === 'structured-source-profile-extraction'
          ? { ok: true, value: result.value.value }
          : { ok: false, error: 'source-profile-extraction-unavailable' as const }
      } },
    },
  })
  return { candidateJourney, languageModelGateway } as const
}

function readProcessingConsent({ candidateJourney }: Readonly<{
  candidateJourney: CandidateJourney | null
}>) {
  const view = candidateJourney?.readView()
  return view?.status === 'candidate-session-open' ? view.session.processingConsent : null
}
