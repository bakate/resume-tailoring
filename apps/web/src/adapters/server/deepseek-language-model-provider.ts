import { createDeepSeek } from '@ai-sdk/deepseek'

import { readModelOperationSettings } from '../../language-model-configuration'
import type { LanguageModelProviderAdapter, ProviderFailure } from './language-model-request'
import { classifyApiCallFailure } from './provider-api-call-failure'

/**
 * DeepSeek through Chat Completions in JSON mode (`response_format: json_object`), which does not enforce the schema:
 * the AI SDK puts the schema in a system message, the instructions add an example of its shape, and the call wrapper
 * holds the answer to the operation's schema itself. Thinking and its effort are frozen per operation.
 */
export const deepSeekLanguageModelProvider: LanguageModelProviderAdapter<'deepseek'> = {
  conformance: 'client-side',
  createLanguageModel: ({ apiKey, model, request }) => createDeepSeek({ apiKey: apiKey.value, fetch: request }).chat(model),
  readInstructions: ({ instructions, output }) => [
    instructions,
    // JSON mode requires the word "json" in the prompt; the example shows the shape the schema states.
    'Answer with one json object only, no prose and no code fence, conforming exactly to the JSON Schema given:',
    'every required key present, no additional key, and null where a value is absent but nullable.',
    'Example of the json shape (placeholder values, not content to reuse):',
    JSON.stringify(createSchemaExample({ root: output.schema, schema: output.schema })),
  ].join('\n'),
  readProviderOptions: ({ configuration, operation }) => {
    const { thinking } = readModelOperationSettings({ configuration, operation })
    return { deepseek: thinking === 'disabled'
      ? { thinking: { type: 'disabled' } }
      : { thinking: { type: 'enabled' }, reasoningEffort: thinking } }
  },
  classifyFailure: classifyDeepSeekFailure,
}

/**
 * An insufficient balance (402) is exhausted operator credit, never a rate limit, and alerts the operator; a rejected
 * key (401) is an outage too. A 429 is a rate limit with its delay, never a reason to call another provider, whatever
 * DeepSeek's documentation advises: the Candidate has consented to DeepSeek alone.
 */
export function classifyDeepSeekFailure({ error }: Readonly<{ error: unknown }>): ProviderFailure {
  return classifyApiCallFailure({ error, readStatusFailure: ({ status }) => {
    if (status === 402) return { alert: 'exhausted-provider-credit', type: 'upstream-failure' }
    if (status === 401) return { type: 'upstream-failure' }
    if (status === 429) return { type: 'rate-limited' }
    if (status >= 500) return { type: 'upstream-failure' }
    return { type: 'upstream-invalid-request' }
  } })
}

type JsonSchemaNode = Readonly<{
  $ref?: string
  anyOf?: readonly JsonSchemaNode[]
  const?: unknown
  definitions?: Readonly<Record<string, JsonSchemaNode>>
  enum?: readonly unknown[]
  items?: JsonSchemaNode
  oneOf?: readonly JsonSchemaNode[]
  pattern?: string
  properties?: Readonly<Record<string, JsonSchemaNode>>
  type?: string | readonly string[]
  $defs?: Readonly<Record<string, JsonSchemaNode>>
}>

/** A placeholder instance of a JSON Schema, so the instructions show the shape as well as the rules (BAK-171). */
export function createSchemaExample({ root, schema }: Readonly<{ root: JsonSchemaNode; schema: JsonSchemaNode }>): unknown {
  if (schema.$ref !== undefined) {
    const name = schema.$ref.split('/').at(-1) ?? ''
    const definition = (root.$defs ?? root.definitions ?? {})[name]
    return definition === undefined ? null : createSchemaExample({ root, schema: definition })
  }
  const variants = schema.anyOf ?? schema.oneOf
  if (variants !== undefined) {
    const variant = variants.find(({ type }) => type !== 'null') ?? variants[0]
    return variant === undefined ? null : createSchemaExample({ root, schema: variant })
  }
  if (schema.const !== undefined) return schema.const
  if (schema.enum !== undefined) return schema.enum[0]
  const type = typeof schema.type === 'string' ? schema.type : schema.type?.find((candidate) => candidate !== 'null')
  if (type === 'object') {
    return Object.fromEntries(Object.entries(schema.properties ?? {})
      .map(([key, property]) => [key, createSchemaExample({ root, schema: property })]))
  }
  if (type === 'array') return [createSchemaExample({ root, schema: schema.items ?? {} })]
  if (type === 'string') return schema.pattern === undefined ? '…' : readPatternExample({ pattern: schema.pattern })
  if (type === 'integer' || type === 'number') return 0
  if (type === 'boolean') return true
  return null
}

/** An identifier pattern such as `^source-fact-.*$` becomes `source-fact-1`, so the example keeps the id contract. */
function readPatternExample({ pattern }: Readonly<{ pattern: string }>) {
  return `${pattern.replace(/^\^|\.\*\$?$|\$$/gu, '').replace(/\(.*$/u, '')}1`
}
