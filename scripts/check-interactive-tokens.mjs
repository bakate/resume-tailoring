import { readFile, readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'

const candidateJourneyDirectory = 'apps/web/src/candidate-journey'
const themeFile = 'candidate-journey-theme.ts'
const globalStylesheet = 'apps/web/src/styles.css'
const inspectedExtensions = new Set(['.css', '.ts', '.tsx'])
const rawColorLiteral = /#[\da-f]{3,8}\b|\b(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\s*\([^)]*\)?/iu
const forbiddenPatterns = [
  { label: 'raw color literal', pattern: rawColorLiteral },
  { label: 'inline style object', pattern: /\bstyle\s*=\s*\{/u },
  {
    label: 'raw interactive visual value',
    pattern: /\b(?:background|bd|borderColor|color|radius|shadow)\s*=\s*\{?\s*['"`]?(?:#|\d|rgb|hsl)/iu,
  },
  {
    label: 'non-semantic Mantine color',
    pattern: /\bcolor\s*=\s*['"`](?!caution\b|danger\b|forest\b|informative\b)[^'"`]+['"`]/u,
  },
  {
    label: 'non-semantic Mantine text color',
    pattern: /\bc\s*=\s*['"`](?!danger(?:\.\d)?\b|dimmed\b|forest(?:\.\d)?\b)[^'"`]+['"`]/u,
  },
]

const files = await findCandidateJourneyVisualFiles(candidateJourneyDirectory)
const violations = [
  ...(await Promise.all(files.map(inspectFile))).flat(),
  ...(await inspectStylesheet(globalStylesheet)),
]

if (violations.length > 0) {
  process.stderr.write(`${violations.join('\n')}\n`)
  process.exitCode = 1
}

async function findCandidateJourneyVisualFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directoryPath, entry.name)
    if (entry.isDirectory()) return findCandidateJourneyVisualFiles(entryPath)
    if (entry.name === themeFile) return []
    return inspectedExtensions.has(extname(entry.name)) ? [entryPath] : []
  }))
  return nestedFiles.flat()
}

async function inspectFile(filePath) {
  const source = await readFile(filePath, 'utf8')
  return forbiddenPatterns.flatMap(({ label, pattern }) => pattern.test(source) ? [violation(filePath, label)] : [])
}

/** Only declarations are read: selectors may name ids that look like hex colours, and comments may quote a value. */
async function inspectStylesheet(filePath) {
  const source = (await readFile(filePath, 'utf8')).replace(/\/\*[\s\S]*?\*\//gu, '')
  const declarations = [...source.matchAll(/\{([^{}]*)\}/gu)].map(([, block]) => block).join('\n')
  const literals = [...new Set(declarations.match(new RegExp(rawColorLiteral, 'giu')) ?? [])]
  return literals.length > 0 ? [violation(filePath, `raw color literal (${literals.join(', ')})`)] : []
}

function violation(filePath, label) {
  return `${filePath}: ${label}; use a Mantine theme token`
}
