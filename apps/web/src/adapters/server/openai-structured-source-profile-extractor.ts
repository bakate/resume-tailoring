import type { LanguageModelConfiguration } from '../../language-model-configuration'
import { createModelRequester } from './language-model-request'
import type { ModelApiKey } from './language-model-request'
import { readModelApiFailure } from './model-api-failure'
import {
  structuredSourceProfileExtractionSchema,
  structuredSourceProfileResponseFormat,
} from '../../candidate-journey/structured-source-profile-schema'
import type { StructuredSourceProfileExtractor } from '@resume-tailoring/application/ports'
import { delimitUntrustedContent, untrustedContentInstruction } from './untrusted-model-input'

export function createOpenAiStructuredSourceProfileExtractor({
  apiKey,
  configuration,
  request = fetch,
}: Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  request?: typeof fetch
}>): StructuredSourceProfileExtractor {
  return {
    extract: ({ professionalContent }) => requestExtraction({
      apiKey,
      configuration,
      professionalContent,
      request,
    }),
  }
}

async function requestExtraction({
  apiKey,
  configuration,
  professionalContent,
  request,
}: Readonly<{
  apiKey: ModelApiKey
  configuration: LanguageModelConfiguration
  professionalContent: string
  request: typeof fetch
}>) {
  const requester = createModelRequester({ apiKey, configuration, request })
  const response = await requester.send({
    instructions: extractionInstructions,
    maxOutputTokens: 16_000,
    operation: 'structured-source-profile-extraction',
    output: structuredSourceProfileResponseFormat,
    userText: delimitUntrustedContent({ kind: 'source-document', content: professionalContent }),
  })
  return response.ok ? parseModelOutput({ outputText: response.value.text })
    : { ...unavailableResult, apiFailure: readModelApiFailure(response.error) }
}

function parseModelOutput({ outputText }: Readonly<{ outputText?: string }>) {
  if (outputText === undefined) return unavailableResult
  try {
    const extraction = structuredSourceProfileExtractionSchema.safeParse(JSON.parse(outputText))
    return extraction.success ? { ok: true, value: extraction.data } as const : unavailableResult
  } catch {
    return unavailableResult
  }
}

const extractionInstructions = [
  untrustedContentInstruction,
  'Build an exhaustive structured Source Profile using only explicit Candidate evidence.',
  'Preserve experiences, projects, skills, education, languages, and certifications separately.',
  'Never infer dates, seniority, proficiency, organizations, qualifications, or outcomes.',
  'Use null when an optional value is absent.',
  'Copy the year or period of each education entry into its dates exactly as the source writes it, for example "2018" or "2016 – 2018", or null when the source gives none.',
  'Copy where an experience took place into its location exactly as the source writes it, for example "Paris, France" or "Remote", without shortening or completing it; never put it in context, which holds a team or a short description.',
  'Report a Critical Ambiguity only when a fact is unsafe to order, score, or reuse.',
  'Each ambiguity path must identify one scalar fact as section.entryIndex.field.valueIndex.',
  'Ask one concise targeted question for that fact; do not withhold unrelated evidence.',
].join(' ')

const unavailableResult = {
  ok: false,
  error: 'source-profile-extraction-unavailable',
} as const
