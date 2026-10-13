import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResumeLocale, TailoredResumeSection } from '@resume-tailoring/application/tailored-resume'

import { readProfessionalFields } from './unsupported-resume-claims'

export type LanguageCheck = Readonly<{ name: string; passed: boolean }>

/**
 * One check per prose field of a prepared document: it must read as the requested language, judged by the function
 * words each language cannot write without. A field too short or too neutral to tell, such as a list of tools, is
 * skipped rather than guessed. Education and certifications are skipped whole: the official name of a degree, diploma
 * or certification may stay in its own language, alone or next to its translation.
 */
export function checkDocumentLanguage({ document, locale }: Readonly<{
  document: ProfessionalResumeDocument
  locale: TailoredResumeLocale
}>): readonly LanguageCheck[] {
  const sections = document.sections.filter(({ section }) => !sectionsKeepingOfficialNames.has(section))
  return readProfessionalFields({ document: { ...document, sections } }).flatMap(({ id, text }) => {
    const words = text.toLocaleLowerCase('fr').match(/\p{Letter}+/gu) ?? []
    if (words.length < minimumWordCount) return []
    const scores = { en: countFunctionWords({ language: 'en', words }), fr: countFunctionWords({ language: 'fr', words }) }
    if (scores.en === scores.fr) return []
    const other = locale === 'fr' ? 'en' : 'fr'
    return [{ name: `${id} is written in ${locale}`, passed: scores[locale] > scores[other] }]
  })
}

/**
 * Multilingual fidelity counts for one preparation. No document is one failed check; a prepared document counts only
 * the fields long enough to tell, so prose too short to read is never a failure.
 */
export function countDocumentLanguageChecks({ document, locale }: Readonly<{
  document: ProfessionalResumeDocument | null
  locale: TailoredResumeLocale
}>) {
  if (document === null) return { checkCount: 1, failed: ['no document was prepared'], passedCount: 0 }
  const checks = checkDocumentLanguage({ document, locale })
  return { checkCount: checks.length, failed: checks.filter(({ passed }) => !passed).map(({ name }) => name),
    passedCount: checks.filter(({ passed }) => passed).length }
}

function countFunctionWords({ language, words }: Readonly<{ language: TailoredResumeLocale; words: readonly string[] }>) {
  return words.filter((word) => functionWords[language].has(word)).length
}

const minimumWordCount = 6

const sectionsKeepingOfficialNames: ReadonlySet<TailoredResumeSection['section']> = new Set(['education', 'certifications'])

const functionWords: Readonly<Record<TailoredResumeLocale, ReadonlySet<string>>> = {
  en: new Set(['the', 'and', 'of', 'to', 'in', 'for', 'with', 'on', 'an', 'by', 'from', 'as', 'at', 'is', 'are', 'its',
    'their', 'this', 'that', 'into', 'across', 'over', 'within', 'while', 'using']),
  fr: new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'et', 'en', 'pour', 'avec', 'dans', 'sur',
    'au', 'aux', 'par', 'qui', 'que', 'est', 'sont', 'ses', 'son', 'sa', 'leur', 'leurs', 'ce', 'cette', 'ces', 'chez',
    'entre', 'afin', 'auprès', 'vers']),
}
