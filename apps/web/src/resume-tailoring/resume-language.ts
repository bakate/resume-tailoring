export function readPreferredResumeLocale({
  fallbackLocale,
  jobPostingContent,
}: Readonly<{
  fallbackLocale: 'en' | 'fr'
  jobPostingContent: string
}>) {
  const content = jobPostingContent.toLocaleLowerCase('fr')
  const frenchSignals = content.match(/\b(?:avec|compétences|expérience|missions|poste|vous)\b/gu)
  const englishSignals = content.match(/\b(?:experience|job|requirements|role|skills|with)\b/gu)
  if ((frenchSignals?.length ?? 0) === (englishSignals?.length ?? 0)) return fallbackLocale
  return (frenchSignals?.length ?? 0) > (englishSignals?.length ?? 0) ? 'fr' : 'en'
}
