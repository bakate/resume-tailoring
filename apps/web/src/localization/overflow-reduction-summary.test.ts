import { describe, expect, it } from 'vitest'

import { describeOverflowReduction } from './overflow-reduction-summary'

describe('Overflow Reduction summary', () => {
  it.each([
    { locale: 'fr', achievements: 3, other: 0, pageCount: 1, summary: '3 réalisations masquées pour tenir sur une page.' },
    { locale: 'fr', achievements: 1, other: 0, pageCount: 1, summary: '1 réalisation masquée pour tenir sur une page.' },
    { locale: 'fr', achievements: 0, other: 2, pageCount: 2, summary: '2 éléments masqués pour tenir sur deux pages.' },
    { locale: 'fr', achievements: 2, other: 1, pageCount: 1,
      summary: '2 réalisations et 1 autre élément masqués pour tenir sur une page.' },
    { locale: 'en', achievements: 3, other: 0, pageCount: 1, summary: '3 achievements hidden to fit one page.' },
    { locale: 'en', achievements: 1, other: 0, pageCount: 2, summary: '1 achievement hidden to fit two pages.' },
    { locale: 'en', achievements: 0, other: 1, pageCount: 1, summary: '1 item hidden to fit one page.' },
    { locale: 'en', achievements: 4, other: 2, pageCount: 1, summary: '4 achievements and 2 other items hidden to fit one page.' },
    { locale: 'en', achievements: 2, other: 0, pageCount: null, summary: '2 achievements hidden to fit the page budget.' },
    { locale: 'fr', achievements: 2, other: 0, pageCount: null, summary: '2 réalisations masquées pour tenir dans le nombre de pages prévu.' },
  ] as const)('reports $achievements achievements and $other other items in $locale', ({ locale, summary, ...counts }) => {
    expect(describeOverflowReduction({ locale, ...counts })).toBe(summary)
  })

  it('reports nothing when Overflow Reduction hid nothing', () => {
    expect(describeOverflowReduction({ locale: 'fr', achievements: 0, other: 0, pageCount: 1 })).toBeNull()
  })
})
