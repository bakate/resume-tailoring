import type { z } from 'zod'

import type {
  ExtractedJobPosting,
} from '@resume-tailoring/application/job-match'
import {
  createModelRequester,
  type ModelConnection,
  type ModelRequestFailure,
} from './language-model-request'
import {
  jobPostingExtractionResponseFormat,
  jobPostingExtractionSchema,
} from '../../candidate-journey/job-match-schemas'
import type { JobPostingExtractor } from '@resume-tailoring/application/ports'
import { delimitUntrustedContent, untrustedContentInstruction } from './untrusted-model-input'

export function createModelJobPostingExtractor(connection: ModelConnection): JobPostingExtractor {
  return { extract: async ({ jobPostingContent }) => {
    const result = await requestJobPostingExtraction({ ...connection, jobPostingContent })
    return result.ok ? result : unavailableResult
  } }
}

export type JobPostingExtractionFailure = Readonly<{
  type: 'invalid-model-output'
}> | ModelRequestFailure

export async function requestJobPostingExtraction({ jobPostingContent, ...connection }: ModelConnection & Readonly<{
  jobPostingContent: string
}>): Promise<Readonly<{ ok: true; value: ExtractedJobPosting }> | Readonly<{
  ok: false
  error: JobPostingExtractionFailure
}>> {
  const requester = createModelRequester(connection)
  const response = await requester.send({
    instructions: extractionInstructions,
    operation: 'explainable-job-posting-extraction',
    output: jobPostingExtractionResponseFormat,
    outputSchema: jobPostingExtractionSchema,
    userText: delimitUntrustedContent({ kind: 'job-posting', content: jobPostingContent }),
  })
  if (!response.ok) return response
  return parseModelOutput({ outputText: response.value.text })
}

function parseModelOutput({ outputText }: Readonly<{ outputText?: string }>) {
  if (outputText === undefined) return invalidModelOutputResult
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

const extractionInstructions = [
  untrustedContentInstruction,
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

const unavailableResult = { ok: false, error: 'job-posting-extraction-unavailable' } as const
const invalidModelOutputResult = { ok: false, error: { type: 'invalid-model-output' } } as const
