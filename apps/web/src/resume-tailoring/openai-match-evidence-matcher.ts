import type {
  JobRequirement,
  MatchEvidenceMatcher,
  SourceProfileFact,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { jobRequirementMaximumCount } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import {
  extractedMatchEvidenceSchema,
  hasOnlyMatchInputReferences,
  sourceProfileFactMaximumCount,
} from './match-analysis-schemas'

type OpenAiMatcherDependencies = Readonly<{
  apiKey: string
  model: string
  request?: typeof fetch
}>

type MatchRequest = Readonly<{
  requirements: readonly JobRequirement[]
  verifiedFacts: readonly SourceProfileFact[]
}>

export function createOpenAiMatchEvidenceMatcher({
  apiKey,
  model,
  request = fetch,
}: OpenAiMatcherDependencies): MatchEvidenceMatcher {
  return {
    match: (matchRequest) => requestMatchEvidence({ apiKey, matchRequest, model, request }),
  }
}

async function requestMatchEvidence({
  apiKey,
  matchRequest,
  model,
  request,
}: Readonly<{
  apiKey: string
  matchRequest: MatchRequest
  model: string
  request: typeof fetch
}>) {
  try {
    const response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: createHeaders({ apiKey }),
      body: JSON.stringify(createRequestBody({ matchRequest, model })),
      signal: AbortSignal.timeout(matchAnalysisTimeoutMilliseconds),
    })
    if (!response.ok) return matchAnalysisUnavailableResult
    return parseOpenAiResponse({ matchRequest, value: await response.json() })
  } catch {
    return matchAnalysisUnavailableResult
  }
}

function createHeaders({ apiKey }: Readonly<{ apiKey: string }>) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

function createRequestBody({
  matchRequest,
  model,
}: Readonly<{ matchRequest: MatchRequest; model: string }>) {
  return {
    model,
    store: false,
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: matchingInstructions }] },
      {
        role: 'user',
        content: [{ type: 'input_text', text: JSON.stringify(matchRequest) }],
      },
    ],
    text: { format: matchEvidenceResponseFormat },
  }
}

function parseOpenAiResponse({
  matchRequest,
  value,
}: Readonly<{ matchRequest: MatchRequest; value: unknown }>) {
  const response = openAiResponseSchema.safeParse(value)
  if (!response.success) return matchAnalysisUnavailableResult
  const outputText = readOutputText({ output: response.data.output })
  if (outputText === undefined) return matchAnalysisUnavailableResult
  try {
    return parseMatchEvidence({ matchRequest, value: JSON.parse(outputText) as unknown })
  } catch {
    return matchAnalysisUnavailableResult
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

function parseMatchEvidence({
  matchRequest,
  value,
}: Readonly<{ matchRequest: MatchRequest; value: unknown }>) {
  const result = extractedMatchEvidenceSchema.safeParse(value)
  if (!result.success) return matchAnalysisUnavailableResult
  if (!hasOnlyMatchInputReferences({ ...matchRequest, evidence: result.data.evidence })) {
    return matchAnalysisUnavailableResult
  }
  return { ok: true, value: result.data.evidence } as const
}

const matchingInstructions = [
  'Return evidence only when one or more Verified Facts explicitly prove a Job Requirement.',
  'Coverage is binary; omit every uncovered requirement.',
  'You may recognize controlled synonyms and translations with the same concrete meaning.',
  'Do not treat a role, a transferable skill, or qualitative seniority as implicit proof.',
  'Never invent identifiers, qualifications, facts, or partial credit.',
].join(' ')

const matchEvidenceResponseFormat = {
  type: 'json_schema',
  name: 'match_evidence',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['evidence'],
    properties: {
      evidence: {
        type: 'array',
        maxItems: jobRequirementMaximumCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['requirementId', 'factIds'],
          properties: {
            requirementId: { type: 'string', pattern: '^job-requirement-.+$' },
            factIds: {
              type: 'array',
              minItems: 1,
              maxItems: sourceProfileFactMaximumCount,
              items: { type: 'string', pattern: '^source-fact-.+$' },
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

const matchAnalysisUnavailableResult = {
  ok: false,
  error: { type: 'match-analysis-unavailable' },
} as const

const matchAnalysisTimeoutMilliseconds = 30_000
