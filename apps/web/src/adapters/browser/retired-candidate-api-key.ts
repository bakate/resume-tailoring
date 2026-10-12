/** Where an earlier version kept the Candidate's own provider key, in the tab's `sessionStorage`. */
const retiredStorageKey = 'resume-studio.candidate-api-key'

/** Erases a provider key an earlier version left in tab storage; no model request is ever signed with it. */
export function eraseRetiredCandidateApiKey({ readStorage }: Readonly<{ readStorage: () => Storage }>) {
  try { readStorage().removeItem(retiredStorageKey) } catch { /* Without tab storage, nothing was kept. */ }
}
