import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { validateServerEnvironment } from './env'

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

  it('sets every model setting explicitly rather than relying on a default', () => {
    const environment = readDeployedEnvironment()

    expect(Object.keys(environment)).toEqual(expect.arrayContaining([
      'OPENAI_STRUCTURED_MODEL', 'OPENAI_STRUCTURED_REASONING_EFFORT', 'OPENAI_WRITING_MODEL', 'OPENAI_WRITING_REASONING_EFFORT',
    ]))
  })
})

/**
 * The Lambda environment block of `template.yaml`. A value bound to a stack parameter (`!Ref`) is a secret supplied at
 * deployment, so it stands in as a placeholder.
 */
function readDeployedEnvironment() {
  const template = readFileSync(new URL('../../../template.yaml', import.meta.url), 'utf8')
  const block = /^( +)Environment:\n\1 {2}Variables:\n((?:\1 {4}\w+: .+\n)+)/mu.exec(template)
  if (block === null) throw new Error('template.yaml has no Lambda environment variables')
  return Object.fromEntries((block[2] ?? '').trimEnd().split('\n').map((line) => {
    const [name = '', ...value] = line.trim().split(': ')
    const setting = value.join(': ')
    return [name, setting.startsWith('!Ref ') ? 'deployment-parameter' : setting.replace(/^(['"])(.*)\1$/u, '$2')]
  }))
}
