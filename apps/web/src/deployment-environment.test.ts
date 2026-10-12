import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { validateServerEnvironment } from './env'
import {
  deepSeekStructuredModelConfiguration,
  deepSeekWritingModelConfiguration,
  structuredModelConfiguration,
  writingModelConfiguration,
} from './model-evaluation/model-configurations'

/**
 * `pnpm check` gates the production deployment, so the Language Model selection the stack deploys is validated here,
 * before any Candidate can reach it: a provider, model or effort without a Qualified Model Configuration never ships.
 */
describe('production deployment environment', () => {
  it('deploys a Language Model selection the server accepts', () => {
    const environment = readDeployedEnvironment()

    const result = validateServerEnvironment({ environment })

    expect(environment).toHaveProperty('LANGUAGE_MODEL_PROVIDER')
    expect(result).toMatchObject({ ok: true })
  })

  /**
   * The deadline chain: an operation's provider deadline, its conformance retry included, ends before the Lambda
   * times out, which leaves the route time to answer with a Failure Cause rather than a cut connection. The Worker
   * and the browser set no timeout of their own (docs/deployment/aws-lambda.md).
   */
  const modelConfigurations = [structuredModelConfiguration, writingModelConfiguration, deepSeekStructuredModelConfiguration,
    deepSeekWritingModelConfiguration]

  it.each(modelConfigurations)('ends every $provider $role operation deadline before the Lambda times out', (configuration) => {
    const lambdaTimeoutMilliseconds = readLambdaTimeoutSeconds() * 1_000

    const deadlines = Object.values(configuration.operations).map(({ deadlineMilliseconds }) => deadlineMilliseconds)

    expect(Math.max(...deadlines) + routeAnswerMarginMilliseconds).toBeLessThanOrEqual(lambdaTimeoutMilliseconds)
  })

  it('sets every model setting explicitly rather than relying on a default', () => {
    const environment = readDeployedEnvironment()

    expect(Object.keys(environment)).toEqual(expect.arrayContaining([
      'OPENAI_STRUCTURED_MODEL', 'OPENAI_STRUCTURED_REASONING_EFFORT', 'OPENAI_WRITING_MODEL', 'OPENAI_WRITING_REASONING_EFFORT',
    ]))
  })
})

/** Time the route keeps, past the provider deadline, to log the failure and answer with its Failure Cause. */
const routeAnswerMarginMilliseconds = 5_000

function readLambdaTimeoutSeconds() {
  const timeout = /^ {6}Timeout: (\d+)$/mu.exec(readTemplate())
  if (timeout === null) throw new Error('template.yaml sets no Lambda timeout')
  return Number(timeout[1])
}

function readTemplate() {
  return readFileSync(new URL('../../../template.yaml', import.meta.url), 'utf8')
}

/**
 * The Lambda environment block of `template.yaml`. A value bound to a stack parameter (`!Ref`) is a secret supplied at
 * deployment, so it stands in as a placeholder.
 */
function readDeployedEnvironment() {
  const template = readTemplate()
  const block = /^( +)Environment:\n\1 {2}Variables:\n((?:\1 {4}\w+: .+\n)+)/mu.exec(template)
  if (block === null) throw new Error('template.yaml has no Lambda environment variables')
  return Object.fromEntries((block[2] ?? '').trimEnd().split('\n').map((line) => {
    const [name = '', ...value] = line.trim().split(': ')
    const setting = value.join(': ')
    return [name, setting.startsWith('!Ref ') ? 'deployment-parameter' : setting.replace(/^(['"])(.*)\1$/u, '$2')]
  }))
}
