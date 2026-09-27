import type { ModelEvaluationObservation } from './model-qualification'
import {
  structuredModelConfiguration,
  writingModelConfiguration,
} from './model-configurations'
import { referenceModelEvaluationDataset } from './reference-dataset'

export const recordedStructuredModelEvaluation = {
  configuration: structuredModelConfiguration,
  datasetId: referenceModelEvaluationDataset.id,
  recordedAt: '2026-09-27T10:48:41.000+02:00',
  observations: [
    createObservation({ fixtureId: 'source-profile-extraction-en', expected: 3, matched: 3,
      inputTokens: 204, latency: 1_232, outputTokens: 88,
      observedValues: ['Built a billing platform.', 'Used TypeScript.',
        'Speaks French fluently.'] }),
    createObservation({ fixtureId: 'job-requirement-extraction-fr', expected: 2, matched: 2,
      inputTokens: 139, latency: 1_107, multilingual: 2, outputTokens: 89,
      observedValues: ['Vous devez maîtriser TypeScript.', 'La pratique du français est appréciée.'] }),
    createObservation({ fixtureId: 'matching-controlled-translation', expected: 1, matched: 1,
      inputTokens: 346, latency: 1_247, multilingual: 1, outputTokens: 69,
      observedValues: ['job-requirement-typescript'] }),
    ...createValidationObservations(),
  ],
} as const

export const recordedWritingModelEvaluation = {
  configuration: writingModelConfiguration,
  datasetId: referenceModelEvaluationDataset.id,
  recordedAt: '2026-09-27T10:48:41.000+02:00',
  observations: [
    createObservation({ fixtureId: 'resume-claim-translation-fr', inputTokens: 302,
      latency: 1_530, multilingual: 3, outputTokens: 57,
      observedValues: ['Développement d’une plateforme de facturation', 'avec TypeScript'] }),
    createObservation({ fixtureId: 'resume-writing-en', inputTokens: 259,
      latency: 2_626, multilingual: 4, outputTokens: 118,
      observedValues: ['Built a billing platform', 'using TypeScript'] }),
  ],
} as const

function createValidationObservations(): readonly ModelEvaluationObservation[] {
  const metrics = [
    ['seniority', 279, 1_168, 48], ['causality', 281, 1_171, 57],
    ['scope', 281, 2_786, 215], ['dates', 285, 1_585, 29],
    ['quantity', 280, 2_258, 164], ['outcome', 284, 1_075, 30],
  ] as const
  return metrics.map(([dimension, inputTokens, latency, outputTokens]) => createObservation({
    fixtureId: `validation-strengthened-${dimension}`, inputTokens, latency, outputTokens,
    observedValues: ['supported:false'],
  }))
}

type RecordedObservationInput = Readonly<{
  expected?: number
  fixtureId: string
  inputTokens: number
  latency: number
  matched?: number
  multilingual?: number
  observedValues: readonly string[]
  outputTokens: number
}>

function createObservation({
  expected = 0, fixtureId, inputTokens, latency, matched = 0, multilingual = 0,
  observedValues, outputTokens,
}: RecordedObservationInput): ModelEvaluationObservation {
  return {
    extractionExpectedCount: expected, extractionMatchedCount: matched, fixtureId, inputTokens,
    latencyMilliseconds: latency, multilingualCheckCount: multilingual,
    multilingualPassedCount: multilingual, observedValues, outputTokens,
    unsupportedResumeClaimCount: 0,
  }
}
