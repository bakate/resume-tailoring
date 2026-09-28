import type {
  MatchEvidenceMatcher,
  MatchInputs,
  ProposedMatchAnalysis,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import {
  extractedMatchEvidenceSchema,
  hasOnlyMatchInputReferences,
  sourceProfileFactMaximumCount,
} from './match-analysis-schemas'

type OpenAiMatcherDependencies = Readonly<{
  apiKey: string
  model: string
  reasoningEffort: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
  request?: typeof fetch
}>

type MatchRequest = MatchInputs
const matchRequirementBatchSize = 25

export function createOpenAiMatchEvidenceMatcher({
  apiKey,
  model,
  reasoningEffort,
  request = fetch,
}: OpenAiMatcherDependencies): MatchEvidenceMatcher {
  return {
    match: (matchRequest) => requestMatchEvidence({
      apiKey, matchRequest, model, reasoningEffort, request,
    }),
  }
}

async function requestMatchEvidence({
  apiKey,
  matchRequest,
  model,
  reasoningEffort,
  request,
}: Readonly<{
  apiKey: string
  matchRequest: MatchRequest
  model: string
  reasoningEffort: OpenAiMatcherDependencies['reasoningEffort']
  request: typeof fetch
}>) {
  const analyses = []
  for (const batchRequest of createMatchRequestBatches({ matchRequest })) {
    const result = await requestMatchEvidenceBatch({
      apiKey, matchRequest: batchRequest, model, reasoningEffort, request,
    })
    if (!result.ok) return result
    analyses.push(result.value)
  }
  return combineMatchAnalyses({ analyses, matchRequest })
}

async function requestMatchEvidenceBatch({
  apiKey,
  matchRequest,
  model,
  reasoningEffort,
  request,
}: Readonly<{
  apiKey: string
  matchRequest: MatchRequest
  model: string
  reasoningEffort: OpenAiMatcherDependencies['reasoningEffort']
  request: typeof fetch
}>) {
  try {
    const response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: createHeaders({ apiKey }),
      body: JSON.stringify(createRequestBody({ matchRequest, model, reasoningEffort })),
      signal: AbortSignal.timeout(matchAnalysisTimeoutMilliseconds),
    })
    if (!response.ok) return matchAnalysisUnavailableResult
    return parseOpenAiResponse({ matchRequest, value: await response.json() })
  } catch {
    return matchAnalysisUnavailableResult
  }
}

function createMatchRequestBatches({ matchRequest }: Readonly<{ matchRequest: MatchRequest }>) {
  const batches: MatchRequest[] = []
  for (let requirementIndex = 0;
    requirementIndex < matchRequest.requirements.length;
    requirementIndex += matchRequirementBatchSize) {
    batches.push({
      requirements: matchRequest.requirements.slice(
        requirementIndex, requirementIndex + matchRequirementBatchSize,
      ),
      verifiedFacts: matchRequest.verifiedFacts,
    })
  }
  return batches
}

function combineMatchAnalyses({ analyses, matchRequest }: Readonly<{
  analyses: readonly ProposedMatchAnalysis[]
  matchRequest: MatchRequest
}>) {
  const relevantFactIds = new Set(analyses.flatMap((analysis) => analysis.relevantFactIds))
  return {
    ok: true,
    value: {
      evidence: analyses.flatMap((analysis) => analysis.evidence),
      relevantFactIds: matchRequest.verifiedFacts
        .filter(({ id }) => relevantFactIds.has(id))
        .map(({ id }) => id),
    },
  } as const
}

function createHeaders({ apiKey }: Readonly<{ apiKey: string }>) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
}

function createRequestBody({
  matchRequest,
  model,
  reasoningEffort,
}: Readonly<{
  matchRequest: MatchRequest
  model: string
  reasoningEffort: OpenAiMatcherDependencies['reasoningEffort']
}>) {
  return {
    model,
    max_output_tokens: maximumOutputTokens,
    reasoning: { effort: reasoningEffort },
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

const maximumOutputTokens = 12_000

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
  if (!hasOnlyMatchInputReferences({ ...matchRequest, analysis: result.data })) {
    return matchAnalysisUnavailableResult
  }
  return { ok: true, value: result.data } as const
}

const matchingInstructions = [
  'Return evidence only when one or more Verified Facts explicitly prove a Job Requirement.',
  'Coverage is binary; omit every uncovered requirement.',
  'You may recognize controlled synonyms and translations with the same concrete meaning.',
  'For each fact link, quote the shortest exact contiguous requirementTerm and factTerm that name the same skill or concept; never quote a full sentence when a shorter term exists.',
  'Use exact only when the normalized quoted terms are identical; otherwise use controlled.',
  'Do not calculate or combine employment date ranges to prove a duration; omit duration coverage unless one Verified Fact explicitly states enough duration.',
  'Return relevantFactIds only for Verified Facts relevant enough to support an honest Tailored Resume.',
  'Return no relevantFactIds when the verified material cannot support an honest Tailored Resume.',
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
    required: ['evidence', 'relevantFactIds'],
    properties: {
      evidence: {
        type: 'array',
        maxItems: matchRequirementBatchSize,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['requirementId', 'factMatches'],
          properties: {
            requirementId: { type: 'string', pattern: '^job-requirement-.+$' },
            factMatches: {
              type: 'array',
              minItems: 1,
              maxItems: sourceProfileFactMaximumCount,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['factId', 'factTerm', 'relationship', 'requirementTerm'],
                properties: {
                  factId: { type: 'string', pattern: '^source-fact-.+$' },
                  factTerm: { type: 'string', minLength: 2, maxLength: 100 },
                  relationship: { type: 'string', enum: ['exact', 'controlled'] },
                  requirementTerm: { type: 'string', minLength: 2, maxLength: 100 },
                },
              },
            },
          },
        },
      },
      relevantFactIds: {
        type: 'array',
        maxItems: sourceProfileFactMaximumCount,
        items: { type: 'string', pattern: '^source-fact-.+$' },
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
