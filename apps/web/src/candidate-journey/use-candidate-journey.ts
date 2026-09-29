import { useEffect, useState, useSyncExternalStore } from 'react'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'

import { createBrowserCandidateSessionPersistence } from './browser-candidate-session-persistence'
import { createOpenAiLanguageModelGateway } from './openai-language-model-gateway'
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
    startCandidateSession: candidateJourney.startCandidateSession,
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
