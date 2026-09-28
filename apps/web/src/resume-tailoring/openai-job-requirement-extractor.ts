import type {
  JobRequirementExtractor,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  jobRequirementClassifications,
  jobRequirementMaximumCount,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import type { OpenAiReasoningEffort } from '../openai-model-configuration'
import {
  extractedJobRequirementsSchema,
  hasOnlyJobPostingSourceExcerpts,
  jobRequirementSourceExcerptMaximumCharacters,
  jobRequirementValueMaximumCharacters,
} from './job-requirement-schemas'
import {
  jobPostingTargetRoleMaximumCharacters,
  jobPostingTargetRoleSourceExcerptMaximumCharacters,
} from './job-posting-target-role-schema'

type OpenAiExtractorDependencies = Readonly<{
  apiKey: string
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request?: typeof fetch
}>

export function createOpenAiJobRequirementExtractor({
  apiKey,
  model,
  reasoningEffort,
  request = fetch,
}: OpenAiExtractorDependencies): JobRequirementExtractor {
  return {
    extract: ({ jobPostingContent }) => requestJobRequirementExtraction({
      apiKey, jobPostingContent, model, reasoningEffort, request,
    }),
  }
}

type ExtractionRequest = OpenAiExtractorDependencies & Readonly<{ jobPostingContent: string }>

async function requestJobRequirementExtraction(requestDetails: ExtractionRequest) {
  const { apiKey, jobPostingContent, model, reasoningEffort, request = fetch } = requestDetails
  try {
    const response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: createHeaders({ apiKey }),
      body: JSON.stringify(createRequestBody({ jobPostingContent, model, reasoningEffort })),
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
  reasoningEffort,
}: Readonly<{
  jobPostingContent: string
  model: string
  reasoningEffort: OpenAiExtractorDependencies['reasoningEffort']
}>) {
  return {
    model,
    max_output_tokens: maximumOutputTokens,
    reasoning: { effort: reasoningEffort },
    store: false,
    input: createExtractionInput({ jobPostingContent }),
    text: { format: jobRequirementResponseFormat },
  }
}

const maximumOutputTokens = 12_000

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
    jobPostingContent,
    practicalConstraints: result.data.practicalConstraints,
    requirements: result.data.requirements,
    targetRole: result.data.targetRole,
  })) return extractionUnavailableResult
  return { ok: true, value: result.data } as const
}

const extractionInstructions = [
  'Extract targetRole only when the Job Posting states one unambiguous role; otherwise return null.',
  'Copy targetRole.sourceExcerpt exactly from the Job Posting and copy targetRole.value as an exact substring of that excerpt.',
  'Return explicit professional qualifications and expectations in requirements.',
  'Return explicit location, remote-work policy, work authorization, availability, and compensation conditions in practicalConstraints.',
  'Classify each one as required only when mandatory wording is explicit; otherwise use preferred.',
  'Split compound passages into indivisible requirements.',
  'Copy sourceExcerpt exactly from the Job Posting for every requirement.',
  'Copy value as an exact atomic substring of sourceExcerpt for every requirement.',
  'Never infer or add a requirement.',
].join(' ')

const jobRequirementResponseFormat = {
  type: 'json_schema',
  name: 'job_requirements',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['targetRole', 'practicalConstraints', 'requirements'],
    properties: {
      targetRole: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            required: ['sourceExcerpt', 'value'],
            properties: {
              sourceExcerpt: {
                type: 'string',
                minLength: 1,
                maxLength: jobPostingTargetRoleSourceExcerptMaximumCharacters,
              },
              value: { type: 'string', minLength: 1, maxLength: jobPostingTargetRoleMaximumCharacters },
            },
          },
        ],
      },
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
      practicalConstraints: {
        type: 'array',
        maxItems: jobRequirementMaximumCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sourceExcerpt', 'value'],
          properties: {
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
