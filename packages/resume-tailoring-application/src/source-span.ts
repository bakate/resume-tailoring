/** The exact span of `text` that `quote` reproduces, or null when `quote` does not reproduce any span of it. */
export function locateSourceSpan({ text, quote }: Readonly<{ text: string; quote: string }>): string | null {
  const words = quote.trim().split(/\s+/u).filter((word) => word.length > 0)
  if (words.length === 0) return null
  // Only letter case and whitespace may differ: the words themselves must be the source's own.
  const pattern = new RegExp(words.map((word) => word.replaceAll(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('\\s+'), 'iu')
  return pattern.exec(text)?.[0] ?? null
}
