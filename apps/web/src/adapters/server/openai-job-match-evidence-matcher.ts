import { z } from 'zod'

import {
  validateAdjacentEvidence,
  validateMatchEvidence,
  validateRelevantFactProposals,
} from '@resume-tailoring/matching-engine'
import type { OpenAiReasoningEffort } from '../../openai-model-configuration'
import {
  createOpenAiRequester,
  type OpenAiRequestFailure,
} from './openai-request'
import { requirementCoverageInstructions } from '../../resume-tailoring/requirement-coverage-instructions'
import {
  matchEvidenceProposalSchema,
  matchEvidenceResponseFormat,
} from '../../candidate-journey/job-match-schemas'
import type { MatchEvidenceMatcher } from '@resume-tailoring/application/ports'

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

function createRequestBody({ matchRequest, model, reasoningEffort, repairInstruction }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  model: string
  reasoningEffort: OpenAiReasoningEffort
  repairInstruction?: string
}>) {
  return {
    input: [
      { role: 'developer', content: [{ type: 'input_text', text: matchingInstructions }] },
      { role: 'user', content: [{ type: 'input_text', text: JSON.stringify(matchRequest) }] },
      ...(repairInstruction === undefined ? [] : [
        { role: 'user', content: [{ type: 'input_text', text: repairInstruction }] },
      ]),
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
  return sanitizeProposal({ matchRequest, proposal: proposal.data })
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

// Each proposal is verified structurally and kept or discarded on its own (ADR-0015).
function sanitizeProposal({ matchRequest, proposal }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  proposal: z.infer<typeof matchEvidenceProposalSchema>
}>) {
  const relevance = filterValidRelevance({ matchRequest, proposal })
  const evidence = filterValidEvidence({ matchRequest, proposal })
  const adjacentEvidence = filterValidAdjacentEvidence({ matchRequest, proposal })
  const isComplete = relevance.length === proposal.relevance.length
    && evidence.length === proposal.evidence.length
    && adjacentEvidence.length === proposal.adjacentEvidence.length
  console.info(JSON.stringify({
    category: 'privacy-safe-openai-request',
    metric: isComplete ? 'accepted' : 'sanitized',
    value: 1,
    dimensions: { operation: 'explainable-match-evidence',
      proposedRelevance: proposal.relevance.length, keptRelevance: relevance.length,
      proposedEvidence: proposal.evidence.length, keptEvidence: evidence.length,
      proposedAdjacentEvidence: proposal.adjacentEvidence.length,
      keptAdjacentEvidence: adjacentEvidence.length },
  }))
  return { ok: true, value: { adjacentEvidence, evidence, relevance } } as const
}

function filterValidRelevance({ matchRequest, proposal }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  proposal: z.infer<typeof matchEvidenceProposalSchema>
}>) {
  const references = new Set<string>()
  return proposal.relevance.filter((relevance) => {
    const reference = `${relevance.requirementId}:${relevance.factMatch.factId}`
    if (references.has(reference) || validateRelevantFactProposals({
      candidateFacts: matchRequest.candidateFacts,
      proposals: [relevance],
      requirements: matchRequest.requirements,
    }).length === 0) return false
    references.add(reference)
    return true
  })
}

function filterValidEvidence({ matchRequest, proposal }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  proposal: z.infer<typeof matchEvidenceProposalSchema>
}>) {
  const requirementIds = new Set<string>()
  return proposal.evidence.filter((evidence) => {
    if (requirementIds.has(evidence.requirementId) || validateMatchEvidence({
      candidateFacts: matchRequest.candidateFacts,
      proposedEvidence: [evidence],
      requirements: matchRequest.requirements,
    }).length === 0) return false
    requirementIds.add(evidence.requirementId)
    return true
  })
}

function filterValidAdjacentEvidence({ matchRequest, proposal }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  proposal: z.infer<typeof matchEvidenceProposalSchema>
}>) {
  const requirementIds = new Set<string>()
  return proposal.adjacentEvidence.filter((adjacentEvidence) => {
    if (requirementIds.has(adjacentEvidence.requirementId) || validateAdjacentEvidence({
      candidateFacts: matchRequest.candidateFacts,
      proposedAdjacentEvidence: [adjacentEvidence],
      requirements: matchRequest.requirements,
    }).length === 0) return false
    requirementIds.add(adjacentEvidence.requirementId)
    return true
  })
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
  ...requirementCoverageInstructions,
  'List a related but distinct capability in adjacentEvidence instead, with the requirementId and, for each Candidate Fact, a short contiguous factExcerpt copied verbatim from that fact. Adjacent Evidence never counts as coverage; omit it for covered or partially covered requirements.',
  'Return relevance links for Candidate Facts relevant enough to support an honest Tailored Resume, with the same verbatim excerpts.',
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
