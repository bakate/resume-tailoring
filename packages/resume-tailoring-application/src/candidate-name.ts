import { containsContactDetail, minimizeSensitiveContent } from './content-privacy'

/**
 * Detects the Candidate name locally so it never reaches the Language Model Provider.
 * The heuristic prefers no name to a wrong one: the Candidate can always type it before export.
 */
export function detectCandidateName({ content }: Readonly<{ content: string }>): string | null {
  const lines = content.split(/\r?\n/u).map((line) => line.trim()).filter((line) => line.length > 0)
  const firstName = readLeadingSegment(lines[0] ?? '')
  if (looksLikeCandidateName(firstName)) return firstName
  const header = lines.slice(0, headerLineCount)
  const contactLineIndexes = header.flatMap((line, index) => containsContactDetail({ content: line }) ? [index] : [])
  return header.map(readLeadingSegment).find((segment, index) => contactLineIndexes.some((contactIndex) =>
    Math.abs(contactIndex - index) === 1) && looksLikeCandidateName(segment)) ?? null
}

/** A PDF header often extracts as one line per row: the name comes before a column gap, a separator or an icon. */
function readLeadingSegment(line: string) {
  return line.split(/\s{2,}|[|•·]|\p{Extended_Pictographic}/u)[0]?.trim() ?? ''
}

export function minimizeCandidateContent({ content }: Readonly<{ content: string }>) {
  return minimizeSensitiveContent({ content, candidateName: detectCandidateName({ content }), unlabeledAddresses: true })
}

function looksLikeCandidateName(line: string): boolean {
  const trimmedLine = line.trim()
  if (trimmedLine.length === 0 || /\d/u.test(trimmedLine) || trimmedLine.includes('@')) return false
  const words = trimmedLine.split(/\s+/u)
  if (words.length < 2 || words.length > 4) return false
  if (words.some((word) => nonNameWords.has(word.toLowerCase()))) return false
  return words.every(isNameWord)
}

/** A capitalized or upper-case word, where hyphens and apostrophes join capitalized parts (Jean-Pierre, O'Brien). */
function isNameWord(word: string) {
  if (!/^\p{L}+(?:[-'’]\p{L}+)*$/u.test(word)) return false
  return word.split(/[-'’]/u).every((part) => {
    const rest = part.slice(1)
    const capitalized = part.charAt(0) === part.charAt(0).toUpperCase() && rest === rest.toLowerCase()
    return capitalized || part === part.toUpperCase()
  })
}

const headerLineCount = 5

/** Words that mark a role, a field of work or a section heading: a line containing one is never taken for a name. */
const nonNameWords = new Set([
  'about', 'analyst', 'analyste', 'apprentice', 'architect', 'architecte', 'assistant', 'assistante', 'backend',
  'career', 'carrière', 'ceo', 'certifications', 'chef', 'consultant', 'consultante', 'contact', 'coordonnées', 'cto',
  'curriculum', 'cv', 'data', 'designer', 'developer', 'devops', 'développeur', 'développeuse', 'director', 'directeur',
  'directrice', 'education', 'engineer', 'étudiant', 'étudiante', 'experience', 'expérience', 'expériences', 'formation',
  'freelance', 'frontend', 'fullstack', 'head', 'information', 'informations', 'ingénieur', 'ingénieure', 'intern',
  'junior', 'languages', 'langues', 'lead', 'manager', 'objective', 'objectif', 'officer', 'personal', 'personnelles',
  'product', 'professional', 'professionnel', 'professionnelle', 'profil', 'profile', 'projects', 'projets', 'references',
  'références', 'resume', 'scientist', 'senior', 'skills', 'compétences', 'software', 'specialist', 'spécialiste',
  'stagiaire', 'student', 'summary', 'technician', 'technicien', 'technicienne', 'work',
])
