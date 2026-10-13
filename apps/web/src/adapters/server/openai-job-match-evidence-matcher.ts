import type { z } from 'zod'

import type { LanguageModelConfiguration } from '../../language-model-configuration'
import {
  createModelRequester,
  type ModelConnection,
  type ModelRequestFailure,
} from './language-model-request'
import { requirementCoverageInstructions } from '../../resume-tailoring/requirement-coverage-instructions'
import {
  matchEvidenceProposalSchema,
  matchEvidenceResponseFormat,
} from '../../candidate-journey/job-match-schemas'
import type { MatchEvidenceMatcher } from '@resume-tailoring/application/ports'
import { delimitSuppliedData, untrustedContentInstruction } from './untrusted-model-input'

export function createOpenAiJobMatchEvidenceMatcher(connection: ModelConnection): MatchEvidenceMatcher {
  return { match: async (matchRequest) => {
    const result = await requestOpenAiJobMatchEvidence({ ...connection, matchRequest })
    return result.ok ? result : unavailableResult
  } }
}

export type OpenAiMatchEvidenceFailure = Readonly<{
  type: 'invalid-model-output' | 'request-too-large'
  characterCount?: number
  maximumCharacterCount?: number
}> | ModelRequestFailure

type InvalidModelOutputCause =
  | 'invalid-json'
  | 'invalid-schema'
  | 'missing-output-text'

export async function requestOpenAiJobMatchEvidence({ matchRequest, ...connection }: ModelConnection & Readonly<{
  matchRequest: Parameters<MatchEvidenceMatcher['match']>[0]
}>): Promise<Readonly<{ ok: true; value: z.infer<typeof matchEvidenceProposalSchema> }> | Readonly<{
  ok: false
  error: OpenAiMatchEvidenceFailure
}>> {
  const requestCharacterCount = JSON.stringify(matchRequest).length
  if (requestCharacterCount > maximumMatchEvidenceRequestCharacters) {
    console.info(JSON.stringify({
      category: 'privacy-safe-model-request',
      metric: 'rejected',
      value: 1,
      dimensions: {
        cause: 'request-too-large',
        maximumRequestCharacters: maximumMatchEvidenceRequestCharacters,
        operation: 'explainable-match-evidence',
        provider: connection.configuration.provider,
        requestCharacters: requestCharacterCount,
      },
    }))
    return { ok: false, error: {
      characterCount: requestCharacterCount,
      maximumCharacterCount: maximumMatchEvidenceRequestCharacters,
      type: 'request-too-large',
    } }
  }
  const requester = createModelRequester(connection)
  const response = await requester.send({
    instructions: matchingInstructions,
    maxOutputTokens: 8_000,
    operation: 'explainable-match-evidence',
    output: matchEvidenceResponseFormat,
    userText: delimitSuppliedData(matchRequest),
  })
  if (!response.ok) return response
  return parseModelOutput({ outputText: response.value.text, provider: connection.configuration.provider })
}

function parseModelOutput({ outputText, provider }: Readonly<{
  outputText?: string
  provider: LanguageModelConfiguration['provider']
}>) {
  if (outputText === undefined) return createInvalidModelOutputResult({ cause: 'missing-output-text', provider })
  let parsedValue: unknown
  try {
    parsedValue = JSON.parse(outputText) as unknown
  } catch {
    return createInvalidModelOutputResult({ cause: 'invalid-json', provider })
  }
  const proposal = matchEvidenceProposalSchema.safeParse(parsedValue)
  if (!proposal.success) return createInvalidModelOutputResult({ cause: 'invalid-schema', provider })
  return acceptProposal({ proposal: proposal.data, provider })
}

function createInvalidModelOutputResult({ cause, provider }: Readonly<{
  cause: InvalidModelOutputCause
  provider: LanguageModelConfiguration['provider']
}>) {
  console.info(JSON.stringify({
    category: 'privacy-safe-model-request',
    metric: 'rejected',
    value: 1,
    dimensions: { cause, operation: 'explainable-match-evidence', provider },
  }))
  return invalidModelOutputResult
}

// The matching engine verifies each proposal structurally and keeps or discards it on its own.
function acceptProposal({ proposal, provider }: Readonly<{
  proposal: z.infer<typeof matchEvidenceProposalSchema>
  provider: LanguageModelConfiguration['provider']
}>) {
  console.info(JSON.stringify({
    category: 'privacy-safe-model-request',
    metric: 'accepted',
    value: 1,
    dimensions: { operation: 'explainable-match-evidence', provider,
      proposedRelevance: proposal.relevance.length, proposedEvidence: proposal.evidence.length,
      proposedAdjacentEvidence: proposal.adjacentEvidence.length },
  }))
  return { ok: true, value: proposal } as const
}

const matchingInstructions = [
  untrustedContentInstruction,
  ...requirementCoverageInstructions,
  'List a related but distinct capability in adjacentEvidence instead, with the requirementId and, for each Candidate Fact, a short contiguous factExcerpt copied verbatim from that fact. Adjacent Evidence never counts as coverage; omit it for covered or partially covered requirements.',
  'Return relevance links for Candidate Facts relevant enough to support an honest Tailored Resume, with the same verbatim excerpts.',
  'Never calculate a score, importance, Match Band, or Generation Eligibility.',
  'Never invent identifiers, facts, requirements, or evidence.',
].join(' ')

const unavailableResult = { ok: false, error: 'match-evidence-unavailable' } as const
const invalidModelOutputResult = { ok: false, error: { type: 'invalid-model-output' } } as const
const maximumMatchEvidenceRequestCharacters = 60_000
