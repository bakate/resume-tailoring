import { useEffect, useState, useSyncExternalStore } from 'react'
import { createCandidateJourney } from '@resume-tailoring/application/candidate-journey'

import { createBrowserCandidateSessionPersistence } from './browser-candidate-session-persistence'

export function useCandidateJourney() {
  const [candidateJourney] = useState(createBrowserCandidateJourney)
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
    startCandidateSession: candidateJourney.startCandidateSession,
    view,
  } as const
}

function createBrowserCandidateJourney() {
  return createCandidateJourney({
    dependencies: {
      createSessionId: () => crypto.randomUUID(),
      now: () => Date.now(),
      persistence: createBrowserCandidateSessionPersistence({ storage: localStorage }),
    },
  })
}
