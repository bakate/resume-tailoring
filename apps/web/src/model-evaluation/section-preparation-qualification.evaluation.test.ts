import { describe, expect, it } from 'vitest'

import { validateServerEnvironment, type ServerEnvironment } from '../env'
import { sectionPreparationBudgets } from './model-evaluation-baselines'
import { realSizedResumeFixture } from './real-sized-resume-corpus'
import {
  createSectionModels,
  prepareRealSizedResume,
  sectionPreparationRunCount,
} from './section-preparation-evaluation'
import { qualifySectionPreparation, type SectionPreparationRun } from './section-preparation-qualification'
import { countUnsupportedResumeClaims } from './unsupported-resume-claims'

// The same runs feed the qualification runner (`section-preparation` source).
describe('section-by-section preparation on a real-sized resume', () => {
  it('writes every section and the whole preparation within the latency budgets, with no unsupported Resume Claim', async () => {
    const environment = readServerEnvironment()
    const apiKey = { value: environment.languageModel.apiKey } as const
    const models = createSectionModels({
      structured: { apiKey, configuration: environment.languageModel.structured.active },
      writing: { apiKey, configuration: environment.languageModel.writing.active },
    })
    const runs: SectionPreparationRun[] = []
    let unsupportedResumeClaimCount = 0
    for (let runIndex = 0; runIndex < sectionPreparationRunCount; runIndex += 1) {
      const prepared = await prepareRealSizedResume({ models, runIndex })
      runs.push(prepared.run)
      unsupportedResumeClaimCount += prepared.document === null ? 0 : countUnsupportedResumeClaims({
        candidateFacts: realSizedResumeFixture.request.candidateFacts, document: prepared.document,
        rejectedFieldIds: prepared.rejectedFieldIds })
    }
    const report = qualifySectionPreparation({
      budgets: sectionPreparationBudgets,
      configurations: {
        structured: readQualifiedSettings(environment.languageModel.structured.active),
        writing: readQualifiedSettings(environment.languageModel.writing.active),
      },
      fixtureId: realSizedResumeFixture.id,
      runs,
    })
    console.info(JSON.stringify({ ...report, unsupportedResumeClaimCount }))

    expect(report.qualified).toBe(true)
    expect(unsupportedResumeClaimCount).toBe(0)
  }, 900_000)
})

function readQualifiedSettings({ model, providerOptions }: ServerEnvironment['languageModel']['structured']['active']) {
  return { model, reasoningEffort: providerOptions.reasoningEffort }
}

function readServerEnvironment() {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('A Language Model Provider key must be configured for live evaluation')
  return environment.value
}
