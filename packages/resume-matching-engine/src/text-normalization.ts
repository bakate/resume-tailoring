export function foldText({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFD').replaceAll(/\p{Diacritic}/gu, '').toLocaleLowerCase('en')
}

export function normalizeText({ value }: Readonly<{ value: string }>) {
  return foldText({ value }).replaceAll(/[^a-z0-9+#]+/gu, ' ').trim()
}
