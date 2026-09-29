import { z } from 'zod'

import type { MatchEvidenceMatcher } from '@resume-tailoring/application/job-match'
import { validateRelevantFactProposals } from '@resume-tailoring/matching-engine'
import type { OpenAiReasoningEffort } from '../openai-model-configuration'
import {
  createOpenAiRequester,
  type OpenAiRequestFailure,
} from '../resume-tailoring/openai-request'
import {
  matchEvidenceProposalSchema,
  matchEvidenceResponseFormat,
} from './job-match-schemas'

export function createOpenAiJobMatchEvidenceMatcher({
  apiKey, model, reasoningEffort, request = fetch,
}: Readonly<{
  apiKey: string
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request?: typeof fetch
}>): MatchEvidenceMatcher {
  return { match: async (matchRequest) => {
    const result = await requestOpenAiJobMatchEvidence({
      apiKey, matchRequest, model, reasoningEffort, request,
    })
    return result.ok ? result : unavailableResult
  } }
}

export type OpenAiMatchEvidenceFailure = Readonly<{
  type: 'invalid-model-output' | 'request-too-large'
  characterCount?: number
  maximumCharacterCount?: number
}> | OpenAiRequestFailure

type InvalidModelOutputCause =
  | 'invalid-json'
  | 'invalid-response-shape'
  | 'invalid-schema'
  | 'missing-output-text'
  | 'invalid-relevance'
  | 'unknown-reference'

export async function requestOpenAiJobMatchEvidence({
  apiKey, matchRequest, model, reasoningEffort, request = fetch,
}: Readonly<{
  apiKey: string
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request?: typeof fetch
}>): Promise<Readonly<{ ok: true; value: z.infer<typeof matchEvidenceProposalSchema> }> | Readonly<{
  ok: false
  error: OpenAiMatchEvidenceFailure
}>> {
  const requestCharacterCount = JSON.stringify(matchRequest).length
  if (requestCharacterCount > maximumMatchEvidenceRequestCharacters) {
    console.info(JSON.stringify({
      category: 'privacy-safe-openai-request',
      metric: 'rejected',
      value: 1,
      dimensions: {
        cause: 'request-too-large',
        maximumRequestCharacters: maximumMatchEvidenceRequestCharacters,
        operation: 'explainable-match-evidence',
        requestCharacters: requestCharacterCount,
      },
    }))
    return { ok: false, error: {
      characterCount: requestCharacterCount,
      maximumCharacterCount: maximumMatchEvidenceRequestCharacters,
      type: 'request-too-large',
    } }
  }
  const requester = createOpenAiRequester({ apiKey, request })
  const response = await requester.send({
    body: createRequestBody({ matchRequest, model, reasoningEffort }),
    operation: 'explainable-match-evidence',
  })
  if (!response.ok) return response
  return parseResponse({ matchRequest, value: response.value })
}

function createRequestBody({ matchRequest, model, reasoningEffort }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  model: string
  reasoningEffort: OpenAiReasoningEffort
}>) {
  return {
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: matchingInstructions }] },
      { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(matchRequest) }] },
    ],
    max_output_tokens: 8_000,
    model,
    reasoning: { effort: reasoningEffort },
    store: false,
    text: { format: matchEvidenceResponseFormat },
  }
}

function parseResponse({ matchRequest, value }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  value: unknown
}>) {
  const outputTextResult = readOutputText({ value })
  if (!outputTextResult.ok) return createInvalidModelOutputResult({ cause: outputTextResult.error })
  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(outputTextResult.value) as unknown
  } catch {
    return createInvalidModelOutputResult({ cause: 'invalid-json' })
  }
  const proposal = matchEvidenceProposalSchema.safeParse(parsedValue)
  if (!proposal.success) return createInvalidModelOutputResult({ cause: 'invalid-schema' })
  if (!hasKnownReferences({ matchRequest, proposal: proposal.data })) {
    return createInvalidModelOutputResult({ cause: 'unknown-reference' })
  }
  if (!hasValidRelevantFacts({ matchRequest, proposal: proposal.data })) {
    return createInvalidModelOutputResult({ cause: 'invalid-relevance' })
  }
  return { ok: true, value: proposal.data } as const
}

function createInvalidModelOutputResult({ cause }: Readonly<{ cause: InvalidModelOutputCause }>) {
  console.info(JSON.stringify({
    category: 'privacy-safe-openai-request',
    metric: 'rejected',
    value: 1,
    dimensions: { cause, operation: 'explainable-match-evidence' },
  }))
  return invalidModelOutputResult
}

function hasKnownReferences({ matchRequest, proposal }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  proposal: z.infer<typeof matchEvidenceProposalSchema>
}>) {
  const factIds = new Set(matchRequest.candidateFacts.map(({ id }) => id))
  const requirementIds = new Set(matchRequest.requirements.map(({ id }) => id))
  const relevantFactIds = new Set(proposal.relevance.map(({ factMatch }) => factMatch.factId))
  return proposal.relevance.every(({ factMatch, requirementId }) =>
    factIds.has(factMatch.factId) && requirementIds.has(requirementId))
    && proposal.evidence.every((evidence) => requirementIds.has(evidence.requirementId)
      && evidence.factMatches.every(({ factId }) => relevantFactIds.has(factId)))
}

function hasValidRelevantFacts({ matchRequest, proposal }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  proposal: z.infer<typeof matchEvidenceProposalSchema>
}>) {
  return validateRelevantFactProposals({
    candidateFacts: matchRequest.candidateFacts,
    proposals: proposal.relevance,
    requirements: matchRequest.requirements,
  }) !== null
}

function readOutputText({ value }: Readonly<{ value: unknown }>) {
  const response = openAiResponseSchema.safeParse(value)
  if (!response.success) return { ok: false, error: 'invalid-response-shape' } as const
  if (typeof response.data.output_text === 'string') {
    return { ok: true, value: response.data.output_text } as const
  }
  for (const item of response.data.output) {
    const parsedItem = openAiOutputItemSchema.safeParse(item)
    if (!parsedItem.success) continue
    for (const content of parsedItem.data.content) {
      const parsedContent = openAiOutputTextSchema.safeParse(content)
      if (parsedContent.success) return { ok: true, value: parsedContent.data.text } as const
    }
  }
  return { ok: false, error: 'missing-output-text' } as const
}

const matchingInstructions = [
  'Propose evidence only when Candidate Facts explicitly support the same concrete capability as a Job Requirement.',
  'Use covered only when the complete scope, duration, level, scale, and qualitative constraints are supported.',
  'Use partially-covered only for the same capability at incomplete scope; reject adjacent or transferable capabilities.',
  'Quote the shortest exact contiguous factTerm and requirementTerm that identify the same capability.',
  'Use exact for identical normalized terms and controlled only for genuine synonyms or translations.',
  'Return relevance links only for facts relevant enough to support an honest Tailored Resume.',
  'Every relevance link must quote equivalent contiguous fact and requirement terms.',
  'Never calculate a score, importance, Match Band, or Generation Eligibility.',
  'Never invent identifiers, facts, requirements, or evidence.',
].join(' ')

const openAiResponseSchema = z.object({
  output: z.array(z.unknown()).default([]),
  output_text: z.string().optional(),
})
const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })
const unavailableResult = { ok: false, error: 'match-evidence-unavailable' } as const
const invalidModelOutputResult = { ok: false, error: { type: 'invalid-model-output' } } as const
const maximumMatchEvidenceRequestCharacters = 60_000
