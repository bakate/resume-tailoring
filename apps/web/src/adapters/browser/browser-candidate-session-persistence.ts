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
 * Where the Candidate Session is kept: in the browser's local storage until it expires or is deleted (`browser`), or
 * in the tab's session storage, which the browser forgets when the tab closes (`tab`), for a shared computer.
 */
export type CandidateSessionRetention = 'browser' | 'tab'

type BrowserStorages = Readonly<Record<CandidateSessionRetention, BrowserStorage>>

export type BrowserCandidateSessionPersistence = CandidateSessionPersistence & Readonly<{
  /** Chooses where the next saves keep the Candidate Session; a restored session stays in the storage it came from. */
  chooseRetention: (retention: CandidateSessionRetention) => void
}>

/**
 * While the page is being left, saves keep the last stored session. WebKit cancels in-flight requests as soon as a
 * reload starts (`beforeunload`) and lets the leaving page record them as failures before `pagehide`; keeping the
 * stored session lets the next load restore the cut-short preparation as interrupted. A page that was not left after
 * all (restored from the back-forward cache, or used again after a cancelled navigation) saves again.
 */
export function createBrowserCandidateSessionPersistence({ storages, page }: Readonly<{
  storages: BrowserStorages
  page?: Pick<EventTarget, 'addEventListener'>
}>): BrowserCandidateSessionPersistence {
  let leaving = false
  let retention: CandidateSessionRetention = 'browser'
  for (const event of leavingEvents) page?.addEventListener(event, () => { leaving = true })
  for (const event of stayingEvents) page?.addEventListener(event, () => { leaving = false })
  return {
    chooseRetention: (chosen) => { retention = chosen },
    delete: () => deleteCandidateSession({ storages }),
    restore: () => {
      const restored = restoreCandidateSession({ storages })
      if (restored.ok && restored.value.retention !== null) retention = restored.value.retention
      return restored.ok ? { ok: true, value: { notice: restored.value.notice, session: restored.value.session } } : restored
    },
    save: ({ session }) => leaving ? { ok: true, value: session } : saveCandidateSession({ retention, session, storages }),
  }
}

/** Reads the tab's storage first: a session found there was kept until its tab closes. */
function restoreCandidateSession({ storages }: Readonly<{ storages: BrowserStorages }>) {
  return withBrowserStorage({ operation: () => {
    const stored = (['tab', 'browser'] as const)
      .map((retention) => ({ retention, serializedSession: storages[retention].getItem(candidateSessionStorageKey) }))
      .find(({ serializedSession }) => serializedSession !== null)
    if (stored?.serializedSession == null) return { notice: null, retention: null, session: null } as const
    const { retention, serializedSession } = stored
    const parsedSession = candidateSessionSchema.safeParse(parseStoredSession({ serializedSession }))
    if (!parsedSession.success) {
      storages[retention].removeItem(candidateSessionStorageKey)
      return { notice: 'incompatible-session-discarded', retention: null, session: null } as const
    }
    return { notice: null, retention, session: parsedSession.data } as const
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

/** Keeps the session in the chosen storage only, so a session kept until its tab closes leaves no copy behind. */
function saveCandidateSession({ retention, session, storages }: Readonly<{
  retention: CandidateSessionRetention
  session: CandidateSession
  storages: BrowserStorages
}>) {
  return withBrowserStorage({ operation: () => {
    storages[retention].setItem(candidateSessionStorageKey, JSON.stringify(session))
    storages[retention === 'tab' ? 'browser' : 'tab'].removeItem(candidateSessionStorageKey)
    return session
  } })
}

function deleteCandidateSession({ storages }: Readonly<{ storages: BrowserStorages }>) {
  return withBrowserStorage({ operation: () => {
    storages.browser.removeItem(candidateSessionStorageKey)
    storages.tab.removeItem(candidateSessionStorageKey)
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
