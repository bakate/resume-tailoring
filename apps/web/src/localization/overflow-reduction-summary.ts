import type { Locale } from './localization'

type OverflowReduction = Readonly<{ locale: Locale; achievements: number; other: number; pageCount: 1 | 2 | null }>

/** The Page Budget status naming the Hidden Content Overflow Reduction produced, or null when it hid nothing. */
export function describeOverflowReduction({ locale, achievements, other, pageCount }: OverflowReduction) {
  if (achievements + other === 0) return null
  return locale === 'fr' ? describeInFrench({ achievements, other, pageCount }) : describeInEnglish({ achievements, other, pageCount })
}

function describeInEnglish({ achievements, other, pageCount }: Omit<OverflowReduction, 'locale'>) {
  const achievementText = `${String(achievements)} ${achievements === 1 ? 'achievement' : 'achievements'}`
  const otherText = `${String(other)} ${achievements > 0 ? 'other ' : ''}${other === 1 ? 'item' : 'items'}`
  const counted = [achievements > 0 ? achievementText : null, other > 0 ? otherText : null].filter(Boolean).join(' and ')
  const budget = pageCount === null ? 'the page budget' : pageCount === 1 ? 'one page' : 'two pages'
  return `${counted} hidden to fit ${budget}.`
}

function describeInFrench({ achievements, other, pageCount }: Omit<OverflowReduction, 'locale'>) {
  const achievementText = `${String(achievements)} ${achievements === 1 ? 'réalisation' : 'réalisations'}`
  const otherText = `${String(other)} ${achievements > 0 ? (other === 1 ? 'autre ' : 'autres ') : ''}${other === 1 ? 'élément' : 'éléments'}`
  const counted = [achievements > 0 ? achievementText : null, other > 0 ? otherText : null].filter(Boolean).join(' et ')
  // A count of achievements alone agrees in the feminine; any mention of « élément » makes the participle masculine.
  const hidden = other > 0 ? (achievements + other === 1 ? 'masqué' : 'masqués') : (achievements === 1 ? 'masquée' : 'masquées')
  const budget = pageCount === null ? 'dans le nombre de pages prévu' : pageCount === 1 ? 'sur une page' : 'sur deux pages'
  return `${counted} ${hidden} pour tenir ${budget}.`
}
