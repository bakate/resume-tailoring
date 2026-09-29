import { z } from 'zod'

import type { JobPostingExtractor } from '@resume-tailoring/application/job-match'
import type { OpenAiReasoningEffort } from '../openai-model-configuration'
import { createOpenAiRequester } from '../resume-tailoring/openai-request'
import {
  jobPostingExtractionResponseFormat,
  jobPostingExtractionSchema,
} from './job-match-schemas'

export function createOpenAiJobPostingExtractor({
  apiKey, model, reasoningEffort, request = fetch,
}: Readonly<{
  apiKey: string
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request?: typeof fetch
}>): JobPostingExtractor {
  return { extract: ({ jobPostingContent }) => requestExtraction({
    apiKey, jobPostingContent, model, reasoningEffort, request,
  }) }
}

async function requestExtraction({
  apiKey, jobPostingContent, model, reasoningEffort, request,
}: Readonly<{
  apiKey: string
  jobPostingContent: string
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request: typeof fetch
}>) {
  const requester = createOpenAiRequester({ apiKey, request })
  const response = await requester.send({
    body: createRequestBody({ jobPostingContent, model, reasoningEffort }),
    operation: 'explainable-job-posting-extraction',
  })
  return response.ok ? parseResponse({ value: response.value }) : unavailableResult
}

function createRequestBody({ jobPostingContent, model, reasoningEffort }: Readonly<{
  jobPostingContent: string
  model: string
  reasoningEffort: OpenAiReasoningEffort
}>) {
  return {
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: extractionInstructions }] },
      { role: 'user', content: [{ type: 'input_text', text: jobPostingContent }] },
    ],
    max_output_tokens: 20_000,
    model,
    reasoning: { effort: reasoningEffort },
    store: false,
    text: { format: jobPostingExtractionResponseFormat },
  }
}

function parseResponse({ value }: Readonly<{ value: unknown }>) {
  const outputText = readOutputText({ value })
  if (outputText === null) return unavailableResult
  try {
    const parsed = jobPostingExtractionSchema.safeParse(JSON.parse(outputText))
    return parsed.success ? createSuccessResult({ extraction: parsed.data }) : unavailableResult
  } catch {
    return unavailableResult
  }
}

function createSuccessResult({ extraction }: Readonly<{
  extraction: z.infer<typeof jobPostingExtractionSchema>
}>) {
  return { ok: true, value: {
    ...extraction,
    requirements: extraction.requirements.map((requirement, requirementIndex) => ({
      ...requirement,
      id: `job-requirement-${String(requirementIndex + 1)}` as const,
      substitutableGroup: requirement.substitutableGroup ?? undefined,
    })),
  } } as const
}

function readOutputText({ value }: Readonly<{ value: unknown }>) {
  const response = openAiResponseSchema.safeParse(value)
  if (!response.success) return null
  for (const item of response.data.output) {
    const parsedItem = openAiOutputItemSchema.safeParse(item)
    if (!parsedItem.success) continue
    for (const content of parsedItem.data.content) {
      const parsedContent = openAiOutputTextSchema.safeParse(content)
      if (parsedContent.success) return parsedContent.data.text
    }
  }
  return null
}

const extractionInstructions = [
  'Analyze exactly one Job Posting and ignore navigation, employer branding, benefits marketing, equal-opportunity boilerplate, and legal boilerplate.',
  'Extract targetRole only when an unambiguous role title is explicit; copy its value and sourceExcerpt exactly.',
  'Extract only explicit professional qualifications, responsibilities, or expectations as atomic requirements.',
  'Copy every requirement value and sourceExcerpt exactly from the Job Posting.',
  'Assign one role-neutral capability dimension and a concise capability name.',
  'Classify importance as critical only for explicit mandatory or decisive wording, central for core responsibilities, and complementary for preferences.',
  'Explain the importance classification from wording in the exact source excerpt.',
  'Give semantic duplicates or explicit alternatives the same substitutableGroup; otherwise return null.',
  'Extract location, remote policy, work authorization, availability, and compensation only as practicalConstraints.',
  'Never infer hidden criteria, requirements, constraints, or a role title.',
].join(' ')

const openAiResponseSchema = z.object({ output: z.array(z.unknown()) })
const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })
const unavailableResult = { ok: false, error: 'job-posting-extraction-unavailable' } as const
