import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionModels } from '@resume-tailoring/application/ports'
import { prepareResumeSections } from '@resume-tailoring/application/resume-preparation'

import type { ModelConnection } from '../adapters/server/language-model-request'
import {
  createOpenAiResumeCoherenceChecker,
  createOpenAiResumeFieldValidator,
  createOpenAiResumeSectionWriter,
} from '../adapters/server/openai-resume-section-models'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'
import { realSizedResumeFixture } from './real-sized-resume-corpus'
import { measureSectionModels, type SectionPreparationRun } from './section-preparation-qualification'
import { countUnsupportedResumeClaims } from './unsupported-resume-claims'

export const sectionPreparationRunCount = 3

export type PreparedRealSizedResume = Readonly<{
  document: ProfessionalResumeDocument | null
  /** Fields whose last validation the field validator rejected. */
  rejectedFieldIds: readonly string[]
  run: SectionPreparationRun
}>

/**
 * The section routes' roles: writing for sections, structured for validation and coherence. The adapters are called
 * directly, so the browser-to-route hop a Candidate also waits for is not measured.
 */
export function createSectionModels({ structured, writing }: Readonly<{
  structured: ModelConnection
  writing: ModelConnection
}>): ResumeSectionModels {
  return {
    writeSection: createOpenAiResumeSectionWriter(writing).write,
    validateFields: createOpenAiResumeFieldValidator(structured).validate,
    checkCoherence: createOpenAiResumeCoherenceChecker(structured).check,
  }
}

/** Prepares the real-sized resume section by section, timing each Resume Section and keeping each field's last verdict. */
export async function prepareRealSizedResume({ models, runIndex }: Readonly<{
  models: ResumeSectionModels
  runIndex: number
}>): Promise<PreparedRealSizedResume> {
  const now = () => performance.now()
  const verdicts = new Map<string, boolean>()
  const measured = measureSectionModels({ now, models: { ...models, validateFields: async (input) => {
    const result = await models.validateFields(input)
    if (result.ok) for (const { fieldId, supported } of result.value.fields) verdicts.set(fieldId, supported)
    return result
  } } })
  const startedAt = now()
  const output = await prepareResumeSections({
    models: measured.models,
    now,
    recordTelemetry: () => undefined,
    request: realSizedResumeFixture.request,
    revision: `${realSizedResumeFixture.id}:${String(runIndex)}`,
  })
  return {
    document: output.status === 'prepared' ? output.document : null,
    rejectedFieldIds: [...verdicts].filter(([, supported]) => !supported).map(([fieldId]) => fieldId),
    run: { outcome: output.status, wallTimeMilliseconds: Math.round(now() - startedAt), ...measured.readMeasurements() },
  }
}

/**
 * Each run checks that preparation ends prepared, reports its wall time, and counts the unsupported Resume Claims
 * of its document. Writing is measured per Resume Section, from its first writing call to its last call, retries
 * included; the structured role's calls are measured one by one by the runner.
 */
export const sectionPreparationSource: ModelObservationSource = {
  id: 'section-preparation',
  roles: ['structured', 'writing'],
  observe: async ({ connect, role }) => {
    const models = createSectionModels({ structured: connect('structured'), writing: connect('writing') })
    const observations = []
    for (let runIndex = 0; runIndex < sectionPreparationRunCount; runIndex += 1) {
      const { document, rejectedFieldIds, run } = await prepareRealSizedResume({ models, runIndex })
      const fixtureId = `${realSizedResumeFixture.id}:run-${String(runIndex + 1)}`
      // Wall time is reported, not gated here: the live evaluation holds it to its budget.
      observations.push(createModelEvaluationObservation({ fixtureId,
        extractionExpectedCount: 1, extractionMatchedCount: Number(run.outcome === 'prepared'),
        observedValues: [`outcome:${run.outcome}`, `wall-time-milliseconds:${String(run.wallTimeMilliseconds)}`],
        unsupportedResumeClaimCount: document === null ? 0 : countUnsupportedResumeClaims({
          candidateFacts: realSizedResumeFixture.request.candidateFacts, document, rejectedFieldIds }) }))
      if (role !== 'writing') continue
      observations.push(...run.sections.map((section) => createModelEvaluationObservation({
        fixtureId: `${fixtureId}:${section.key}`, latencyMilliseconds: section.durationMilliseconds,
        observedValues: [`writing-calls:${String(section.writingCallCount)}`] })))
    }
    return observations
  },
}
