/**
 * The request header that carries the Candidate API Key on a model-backed request. The edge lifts the model quota for
 * a request that carries it, so the server must never sign such a request with the operator key.
 */
export const candidateApiKeyHeaderName = 'x-candidate-api-key'

/** A Language Model Provider key as the provider issues it; anything else is rejected before any provider call. */
export function isWellFormedCandidateApiKey(value: string) {
  return /^sk-[\w-]{20,300}$/u.test(value)
}
