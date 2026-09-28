export function readPreferredResumeLocale({
  fallbackLocale,
  jobPostingContent,
}: Readonly<{
  fallbackLocale: 'en' | 'fr'
  jobPostingContent: string
}>) {
  const scores = scoreLanguageSignals({ content: jobPostingContent })
  if (scores.french === scores.english) return fallbackLocale
  return scores.french > scores.english ? 'fr' : 'en'
}

function scoreLanguageSignals({ content }: Readonly<{ content: string }>) {
  const normalizedContent = content.toLocaleLowerCase('fr')
  const words = normalizedContent.match(/\p{Letter}+/gu) ?? []
  return {
    english: words.filter((word) => englishWords.has(word)).length,
    french: words.filter((word) => frenchWords.has(word)).length
      + (normalizedContent.match(/[àâçéèêëîïôùûüÿœ]/gu)?.length ?? 0),
  }
}

const frenchWords = new Set([
  'avec', 'compétences', 'conception', 'dans', 'de', 'des', 'développeur', 'du', 'et',
  'expérience', 'la', 'le', 'les', 'maîtrise', 'missions', 'poste', 'pour', 'une', 'vous',
])

const englishWords = new Set([
  'and', 'developer', 'experience', 'for', 'in', 'job', 'of', 'requirements', 'role', 'skills',
  'the', 'to', 'with',
])
