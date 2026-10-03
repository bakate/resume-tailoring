import {
  candidateSessionSchema,
} from '../../candidate-journey/candidate-session'
import type {
  CandidateSession,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSessionPersistence, CandidateSessionStorageResult } from '@resume-tailoring/application/ports'

const candidateSessionStorageKey = 'honest-resume:candidate-session'
const leavingEvents = ['beforeunload', 'pagehide'] as const
const stayingEvents = ['pageshow', 'pointerdown', 'keydown'] as const

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

/**
 * While the page is being left, saves keep the last stored session. WebKit cancels in-flight requests as soon as a
 * reload starts (`beforeunload`) and lets the leaving page record them as failures before `pagehide`; keeping the
 * stored session lets the next load restore the cut-short preparation as interrupted. A page that was not left after
 * all (restored from the back-forward cache, or used again after a cancelled navigation) saves again.
 */
export function createBrowserCandidateSessionPersistence({ storage, page }: Readonly<{
  storage: BrowserStorage
  page?: Pick<EventTarget, 'addEventListener'>
}>): CandidateSessionPersistence {
  let leaving = false
  for (const event of leavingEvents) page?.addEventListener(event, () => { leaving = true })
  for (const event of stayingEvents) page?.addEventListener(event, () => { leaving = false })
  return {
    delete: () => deleteCandidateSession({ storage }),
    restore: ({ now }) => restoreCandidateSession({ now, storage }),
    save: ({ session }) => leaving ? { ok: true, value: session } : saveCandidateSession({ session, storage }),
  }
}

function restoreCandidateSession({ now, storage }: Readonly<{
  now: number
  storage: BrowserStorage
}>) {
  return withBrowserStorage({ operation: () => {
    const serializedSession = storage.getItem(candidateSessionStorageKey)
    if (serializedSession === null) {
      return { notice: null, session: null } as const
    }
    const parsedSession = candidateSessionSchema.safeParse(parseStoredSession({ serializedSession }))
    if (!parsedSession.success) {
      storage.removeItem(candidateSessionStorageKey)
      return { notice: 'incompatible-session-discarded', session: null } as const
    }
    if (parsedSession.data.expiresAt > now) {
      return { notice: null, session: parsedSession.data } as const
    }
    storage.removeItem(candidateSessionStorageKey)
    return { notice: 'expired-session-discarded', session: null } as const
  } })
}

function parseStoredSession({ serializedSession }: Readonly<{
  serializedSession: string
}>): unknown {
  try {
    return JSON.parse(serializedSession) as unknown
  } catch {
    return null
  }
}

function saveCandidateSession({ session, storage }: Readonly<{
  session: CandidateSession
  storage: BrowserStorage
}>) {
  return withBrowserStorage({ operation: () => {
    storage.setItem(candidateSessionStorageKey, JSON.stringify(session))
    return session
  } })
}

function deleteCandidateSession({ storage }: Readonly<{ storage: BrowserStorage }>) {
  return withBrowserStorage({ operation: () => {
    storage.removeItem(candidateSessionStorageKey)
    return null
  } })
}

function withBrowserStorage<TValue>({ operation }: Readonly<{
  operation: () => TValue,
}>): CandidateSessionStorageResult<TValue> {
  try {
    return { ok: true, value: operation() }
  } catch {
    return { ok: false, error: 'candidate-session-storage-unavailable' }
  }
}
