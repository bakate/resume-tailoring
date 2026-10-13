import { validateServerEnvironment } from '../env'
import { observeSource, readFailedObservations, type ModelObservationSource } from './model-qualification-runner'

/**
 * Runs one live source on the configurations the server environment validates, the way the recording runs it, and
 * returns the observations that record a failure. A live evaluation test expects none.
 */
export async function readLiveSourceFailures({ source }: Readonly<{ source: ModelObservationSource }>) {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('A Language Model Provider key must be configured for live evaluation')
  const { apiKey, structured, writing } = environment.value.languageModel
  const role = source.roles[0] ?? 'structured'
  const configurations = { structured: structured.active, writing: writing.active }
  const observations = await observeSource({ apiKey: { value: apiKey }, source, candidate: {
    configuration: configurations[role], companion: configurations[role === 'structured' ? 'writing' : 'structured'] } })
  console.info(JSON.stringify(observations))
  return readFailedObservations({ observations })
}
