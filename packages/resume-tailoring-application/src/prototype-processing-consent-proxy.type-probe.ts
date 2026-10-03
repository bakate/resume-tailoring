/** PROTOTYPE type probe: does `ConsentRefusals` accept the real ports' refusals and reject wrong ones? */
import type { ConsentRefusals } from './prototype-processing-consent-proxy'
import type { JobPostingExtractor, MatchEvidenceMatcher, ResumeSectionModels, StructuredSourceProfileExtractor } from './ports'

export type ModelBackedPorts = Readonly<{
  sourceProfileExtractor: StructuredSourceProfileExtractor
  jobPostingExtractor: JobPostingExtractor
  matchEvidenceMatcher: MatchEvidenceMatcher
  resumeSectionModels: ResumeSectionModels
}>

const sectionModelRefusal = { ok: false, error: { type: 'consent-required' } } as const

export const modelBackedPortRefusals = {
  sourceProfileExtractor: { extract: { ok: false, error: 'processing-consent-required' } },
  jobPostingExtractor: { extract: { ok: false, error: 'job-posting-extraction-unavailable' } },
  matchEvidenceMatcher: { match: { ok: false, error: 'match-evidence-unavailable' } },
  resumeSectionModels: { writeSection: sectionModelRefusal, validateFields: sectionModelRefusal,
    checkCoherence: sectionModelRefusal },
} as const satisfies ConsentRefusals<ModelBackedPorts>

// A port without a refusal does not compile.
export const missingPort = {
  sourceProfileExtractor: modelBackedPortRefusals.sourceProfileExtractor,
  jobPostingExtractor: modelBackedPortRefusals.jobPostingExtractor,
  resumeSectionModels: modelBackedPortRefusals.resumeSectionModels,
// @ts-expect-error matchEvidenceMatcher is missing
} satisfies ConsentRefusals<ModelBackedPorts>

// A refusal outside the port's own failure vocabulary does not compile.
export const foreignVocabulary = {
  ...modelBackedPortRefusals,
  // @ts-expect-error JobPostingExtractor has no 'processing-consent-required' failure
  jobPostingExtractor: { extract: { ok: false, error: 'processing-consent-required' } },
} satisfies ConsentRefusals<ModelBackedPorts>

// A method without a refusal does not compile.
export const missingMethod = {
  ...modelBackedPortRefusals,
  // @ts-expect-error checkCoherence is missing
  resumeSectionModels: { writeSection: sectionModelRefusal, validateFields: sectionModelRefusal },
} satisfies ConsentRefusals<ModelBackedPorts>
