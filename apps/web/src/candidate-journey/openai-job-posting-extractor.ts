import { z } from 'zod'

import type {
  ExtractedJobPosting,
  JobPostingExtractor,
} from '@resume-tailoring/application/job-match'
import type { OpenAiReasoningEffort } from '../openai-model-configuration'
import {
  createOpenAiRequester,
  type OpenAiRequestFailure,
} from '../resume-tailoring/openai-request'
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
  return { extract: async ({ jobPostingContent }) => {
    const result = await requestOpenAiJobPostingExtraction({
      apiKey, jobPostingContent, model, reasoningEffort, request,
    })
    return result.ok ? result : unavailableResult
  } }
}

export type OpenAiJobPostingExtractionFailure = Readonly<{
  type: 'invalid-model-output'
}> | OpenAiRequestFailure

export async function requestOpenAiJobPostingExtraction({
  apiKey, jobPostingContent, model, reasoningEffort, request = fetch,
}: Readonly<{
  apiKey: string
  jobPostingContent: string
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request?: typeof fetch
}>): Promise<Readonly<{ ok: true; value: ExtractedJobPosting }> | Readonly<{
  ok: false
  error: OpenAiJobPostingExtractionFailure
}>> {
  const requester = createOpenAiRequester({ apiKey, request })
  const response = await requester.send({
    body: createRequestBody({ jobPostingContent, model, reasoningEffort }),
    operation: 'explainable-job-posting-extraction',
  })
  if (!response.ok) return response
  return parseResponse({ value: response.value })
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
  if (outputText === null) return invalidModelOutputResult
  try {
    const parsed = jobPostingExtractionSchema.safeParse(JSON.parse(outputText))
    return parsed.success ? createSuccessResult({ extraction: parsed.data }) : invalidModelOutputResult
  } catch {
    return invalidModelOutputResult
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
  'Extract only explicit professional qualifications, responsibilities, or expectations, as one requirement per assessable capability.',
  'Generic duties listed together, such as defining features, ensuring quality, and collaborating with product managers, form one requirement; do not split them into one requirement per phrase.',
  'Keep distinct technical capabilities, such as separate technologies, languages, or certifications, as separate requirements, even when listed in one sentence.',
  'Copy every requirement value and sourceExcerpt exactly from the Job Posting; each sourceExcerpt is the exact passage stating that capability.',
  'Assign one role-neutral capability dimension and a concise capability name.',
  'Classify importance as critical only for explicit mandatory or decisive wording.',
  'Reserve central for responsibilities the Job Posting emphasizes, such as its core mission, its main responsibilities, or capabilities it repeats or highlights.',
  'Classify everything else as complementary: preferences, and generic or secondary duties the Job Posting merely lists.',
  'Explain the importance classification from wording in the exact source excerpt.',
  'Give semantic duplicates or explicit alternatives the same substitutableGroup; otherwise return null.',
  'Extract location, remote policy, work authorization, availability, and compensation only as practicalConstraints.',
  'Never infer hidden criteria, requirements, constraints, or a role title.',
].join(' ')

const openAiResponseSchema = z.object({ output: z.array(z.unknown()) })
const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })
const unavailableResult = { ok: false, error: 'job-posting-extraction-unavailable' } as const
const invalidModelOutputResult = { ok: false, error: { type: 'invalid-model-output' } } as const
