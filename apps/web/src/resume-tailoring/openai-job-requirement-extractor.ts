import type {
  JobRequirementExtractor,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  jobRequirementClassifications,
  jobRequirementMaximumCount,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import {
  extractedJobRequirementsSchema,
  hasOnlyJobPostingSourceExcerpts,
  jobRequirementSourceExcerptMaximumCharacters,
  jobRequirementValueMaximumCharacters,
} from './job-requirement-schemas'

type OpenAiExtractorDependencies = Readonly<{
  apiKey: string
  model: string
  request?: typeof fetch
}>

export function createOpenAiJobRequirementExtractor({
  apiKey,
  model,
  request = fetch,
}: OpenAiExtractorDependencies): JobRequirementExtractor {
  return {
    extract: ({ jobPostingContent }) => requestJobRequirementExtraction({
      apiKey, jobPostingContent, model, request,
    }),
  }
}

type ExtractionRequest = OpenAiExtractorDependencies & Readonly<{ jobPostingContent: string }>

async function requestJobRequirementExtraction(requestDetails: ExtractionRequest) {
  const { apiKey, jobPostingContent, model, request = fetch } = requestDetails
  try {
    const response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: createHeaders({ apiKey }),
      body: JSON.stringify(createRequestBody({ jobPostingContent, model })),
      signal: AbortSignal.timeout(jobRequirementExtractionTimeoutMilliseconds),
    })
    if (!response.ok) return extractionUnavailableResult
    return parseOpenAiResponse({ jobPostingContent, value: await response.json() })
  } catch {
    return extractionUnavailableResult
  }
}

function createHeaders({ apiKey }: Readonly<{ apiKey: string }>) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

function createRequestBody({
  jobPostingContent,
  model,
}: Readonly<{ jobPostingContent: string; model: string }>) {
  return {
    model,
    store: false,
    input: createExtractionInput({ jobPostingContent }),
    text: { format: jobRequirementResponseFormat },
  }
}

function createExtractionInput({ jobPostingContent }: Readonly<{ jobPostingContent: string }>) {
  return [
    { role: 'developer', content: [{ type: 'input_text', text: extractionInstructions }] },
    { role: 'user', content: [{ type: 'input_text', text: jobPostingContent }] },
  ]
}

function parseOpenAiResponse({
  jobPostingContent,
  value,
}: Readonly<{ jobPostingContent: string; value: unknown }>) {
  const response = openAiResponseSchema.safeParse(value)
  if (!response.success) return extractionUnavailableResult
  const outputText = readOutputText({ output: response.data.output })
  if (outputText === undefined) return extractionUnavailableResult
  try {
    return parseRequirements({ jobPostingContent, value: JSON.parse(outputText) as unknown })
  } catch {
    return extractionUnavailableResult
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

function parseRequirements({
  jobPostingContent,
  value,
}: Readonly<{ jobPostingContent: string; value: unknown }>) {
  const result = extractedJobRequirementsSchema.safeParse(value)
  if (!result.success) return extractionUnavailableResult
  if (!hasOnlyJobPostingSourceExcerpts({
    jobPostingContent, requirements: result.data.requirements,
  })) return extractionUnavailableResult
  return { ok: true, value: result.data.requirements } as const
}

const extractionInstructions = [
  'Extract every explicit qualification or expectation from the Job Posting.',
  'Classify each one as required only when mandatory wording is explicit; otherwise use preferred.',
  'Split compound passages into indivisible requirements.',
  'Copy sourceExcerpt exactly from the Job Posting for every requirement.',
  'Never infer or add a requirement.',
].join(' ')

const jobRequirementResponseFormat = {
  type: 'json_schema',
  name: 'job_requirements',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['requirements'],
    properties: {
      requirements: {
        type: 'array',
        maxItems: jobRequirementMaximumCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['classification', 'sourceExcerpt', 'value'],
          properties: {
            classification: { type: 'string', enum: jobRequirementClassifications },
            sourceExcerpt: {
              type: 'string',
              minLength: 1,
              maxLength: jobRequirementSourceExcerptMaximumCharacters,
            },
            value: {
              type: 'string',
              minLength: 1,
              maxLength: jobRequirementValueMaximumCharacters,
            },
          },
        },
      },
    },
  },
} as const

const openAiResponseSchema = z.object({ output: z.array(z.unknown()) })
const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })

const extractionUnavailableResult = {
  ok: false,
  error: { type: 'job-requirement-extraction-unavailable' },
} as const

const jobRequirementExtractionTimeoutMilliseconds = 30_000
