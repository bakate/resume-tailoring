import {
  candidateSessionSchema,
} from './candidate-session'
import type {
  CandidateSession,
  CandidateSessionPersistence,
  CandidateSessionStorageResult,
} from '@resume-tailoring/application/candidate-journey'

const candidateSessionStorageKey = 'honest-resume:candidate-session'

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>

export function createBrowserCandidateSessionPersistence({ storage }: Readonly<{
  storage: BrowserStorage
}>): CandidateSessionPersistence {
  return {
    delete: () => deleteCandidateSession({ storage }),
    restore: ({ now }) => restoreCandidateSession({ now, storage }),
    save: ({ session }) => saveCandidateSession({ session, storage }),
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
