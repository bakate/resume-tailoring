import { z } from 'zod'

import type { MatchEvidenceMatcher } from '@resume-tailoring/application/job-match'
import type { OpenAiReasoningEffort } from '../openai-model-configuration'
import { createOpenAiRequester } from '../resume-tailoring/openai-request'
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
  return { match: (matchRequest) => requestEvidence({
    apiKey, matchRequest, model, reasoningEffort, request,
  }) }
}

async function requestEvidence({ apiKey, matchRequest, model, reasoningEffort, request }: Readonly<{
  apiKey: string
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  model: string
  reasoningEffort: OpenAiReasoningEffort
  request: typeof fetch
}>) {
  const requester = createOpenAiRequester({ apiKey, request })
  const response = await requester.send({
    body: createRequestBody({ matchRequest, model, reasoningEffort }),
    operation: 'explainable-match-evidence',
  })
  return response.ok
    ? parseResponse({ matchRequest, value: response.value })
    : unavailableResult
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
    max_output_tokens: 16_000,
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
  const outputText = readOutputText({ value })
  if (outputText === null) return unavailableResult
  try {
    const proposal = matchEvidenceProposalSchema.safeParse(JSON.parse(outputText))
    if (!proposal.success || !hasKnownReferences({ matchRequest, proposal: proposal.data })) {
      return unavailableResult
    }
    return { ok: true, value: proposal.data } as const
  } catch {
    return unavailableResult
  }
}

function hasKnownReferences({ matchRequest, proposal }: Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
  proposal: z.infer<typeof matchEvidenceProposalSchema>
}>) {
  const factIds = new Set(matchRequest.candidateFacts.map(({ id }) => id))
  const requirementIds = new Set(matchRequest.requirements.map(({ id }) => id))
  const relevantFactIds = new Set(proposal.relevantFactIds)
  return relevantFactIds.size === proposal.relevantFactIds.length
    && proposal.relevantFactIds.every((factId) => factIds.has(factId))
    && proposal.evidence.every((evidence) => requirementIds.has(evidence.requirementId)
      && evidence.factMatches.every(({ factId }) => relevantFactIds.has(factId)))
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

const matchingInstructions = [
  'Propose evidence only when Candidate Facts explicitly support the same concrete capability as a Job Requirement.',
  'Use covered only when the complete scope, duration, level, scale, and qualitative constraints are supported.',
  'Use partially-covered only for the same capability at incomplete scope; reject adjacent or transferable capabilities.',
  'Quote the shortest exact contiguous factTerm and requirementTerm that identify the same capability.',
  'Use exact for identical normalized terms and controlled only for genuine synonyms or translations.',
  'Return relevantFactIds only for facts relevant enough to support an honest Tailored Resume.',
  'Never calculate a score, importance, Match Band, or Generation Eligibility.',
  'Never invent identifiers, facts, requirements, or evidence.',
].join(' ')

const openAiResponseSchema = z.object({ output: z.array(z.unknown()) })
const openAiOutputItemSchema = z.object({ content: z.array(z.unknown()) })
const openAiOutputTextSchema = z.object({ type: z.literal('output_text'), text: z.string() })
const unavailableResult = { ok: false, error: 'match-evidence-unavailable' } as const
