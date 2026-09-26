import type {
  SourceProfileExtractor,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { sourceProfileFactKinds } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import { extractedSourceProfileFactsSchema } from './source-profile-schemas'

type OpenAiExtractorDependencies = Readonly<{
  apiKey: string
  model: string
  request?: typeof fetch
}>

export function createOpenAiSourceProfileExtractor({
  apiKey,
  model,
  request = fetch,
}: OpenAiExtractorDependencies): SourceProfileExtractor {
  return {
    extract: ({ professionalContent }) => requestSourceProfileExtraction({
      apiKey, model, professionalContent, request,
    }),
  }
}

type ExtractionRequest = OpenAiExtractorDependencies & Readonly<{ professionalContent: string }>

async function requestSourceProfileExtraction(requestDetails: ExtractionRequest) {
  const { apiKey, model, professionalContent, request = fetch } = requestDetails
  try {
    const response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: createHeaders({ apiKey }),
      body: JSON.stringify(createRequestBody({ model, professionalContent })),
      signal: AbortSignal.timeout(sourceProfileExtractionTimeoutMilliseconds),
    })
    return response.ok ? parseOpenAiResponse({ value: await response.json() }) : unavailableResult
  } catch {
    return unavailableResult
  }
}

function createHeaders({ apiKey }: Readonly<{ apiKey: string }>) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

function createRequestBody({
  model,
  professionalContent,
}: Readonly<{ model: string; professionalContent: string }>) {
  return {
    model,
    store: false,
    input: createExtractionInput({ professionalContent }),
    text: { format: sourceProfileResponseFormat },
  }
}

function createExtractionInput({ professionalContent }: Readonly<{ professionalContent: string }>) {
  return [
    { role: 'developer', content: [{ type: 'input_text', text: extractionInstructions }] },
    { role: 'user', content: [{ type: 'input_text', text: professionalContent }] },
  ]
}

function parseOpenAiResponse({ value }: Readonly<{ value: unknown }>) {
  const response = openAiResponseSchema.safeParse(value)
  if (!response.success) return unavailableResult
  const outputText = readOutputText({ output: response.data.output })
  if (outputText === undefined) return unavailableResult
  try {
    return parseExtractedFacts({ value: JSON.parse(outputText) as unknown })
  } catch {
    return unavailableResult
  }
}

function readOutputText({ output }: Readonly<{ output: readonly unknown[] }>) {
  for (const item of output) {
    const parsedItem = openAiOutputItemSchema.safeParse(item)
    if (!parsedItem.success) continue
    for (const content of parsedItem.data.content) {
      const parsedContent = openAiOutputTextSchema.safeParse(content)
      if (parsedContent.success) return parsedContent.data.text
    }
  }
  return undefined
}

function parseExtractedFacts({ value }: Readonly<{ value: unknown }>) {
  const result = extractedSourceProfileFactsSchema.safeParse(value)
  return result.success ? { ok: true, value: result.data.facts } as const : unavailableResult
}

const extractionInstructions = [
  'Extract only explicit professional facts from the Candidate content.',
  'Each fact must contain exactly one indivisible proposition; split claims joined by conjunctions.',
  'Never infer, combine, rank, or verify.',
  'Use propositionKey format proposition-<kind>-<subject>-<attribute> in lowercase ASCII kebab-case.',
  'The key identifies the asserted property, never its value; competing values for the same property must use exactly the same key.',
].join(' ')

const sourceProfileResponseFormat = {
  type: 'json_schema',
  name: 'source_profile_facts',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['facts'],
    properties: {
      facts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'propositionKey', 'value'],
          properties: {
            kind: {
              type: 'string',
              enum: sourceProfileFactKinds,
            },
            propositionKey: {
              type: 'string',
              description: 'Canonical property key independent of the asserted value. Reuse it for competing claims.',
              pattern: `^proposition-(${sourceProfileFactKinds.join('|')})-[a-z0-9]+(?:-[a-z0-9]+)*$`,
              minLength: 13,
              maxLength: 200,
            },
            value: {
              type: 'string',
              description: 'One atomic claim without a conjunction joining separate claims.',
              minLength: 1,
              maxLength: 500,
            },
          },
        },
      },
    },
  },
} as const

const openAiResponseSchema = z.object({
  output: z.array(z.unknown()),
})

const openAiOutputItemSchema = z.object({
  content: z.array(z.unknown()),
})

const openAiOutputTextSchema = z.object({
  type: z.literal('output_text'),
  text: z.string(),
})

const unavailableResult = {
  ok: false,
  error: { type: 'source-profile-extraction-unavailable' },
} as const

const sourceProfileExtractionTimeoutMilliseconds = 30_000
