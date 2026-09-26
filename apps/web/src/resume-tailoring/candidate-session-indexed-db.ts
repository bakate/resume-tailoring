import type {
  CandidateSessionId,
  CandidateSessionPersistence,
  ResumeTailoringState,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import {
  sourceProfileReviewSchema,
  storedCandidateSessionSchema,
} from './source-profile-schemas'

const databaseName = 'honest-resume'
const databaseVersion = 1
const candidateContentStoreName = 'candidate-content'
const activeSessionKey = 'active-session'
const sessionChannelName = 'honest-resume-candidate-session'

type ReadyResumeTailoringState = Extract<
  ResumeTailoringState,
  { readonly status: 'ready' }
>

type CandidateSessionUpdate = Readonly<{
  sessionId: CandidateSessionId
  state: ReadyResumeTailoringState
}>

type CandidateSessionTransaction = Readonly<{
  completed: Promise<void>
  store: IDBObjectStore
}>

export function createBrowserCandidateSessionPersistence(): CandidateSessionPersistence {
  return new IndexedDbCandidateSessionPersistence()
}

class IndexedDbCandidateSessionPersistence implements CandidateSessionPersistence {
  readonly #listeners = new Set<() => void>()
  #channel: BroadcastChannel | undefined

  read() {
    return useDatabase(readCandidateSession)
  }

  create(state: ReadyResumeTailoringState) {
    return useDatabase((database) => createCandidateSession({ database, state }))
  }

  update(request: CandidateSessionUpdate) {
    return useDatabase((database) => updateCandidateSession({ database, ...request }))
  }

  erase({ sessionId }: Readonly<{ sessionId: CandidateSessionId }>) {
    return useDatabase((database) => eraseCandidateSession({ database, sessionId }))
  }

  subscribe(listener: () => void) {
    this.#listeners.add(listener)
    this.#channel ??= createSessionChannel(() => {
      this.#notifyListeners()
    })
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size > 0) return
      this.#channel?.close()
      this.#channel = undefined
    }
  }

  #notifyListeners() {
    this.#listeners.forEach((listener) => {
      listener()
    })
  }
}

async function useDatabase<TValue>(
  operation: (database: IDBDatabase) => Promise<TValue>,
): Promise<TValue | typeof unavailableResult> {
  let database: IDBDatabase | undefined
  try {
    database = await openCandidateSessionDatabase()
    return await operation(database)
  } catch {
    return unavailableResult
  } finally {
    database?.close()
  }
}

async function readCandidateSession(database: IDBDatabase) {
  const { completed, store } = createTransaction({ database, mode: 'readonly' })
  const storedState = await readStoredState(store)
  await completed
  return { ok: true, value: storedState } as const
}

async function createCandidateSession({
  database,
  state,
}: Readonly<{ database: IDBDatabase; state: ReadyResumeTailoringState }>) {
  const { completed, store } = createTransaction({ database, mode: 'readwrite' })
  if ((await readStoredState(store)).status === 'ready') {
    await completed
    return inactiveResult
  }

  store.put(state, activeSessionKey)
  await completed
  broadcastSessionChange()
  return { ok: true, value: state } as const
}

async function updateCandidateSession({
  database,
  sessionId,
  state,
}: CandidateSessionUpdate & Readonly<{ database: IDBDatabase }>) {
  const { completed, store } = createTransaction({ database, mode: 'readwrite' })
  const storedState = await readStoredState(store)
  if (!isWritableSession({ storedState, sessionId, state, now: Date.now() })) {
    await completed
    return inactiveResult
  }

  store.put(state, activeSessionKey)
  await completed
  broadcastSessionChange()
  return { ok: true, value: state } as const
}

async function eraseCandidateSession({
  database,
  sessionId,
}: Readonly<{ database: IDBDatabase; sessionId: CandidateSessionId }>) {
  const { completed, store } = createTransaction({ database, mode: 'readwrite' })
  const storedState = await readStoredState(store)
  if (storedState.status !== 'ready' || storedState.sessionId !== sessionId) {
    await completed
    return { ok: true, value: storedState } as const
  }

  store.clear()
  await completed
  broadcastSessionChange()
  return { ok: true, value: { status: 'not-started' } } as const
}

function createTransaction({
  database,
  mode,
}: Readonly<{ database: IDBDatabase; mode: IDBTransactionMode }>): CandidateSessionTransaction {
  const transaction = database.transaction(candidateContentStoreName, mode)
  return {
    completed: transactionToPromise(transaction),
    store: transaction.objectStore(candidateContentStoreName),
  }
}

async function readStoredState(store: IDBObjectStore) {
  const storedValue = await requestToPromise<unknown>(store.get(activeSessionKey))
  return parseCandidateSession(storedValue)
}

function isWritableSession({
  storedState,
  sessionId,
  state,
  now,
}: CandidateSessionUpdate & Readonly<{ storedState: ResumeTailoringState; now: number }>) {
  return storedState.status === 'ready'
    && storedState.sessionId === sessionId
    && state.sessionId === storedState.sessionId
    && state.expiresAt === storedState.expiresAt
    && storedState.expiresAt > now
}

function parseCandidateSession(value: unknown): ResumeTailoringState {
  const result = storedCandidateSessionSchema.safeParse(value)
  if (!result.success) return { status: 'not-started' }
  const { expiresAt, sessionId, sourceProfile: storedSourceProfile } = result.data
  const readyState = {
    status: 'ready',
    sessionId,
    expiresAt,
  } as const
  const sourceProfile = sourceProfileReviewSchema.safeParse(storedSourceProfile)
  return sourceProfile.success ? { ...readyState, sourceProfile: sourceProfile.data } : readyState
}

function openCandidateSessionDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      createCandidateContentStore(request.result)
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(readDatabaseError(request.error))
    }
  })
}

function createCandidateContentStore(database: IDBDatabase) {
  if (!database.objectStoreNames.contains(candidateContentStoreName)) {
    database.createObjectStore(candidateContentStoreName)
  }
}

function requestToPromise<TValue>(request: IDBRequest): Promise<TValue> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result as TValue)
    }
    request.onerror = () => {
      reject(readDatabaseError(request.error))
    }
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      resolve()
    }
    transaction.onerror = () => {
      reject(readDatabaseError(transaction.error))
    }
    transaction.onabort = () => {
      reject(readDatabaseError(transaction.error))
    }
  })
}

function readDatabaseError(error: DOMException | null): Error {
  return error ?? new Error('IndexedDB operation failed')
}

function createSessionChannel(onMessage: () => void): BroadcastChannel {
  const channel = new BroadcastChannel(sessionChannelName)
  channel.onmessage = onMessage
  return channel
}

function broadcastSessionChange() {
  const channel = new BroadcastChannel(sessionChannelName)
  channel.postMessage({ type: 'candidate-session-changed' })
  channel.close()
}

const inactiveResult = {
  ok: false,
  error: { type: 'candidate-session-inactive' },
} as const

const unavailableResult = {
  ok: false,
  error: { type: 'adapter-unavailable' },
} as const
