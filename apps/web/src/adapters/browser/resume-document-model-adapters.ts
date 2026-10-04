import type { LanguageModelFailure, ResumeClaimModelFailure, ResumeDocumentPorts } from '@resume-tailoring/application/ports'
import type { OpenAiLanguageModelGateway } from './openai-language-model-gateway'

/** Translates the resume claim model ports onto the Language Model Gateway; the application owns every rule. */
export function createResumeDocumentModelAdapters({ gateway }: Readonly<{ gateway: OpenAiLanguageModelGateway }>):
Pick<ResumeDocumentPorts, 'validateClaim' | 'condenseClaim'> {
  return {
    validateClaim: async (input) => {
      const result = await gateway.structured.process({ operation: 'resume-claim-validation', input })
      if (!result.ok) return { ok: false, error: readFailure({ error: result.error }) }
      if (result.value.operation !== 'resume-claim-validation') return unavailable
      return { ok: true, value: { supported: result.value.value.supported } }
    },
    condenseClaim: async ({ claim, locale, verifiedFacts }) => {
      const result = await gateway.writing.process({ operation: 'resume-claim-reformulation', input: {
        claim, locale, verifiedFacts, feedback: [], requirements: [], evidence: [], request: condensationRequest,
      } })
      if (!result.ok) return { ok: false, error: readFailure({ error: result.error }) }
      if (result.value.operation !== 'resume-claim-reformulation') return unavailable
      return { ok: true, value: result.value.value }
    },
  }
}

function readFailure({ error }: Readonly<{ error: LanguageModelFailure }>): ResumeClaimModelFailure {
  return error.type === 'processing-consent-required' ? 'processing-consent-required' : 'unavailable'
}

const unavailable = { ok: false, error: 'unavailable' } as const
const condensationRequest = 'Shorten this resume wording to help fit two pages. Preserve every factual detail and every fact reference; do not remove evidence or strengthen meaning. Keep unchanged if faithful shortening is impossible.'
