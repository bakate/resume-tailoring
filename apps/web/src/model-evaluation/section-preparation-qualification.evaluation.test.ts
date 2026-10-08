import { describe, expect, it } from 'vitest'
import { prepareResumeSections } from '@resume-tailoring/application/resume-preparation'

import {
  createOpenAiResumeCoherenceChecker,
  createOpenAiResumeFieldValidator,
  createOpenAiResumeSectionWriter,
} from '../adapters/server/openai-resume-section-models'
import { validateServerEnvironment, type ServerEnvironment } from '../env'
import { sectionPreparationBudgets } from './model-evaluation-baselines'
import { realSizedResumeFixture } from './real-sized-resume-corpus'
import {
  measureSectionModels,
  qualifySectionPreparation,
  type SectionPreparationRun,
} from './section-preparation-qualification'

const runCount = 3

describe('section-by-section preparation on a real-sized resume', () => {
  it('writes every section and the whole preparation within the latency budgets', async () => {
    const environment = readServerEnvironment()
    const runs: SectionPreparationRun[] = []
    for (let runIndex = 0; runIndex < runCount; runIndex += 1) {
      runs.push(await prepareRealSizedResume({ environment, runIndex }))
    }
    const report = qualifySectionPreparation({
      budgets: sectionPreparationBudgets,
      configurations: {
        structured: { model: environment.openAiStructuredModel, reasoningEffort: environment.openAiStructuredReasoningEffort },
        writing: { model: environment.openAiWritingModel, reasoningEffort: environment.openAiWritingReasoningEffort },
      },
      fixtureId: realSizedResumeFixture.id,
      runs,
    })
    console.info(JSON.stringify(report))

    expect(report.qualified).toBe(true)
  }, 900_000)
})

async function prepareRealSizedResume({ environment, runIndex }: Readonly<{
  environment: ServerEnvironment; runIndex: number
}>): Promise<SectionPreparationRun> {
  const now = () => performance.now()
  const measured = measureSectionModels({ models: createConfiguredSectionModels({ environment }), now })
  const startedAt = now()
  const output = await prepareResumeSections({
    models: measured.models,
    now,
    recordTelemetry: () => undefined,
    request: realSizedResumeFixture.request,
    revision: `${realSizedResumeFixture.id}:${String(runIndex)}`,
  })
  return { outcome: output.status, wallTimeMilliseconds: Math.round(now() - startedAt), ...measured.readMeasurements() }
}

/**
 * The configured roles the section routes use: writing for sections, structured for validation and coherence.
 * The adapters are called directly, so the browser-to-route hop a Candidate also waits for is not measured.
 */
function createConfiguredSectionModels({ environment }: Readonly<{ environment: ServerEnvironment }>) {
  const apiKey = { source: 'operator', value: environment.openAiApiKey } as const
  const writer = createOpenAiResumeSectionWriter({ apiKey, model: environment.openAiWritingModel,
    reasoningEffort: environment.openAiWritingReasoningEffort })
  const structured = { apiKey, model: environment.openAiStructuredModel,
    reasoningEffort: environment.openAiStructuredReasoningEffort }
  const validator = createOpenAiResumeFieldValidator(structured)
  const coherenceChecker = createOpenAiResumeCoherenceChecker(structured)
  return { writeSection: writer.write, validateFields: validator.validate, checkCoherence: coherenceChecker.check }
}

function readServerEnvironment() {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('OPENAI_API_KEY must be configured for live evaluation')
  return environment.value
}
