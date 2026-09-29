import type {
  StructuredSourceProfileExtractor,
} from '@resume-tailoring/application/source-intake'
import { z } from 'zod'

import type { OpenAiReasoningEffort } from '../openai-model-configuration'
import { createOpenAiRequester } from '../resume-tailoring/openai-request'
import {
  structuredSourceProfileExtractionSchema,
  structuredSourceProfileResponseFormat,
} from './structured-source-profile-schema'

export function createOpenAiStructuredSourceProfileExtractor({
  apiKey,
  model,
  reasoningEffort,
  request = fetch,
}: Readonly<{
  apiKey: string
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request?: typeof fetch
}>): StructuredSourceProfileExtractor {
  return {
    extract: ({ professionalContent }) => requestExtraction({
      apiKey,
      model,
      professionalContent,
      reasoningEffort,
      request,
    }),
  }
}

async function requestExtraction({
  apiKey,
  model,
  professionalContent,
  reasoningEffort,
  request,
}: Readonly<{
  apiKey: string
  model: string
  professionalContent: string
  reasoningEffort: OpenAiReasoningEffort
  request: typeof fetch
}>) {
  const requester = createOpenAiRequester({ apiKey, request })
  const response = await requester.send({
    body: {
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: extractionInstructions }] },
        { role: 'user', content: [{ type: 'input_text', text: professionalContent }] },
      ],
      max_output_tokens: 16_000,
      model,
      reasoning: { effort: reasoningEffort },
      store: false,
      text: { format: structuredSourceProfileResponseFormat },
    },
    operation: 'structured-source-profile-extraction',
  })
  return response.ok ? parseOpenAiResponse({ value: response.value }) : unavailableResult
}

function parseOpenAiResponse({ value }: Readonly<{ value: unknown }>) {
  const response = openAiResponseSchema.safeParse(value)
  if (!response.success) return unavailableResult
  const outputText = readOutputText({ output: response.data.output })
  if (outputText === undefined) return unavailableResult
  try {
    const extraction = structuredSourceProfileExtractionSchema.safeParse(JSON.parse(outputText))
    return extraction.success ? { ok: true, value: extraction.data } as const : unavailableResult
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

const extractionInstructions = [
  'Build an exhaustive structured Source Profile using only explicit Candidate evidence.',
  'Preserve experiences, projects, skills, education, languages, and certifications separately.',
  'Never infer dates, seniority, proficiency, organizations, qualifications, or outcomes.',
  'Use null when an optional value is absent.',
  'Report a Critical Ambiguity only when a fact is unsafe to order, score, or reuse.',
  'Each ambiguity path must identify one scalar fact as section.entryIndex.field.valueIndex.',
  'Ask one concise targeted question for that fact; do not withhold unrelated evidence.',
].join(' ')

const openAiResponseSchema = z.object({
  output: z.array(z.unknown()),
})

const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })

const unavailableResult = {
  ok: false,
  error: 'source-profile-extraction-unavailable',
} as const
