import { prepareResumeSections } from '@resume-tailoring/application/resume-preparation'

import { crossSegmentQualificationCorpus } from './cross-segment-corpus'
import { countDocumentLanguageChecks } from './document-language'
import { readLiveJobMatch } from './live-candidate-journey'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'
import { createSectionModels } from './section-preparation-evaluation'
import { readPreparationFailureValues } from './section-preparation-qualification'
import { countUnsupportedResumeClaims } from './unsupported-resume-claims'

/**
 * French writing across segments: each held-out French scenario of the cross-segment corpus with relevant evidence is
 * matched live and prepared in French. The document must be prepared, every prose field written in French, with no
 * unsupported Resume Claim against the scenario's Candidate Facts. Candidates are French-speaking, so the writing
 * role's multilingual fidelity is measured on French output.
 */
export const crossSegmentWritingSource: ModelObservationSource = {
  id: 'cross-segment-writing',
  roles: ['writing'],
  observe: async ({ connect }) => {
    const structured = connect('structured')
    const models = createSectionModels({ structured, writing: connect('writing') })
    const observations = []
    for (const fixture of frenchScenarios) {
      const candidateFacts = toAttestedFacts(fixture.candidateFacts)
      const jobMatch = await readLiveJobMatch({ candidateFacts, jobPosting: fixture.jobPosting, structured })
      const output = await prepareResumeSections({ models, now: Date.now, recordTelemetry: () => undefined,
        request: { candidateFacts, jobMatch, locale: 'fr', purpose: 'tailored' }, revision: `cross-segment:${fixture.id}` })
      const document = output.status === 'prepared' ? output.document : null
      // A scenario that yields no document has failed French writing too.
      const language = countDocumentLanguageChecks({ document, locale: 'fr' })
      observations.push(createModelEvaluationObservation({ fixtureId: fixture.id,
        extractionExpectedCount: 1, extractionMatchedCount: Number(document !== null),
        multilingualCheckCount: language.checkCount, multilingualPassedCount: language.passedCount,
        observedValues: [`outcome:${output.status}`, `role-family:${fixture.roleFamily}`,
          ...readPreparationFailureValues({ output }),
          ...language.failed.map((name) => `failed:${name}`)],
        unsupportedResumeClaimCount: document === null ? 0 : countUnsupportedResumeClaims({ candidateFacts, document }) }))
    }
    return observations
  },
}

const frenchScenarios = crossSegmentQualificationCorpus.fixtures.filter(({ language, relevantFactIds, split }) =>
  split === 'held-out' && language === 'fr' && relevantFactIds.length > 0)

/** Scenario facts as a Source Intake attests them, each at the Source Profile path its kind is read from. */
function toAttestedFacts(facts: typeof frenchScenarios[number]['candidateFacts']) {
  return facts.map(({ id, kind, value }, factIndex) => ({
    id: id.startsWith('source-fact-') ? id as `source-fact-${string}` : `source-fact-${id}` as const,
    path: `${sourceProfilePaths[kind]}.${String(factIndex)}`, status: 'attested' as const, value,
  }))
}

const sourceProfilePaths = {
  certification: 'certifications.0.name', education: 'education.0.qualification', experience: 'experiences.0.achievements',
  language: 'languages.0.name', project: 'projects.0.description', skill: 'skills.0.name',
} as const
