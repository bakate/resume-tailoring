import type {
  MatchEvidenceMatcher,
  MatchInputs,
  ProposedMatchAnalysis,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { requirementCoverages } from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { z } from 'zod'

import {
  extractedMatchEvidenceSchema,
  hasOnlyMatchInputReferences,
  sourceProfileFactMaximumCount,
} from './match-analysis-schemas'
import { createOpenAiRequester, createOpenAiRequestDeadline } from './openai-request'
import { evidenceExcerptLength, requirementCoverageInstructions } from './requirement-coverage-instructions'

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
  const requester = createOpenAiRequester({ apiKey, request })
  return {
    match: (matchRequest) => requestMatchEvidence({
      matchRequest, model, reasoningEffort, requester,
    }),
  }
}

async function requestMatchEvidence({
  matchRequest,
  model,
  reasoningEffort,
  requester,
}: Readonly<{
  matchRequest: MatchRequest
  model: string
  reasoningEffort: OpenAiMatcherDependencies['reasoningEffort']
  requester: ReturnType<typeof createOpenAiRequester>
}>) {
  const analyses = []
  const deadlineSignal = createOpenAiRequestDeadline()
  for (const batchRequest of createMatchRequestBatches({ matchRequest })) {
    const result = await requestMatchEvidenceBatch({
      deadlineSignal, matchRequest: batchRequest, model, reasoningEffort, requester,
    })
    if (!result.ok) return result
    analyses.push(result.value)
  }
  return combineMatchAnalyses({ analyses, matchRequest })
}

async function requestMatchEvidenceBatch({
  deadlineSignal,
  matchRequest,
  model,
  reasoningEffort,
  requester,
}: Readonly<{
  deadlineSignal: AbortSignal
  matchRequest: MatchRequest
  model: string
  reasoningEffort: OpenAiMatcherDependencies['reasoningEffort']
  requester: ReturnType<typeof createOpenAiRequester>
}>) {
  const response = await requester.send({
    body: createRequestBody({ matchRequest, model, reasoningEffort }),
    deadlineSignal,
    operation: 'match-analysis',
  })
  return response.ok
    ? parseOpenAiResponse({ matchRequest, value: response.value })
    : matchAnalysisUnavailableResult
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
  const improvementOpportunities = [...new Set(analyses.flatMap((analysis) =>
    analysis.improvementOpportunities))].slice(0, 3)
  return {
    ok: true,
    value: {
      evidence: analyses.flatMap((analysis) => analysis.evidence),
      improvementOpportunities,
      relevantFactIds: matchRequest.verifiedFacts
        .filter(({ id }) => relevantFactIds.has(id))
        .map(({ id }) => id),
    },
  } as const
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
  ...requirementCoverageInstructions,
  'Return relevantFactIds only for Candidate Facts relevant enough to support an honest Tailored Resume.',
  'Return no relevantFactIds when the declared material cannot support an honest Tailored Resume.',
  'Return at most three concise improvementOpportunities for useful keywords or conventions that are not explicit requirements; these observations never affect evidence.',
  'Never invent identifiers, qualifications, facts, or partial credit.',
].join(' ')

const excerptJsonSchema = {
  type: 'string', minLength: evidenceExcerptLength.minimum, maxLength: evidenceExcerptLength.maximum,
} as const

export const matchEvidenceResponseFormat = {
  type: 'json_schema',
  name: 'match_evidence',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['evidence', 'improvementOpportunities', 'relevantFactIds'],
    properties: {
      evidence: {
        type: 'array',
        maxItems: matchRequirementBatchSize,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['coverage', 'requirementId', 'factMatches'],
          properties: {
            coverage: {
              type: 'string',
              enum: requirementCoverages,
            },
            requirementId: { type: 'string', pattern: '^job-requirement-.+$' },
            factMatches: {
              type: 'array',
              minItems: 1,
              maxItems: sourceProfileFactMaximumCount,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['factExcerpt', 'factId', 'requirementExcerpt'],
                properties: {
                  factExcerpt: excerptJsonSchema,
                  factId: { type: 'string', pattern: '^source-fact-.+$' },
                  requirementExcerpt: excerptJsonSchema,
                },
              },
            },
          },
        },
      },
      improvementOpportunities: {
        type: 'array',
        maxItems: 3,
        items: { type: 'string', minLength: 1, maxLength: 300 },
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
