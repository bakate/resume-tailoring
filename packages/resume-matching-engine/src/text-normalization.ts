export function foldText({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLocaleLowerCase('en')
}

export function normalizeText({ value }: Readonly<{ value: string }>) {
  return foldText({ value }).replaceAll(/[^a-z0-9+#]+/gu, ' ').trim()
}

export function canonicalizeKnownTerm({ value }: Readonly<{ value: string }>) {
  const normalizedValue = normalizeText({ value })
  return controlledTermByAlias.get(normalizedValue) ?? normalizedValue
}

const controlledTermByAlias = new Map([
  ['typescript', 'typescript'], ['ts', 'typescript'],
  ['javascript', 'javascript'], ['js', 'javascript'],
  ['react', 'react'], ['react js', 'react'], ['reactjs', 'react'],
  ['french', 'french'], ['francais', 'french'],
  ['english', 'english'], ['anglais', 'english'],
  ['bilingual', 'bilingual'], ['bilingue', 'bilingual'],
])
