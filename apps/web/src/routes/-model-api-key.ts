import type { ModelApiKey } from '../adapters/server/openai-request'
import { candidateApiKeyHeaderName, isWellFormedCandidateApiKey } from '../candidate-api-key/candidate-api-key-header'
import type { ServerEnvironment } from '../env'

/**
 * The key a model-backed request is signed with. A request that carries the Candidate API Key header is signed with
 * that key or refused, even when the header is empty or malformed: it never falls back to the operator key.
 */
export function readModelApiKey({ environment, request }: Readonly<{
  environment: Pick<ServerEnvironment, 'openAiApiKey'>; request: Request
}>): Readonly<{ ok: true; value: ModelApiKey }> | Readonly<{ ok: false; type: 'candidate-api-key-invalid' }> {
  const candidateApiKey = request.headers.get(candidateApiKeyHeaderName)
  if (candidateApiKey === null) return { ok: true, value: { source: 'operator', value: environment.openAiApiKey } }
  const value = candidateApiKey.trim()
  return isWellFormedCandidateApiKey(value)
    ? { ok: true, value: { source: 'candidate', value } }
    : { ok: false, type: 'candidate-api-key-invalid' }
}
