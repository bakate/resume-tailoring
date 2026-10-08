import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const behaviorTestSuffixes = ['.behavior.test.ts', '.behavior.test.js']
const contractTestSuffixes = ['.contract.test.ts']
const forbiddenHarnessActions = /system\.(act|execute|perform|run|submit)\s*\(/
const testCaseStart = /^(\s*)(it|test)(\.each)?\b/
const testCaseBodyOpener = /=>\s*\{\s*$/
const assertion = /\bexpect\b/

const behaviorTests = (await Promise.all(['packages', 'infrastructure'].map((directoryPath) =>
  findTests({ directoryPath, suffixes: behaviorTestSuffixes })))).flat()
const contractTests = await findTests({ directoryPath: 'apps/web', suffixes: contractTestSuffixes })
const violations = (await Promise.all([
  ...behaviorTests.map((testFile) => inspectBehaviorTest(testFile)),
  ...contractTests.map((testFile) => inspectContractTest(testFile)),
])).flat()

if (violations.length > 0) {
  process.stderr.write(`${violations.join('\n')}\n`)
  process.exitCode = 1
}

async function findTests({ directoryPath, suffixes }) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directoryPath, entry.name)
      if (entry.isDirectory()) {
        return entry.name === 'node_modules' ? [] : findTests({ directoryPath: entryPath, suffixes })
      }
      return suffixes.some((suffix) => entry.name.endsWith(suffix)) ? [entryPath] : []
    }),
  )

  return nestedFiles.flat()
}

async function inspectBehaviorTest(testFile) {
  const source = await readFile(testFile, 'utf8')
  const violations = []
  const suitePosition = source.indexOf('describe(')
  const factoryPosition = source.indexOf('function createSystemUnderTest(')

  if (factoryPosition === -1) {
    violations.push(`${testFile}: missing local createSystemUnderTest() factory`)
  }

  if (suitePosition === -1 || factoryPosition < suitePosition) {
    violations.push(`${testFile}: suite and cases must appear before the harness`)
  }

  if (forbiddenHarnessActions.test(source)) {
    violations.push(`${testFile}: use a caller-named harness action`)
  }

  if (/from ['"][^'"]*(\/src\/|@resume-tailoring\/domain)/.test(source)) {
    violations.push(`${testFile}: imports an internal implementation`)
  }

  if (/^ {4}expect\(/m.test(source.slice(suitePosition, factoryPosition))) {
    violations.push(`${testFile}: raw assertion in a behavior-test body`)
  }

  return violations
}

/**
 * A contract-test case separates its Given, Action, and Then phases with blank lines: assertion-free Given and
 * Action blocks precede the first block that asserts. A case whose Given is its `it.each` row may open on a
 * single-statement Action.
 */
async function inspectContractTest(testFile) {
  const lines = (await readFile(testFile, 'utf8')).split('\n')
  return readTestCases({ lines }).flatMap(({ line, body }) => {
    if (body === null) return [`${testFile}:${String(line)}: cannot read the case body; end its signature with \`=> {\``]
    const blocks = splitIntoBlocks({ lines: body })
    const thenPosition = blocks.findIndex((block) => block.some((bodyLine) => assertion.test(bodyLine)))
    if (thenPosition === -1) return [`${testFile}:${String(line)}: contract test has no Then phase`]
    if (thenPosition === 0 || (thenPosition === 1 && countStatements({ block: blocks[0] }) > 1)) {
      return [`${testFile}:${String(line)}: separate Given, Action, and Then phases with blank lines`]
    }
    return []
  })
}

function countStatements({ block }) {
  const statementIndentation = Math.min(...block.map(readIndentation))
  return block.filter((line) => readIndentation(line) === statementIndentation && !/^[})\]]/.test(line.trim())).length
}

function readTestCases({ lines }) {
  const testCases = []
  for (let start = 0; start < lines.length; start += 1) {
    if (!testCaseStart.test(lines[start])) continue
    const opener = lines.findIndex((line, position) => position >= start && testCaseBodyOpener.test(line))
    const openerIndentation = opener === -1 ? -1 : readIndentation(lines[opener])
    // The opener belongs to the case only when it is the case line itself or one of its signature lines.
    const ownsOpener = opener !== -1 && openerIndentation <= readIndentation(lines[start]) + 2
      && lines.slice(start + 1, opener).every((line) => !testCaseStart.test(line))
    const closer = !ownsOpener ? -1 : lines.findIndex((line, position) => position > opener
      && line.trim().startsWith('}') && readIndentation(line) === openerIndentation)
    if (closer === -1) {
      testCases.push({ line: start + 1, body: null })
      continue
    }
    testCases.push({ line: start + 1, body: lines.slice(opener + 1, closer) })
    start = closer
  }
  return testCases
}

function splitIntoBlocks({ lines }) {
  const blocks = [[]]
  for (const line of lines) {
    if (line.trim() === '') blocks.push([])
    else blocks.at(-1).push(line)
  }
  return blocks.filter((block) => block.length > 0)
}

function readIndentation(line) {
  return line.length - line.trimStart().length
}
