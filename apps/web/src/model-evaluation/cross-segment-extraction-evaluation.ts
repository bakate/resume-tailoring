import { crossSegmentQualificationCorpus } from './cross-segment-corpus'
import { checkExcerptFidelity, extractJobPosting } from './job-posting-extraction-evaluation'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'

/**
 * Recall across segments: the held-out Job Postings of the cross-segment corpus (technology, general management, sales)
 * through the live extractor. The document qualification of the same corpus renders reference documents and calls no
 * model, so its corpus reaches qualification here. Each expected requirement must be cited by an extracted one, and
 * a French posting's excerpts must stay in French.
 */
export const crossSegmentExtractionSource: ModelObservationSource = {
  id: 'cross-segment-extraction',
  roles: ['structured'],
  observe: async ({ connect }) => {
    const connection = connect('structured')
    const observations = []
    for (const fixture of crossSegmentQualificationCorpus.fixtures.filter(({ split }) => split === 'held-out')) {
      const requirements = await extractJobPosting({ connection, jobPostingContent: fixture.jobPosting }) ?? []
      const recalled = fixture.expectedRequirements.filter(({ capability }) => requirements.some(({ sourceExcerpt, value }) =>
        includesTerm({ term: capability.name, value: `${value} ${sourceExcerpt}` })))
      const fidelity = fixture.language === 'en' ? [] : checkExcerptFidelity({ jobPostingContent: fixture.jobPosting, requirements })
      observations.push(createModelEvaluationObservation({ fixtureId: fixture.id,
        extractionExpectedCount: fixture.expectedRequirements.length, extractionMatchedCount: recalled.length,
        multilingualCheckCount: fixture.language === 'en' ? 0 : Math.max(1, fidelity.length),
        multilingualPassedCount: fidelity.filter(({ passed }) => passed).length,
        observedValues: [`role-family:${fixture.roleFamily}`] }))
    }
    return observations
  },
}

function includesTerm({ term, value }: Readonly<{ term: string; value: string }>) {
  return normalize(value).includes(normalize(term))
}

function normalize(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}
