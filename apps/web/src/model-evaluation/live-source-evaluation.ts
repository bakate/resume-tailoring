import { validateServerEnvironment } from '../env'
import {
  observeSource,
  readFailedObservations,
  readRoleCandidate,
  type ModelObservationSource,
} from './model-qualification-runner'

/**
 * Runs one live source on the configurations the server environment validates, the way the recording runs it, and
 * returns the observations that record a failure. A live evaluation test expects none.
 */
export async function readLiveSourceFailures({ source }: Readonly<{ source: ModelObservationSource }>) {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('A Language Model Provider key must be configured for live evaluation')
  const { apiKey, structured, writing } = environment.value.languageModel
  // A source measuring both roles runs once: its checks do not depend on the role under test, only which calls the
  // recording would time, so its first role is enough.
  const role = source.roles[0] ?? 'structured'
  const observations = await observeSource({ apiKey: { value: apiKey }, source, candidate: readRoleCandidate({
    configurations: { structured: structured.active, writing: writing.active }, role }) })
  console.info(JSON.stringify(observations))
  return readFailedObservations({ observations })
}
