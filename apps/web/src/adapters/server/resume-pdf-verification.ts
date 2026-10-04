const a4WidthPoints = 595.28
const a4HeightPoints = 841.89
const pageSizeTolerancePoints = 1
const expectedPdfFontNames = ['Inter', 'Lora'] as const
const textItemBoundary = '\u0000'

export function hasExpectedEmbeddedFonts({ pdfBytes }: Readonly<{ pdfBytes: Uint8Array }>) {
  const pdfSource = new TextDecoder('latin1').decode(pdfBytes)
  const embeddedFontCount = [...pdfSource.matchAll(/\/FontFile(?:2|3)?\b/gu)].length
  return embeddedFontCount >= expectedPdfFontNames.length
    && expectedPdfFontNames.every((fontName) => pdfSource.includes(`+${fontName}`))
}

export function hasExpectedPdfTextInReadingOrder({ expectedText, extractedTextItems }: Readonly<{
  expectedText: readonly string[]
  extractedTextItems: readonly string[]
}>) {
  const extractedText = extractedTextItems.map((value) => normalizeText({ value }))
    .join(textItemBoundary)
  let nextPosition = 0
  for (const text of expectedText) {
    const matchEnd = findTextEnd({
      extractedText, expectedText: normalizeText({ value: text }), nextPosition,
    })
    if (matchEnd === null) return false
    nextPosition = matchEnd
  }
  return true
}

function findTextEnd({ extractedText, expectedText, nextPosition }: Readonly<{
  extractedText: string
  expectedText: string
  nextPosition: number
}>) {
  for (let candidatePosition = nextPosition; candidatePosition < extractedText.length;
    candidatePosition += 1) {
    const matchEnd = matchTextAt({ candidatePosition, expectedText, extractedText })
    if (matchEnd !== null) return matchEnd
  }
  return null
}

function matchTextAt({ candidatePosition, expectedText, extractedText }: Readonly<{
  candidatePosition: number
  expectedText: string
  extractedText: string
}>) {
  let extractedPosition = candidatePosition
  let expectedPosition = 0
  while (expectedPosition < expectedText.length && extractedPosition < extractedText.length) {
    if (extractedText[extractedPosition] === textItemBoundary) {
      extractedPosition += 1
      if (expectedText[expectedPosition] === ' ') expectedPosition += 1
      continue
    }
    if (extractedText[extractedPosition] !== expectedText[expectedPosition]) return null
    extractedPosition += 1
    expectedPosition += 1
  }
  return expectedPosition === expectedText.length ? extractedPosition : null
}

function normalizeText({ value }: Readonly<{ value: string }>) {
  return value
    .normalize('NFKC')
    .replace(/[\u02BC\u2018\u2019]/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim()
}

export function hasA4Dimensions({ view }: Readonly<{ view: readonly number[] }>) {
  const width = view[2]
  const height = view[3]
  if (width === undefined || height === undefined) return false
  return Math.abs(width - a4WidthPoints) <= pageSizeTolerancePoints
    && Math.abs(height - a4HeightPoints) <= pageSizeTolerancePoints
}
