import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const behaviorTestSuffix = '.behavior.test.ts'
const forbiddenHarnessActions = /system\.(act|execute|perform|run|submit)\s*\(/

const testFiles = await findBehaviorTests('packages')
const violations = (
  await Promise.all(testFiles.map((testFile) => inspectBehaviorTest(testFile)))
).flat()

if (violations.length > 0) {
  process.stderr.write(`${violations.join('\n')}\n`)
  process.exitCode = 1
}

async function findBehaviorTests(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true })
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(directoryPath, entry.name)
      if (entry.isDirectory()) return findBehaviorTests(entryPath)
      return entry.name.endsWith(behaviorTestSuffix) ? [entryPath] : []
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
