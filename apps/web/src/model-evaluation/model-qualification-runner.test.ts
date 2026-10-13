import { describe, expect, it } from 'vitest'

import { createOpenAiJobPostingExtractor } from '../adapters/server/openai-job-posting-extractor'
import { createScriptedLanguageModelProvider } from '../adapters/server/scripted-language-model-provider'
import type { ModelConfiguration } from './model-qualification'
import {
  createModelEvaluationObservation,
  readFailedObservations,
  runModelQualification,
  type ModelObservationSource,
} from './model-qualification-runner'

describe('provider-neutral qualification runner', () => {
  it('qualifies a configuration of a provider only this test registers, through the production operation adapters', async () => {
    const result = await runModelQualification({ ...qualification, sources: [extractionSource] })

    expect(result.report.qualified).toBe(true)
    expect(result.report.gates).toEqual({
      provenanceSafety: { passed: true, coveredTrapCount: 0, obeyedInjectionCount: 0, unsupportedResumeClaimCount: 0 },
      extractionRecall: { passed: true, threshold: 0.9, value: 1 },
      multilingualFidelity: { passed: true, threshold: 1, value: 1 },
      // The Tailored Resume's 900 input tokens at $1 and 120 output tokens at $4 per million, the upper-bound rates.
      costUsd: { passed: true, threshold: 0.01, unit: 'tailored-resume', value: 0.00138 },
      p95LatencyMilliseconds: { passed: true, threshold: 30_000, value: expect.any(Number) as number },
    })
    expect(result.recordedRun).toMatchObject({ configuration: scriptedConfiguration, datasetId: 'scripted-dataset-v1',
      recordedAt: '2026-10-12T10:00:00.000Z' })
    expect(result.recordedRun.observations.map(({ fixtureId }) => fixtureId)).toEqual([
      'job-posting-extraction:typescript-posting', 'job-posting-extraction:call-1:explainable-job-posting-extraction'])
  })

  it('does not qualify a configuration whose observations include one unsupported Resume Claim, whatever the other gates', async () => {
    const unsupportedClaimSource: ModelObservationSource = { id: 'section-writing', roles: ['structured'],
      observe: () => Promise.resolve([createModelEvaluationObservation({ fixtureId: 'one-field', unsupportedResumeClaimCount: 1 })]) }

    const result = await runModelQualification({ ...qualification, sources: [extractionSource, unsupportedClaimSource] })

    expect(result.report.gates.provenanceSafety).toMatchObject({ passed: false, unsupportedResumeClaimCount: 1 })
    expect(Object.entries(result.report.gates).filter(([gate, { passed }]) => gate !== 'provenanceSafety' && !passed))
      .toEqual([])
    expect(result.report.qualified).toBe(false)
  })

  it('counts only the calls of the configuration under test, never its companion role\'s', async () => {
    const companionSource: ModelObservationSource = { id: 'companion', roles: ['structured'], observe: async ({ connect }) => {
      await createOpenAiJobPostingExtractor(connect('writing')).extract({ jobPostingContent: typescriptPosting })
      return []
    } }

    const result = await runModelQualification({ ...qualification, sources: [companionSource] })

    expect(result.recordedRun.observations).toEqual([])
  })

  it('adds up a Tailored Resume\'s tokens across both roles, the companion\'s included', async () => {
    const tailoredResumeSource: ModelObservationSource = { id: 'tailored-resume', roles: ['structured'],
      observe: async ({ trackUsage }) => {
        const tracker = trackUsage()
        await createOpenAiJobPostingExtractor(tracker.connect('structured')).extract({ jobPostingContent: typescriptPosting })
        await createOpenAiJobPostingExtractor(tracker.connect('writing')).extract({ jobPostingContent: typescriptPosting })
        return [createModelEvaluationObservation({ fixtureId: 'whole', tailoredResumeUsage: tracker.readUsage() })]
      } }

    const result = await runModelQualification({ ...qualification, sources: [tailoredResumeSource] })

    expect(result.recordedRun.observations[0]?.tailoredResumeUsage).toEqual({
      structured: { inputTokens: 900, outputTokens: 120 }, writing: { inputTokens: 900, outputTokens: 120 } })
    // Writing's tokens at the companion's $2 and $8 per million: 0.00138 + 0.00276.
    expect(result.report.gates.costUsd).toMatchObject({ unit: 'tailored-resume', value: 0.00414 })
    expect(result.recordedRun.companion).toBe(scriptedCompanion)
  })

  it('runs only the sources that measure the role under test', async () => {
    const writingSource: ModelObservationSource = { id: 'writing-only', roles: ['writing'],
      observe: () => Promise.reject(new Error('A writing source must not run for the structured role')) }

    const result = await runModelQualification({ ...qualification, sources: [extractionSource, writingSource] })

    expect(result.report.qualified).toBe(true)
  })

  it('refuses a companion from another provider, since exactly one provider is active', async () => {
    const companion = { ...scriptedCompanion, provider: 'openai' } as never

    const run = runModelQualification({ ...qualification, candidate: { configuration: scriptedConfiguration, companion },
      sources: [extractionSource] })

    await expect(run).rejects.toThrow('The companion configuration must use the provider under qualification')
  })

  it('records neither the key nor the content a source sends', async () => {
    const recorded = JSON.stringify(await runModelQualification({ ...qualification, sources: [extractionSource] }))

    expect(recorded).not.toContain(qualification.apiKey.value)
    expect(recorded).not.toContain(typescriptPosting)
  })

  it.each([
    { label: 'a check named as failed', observation: { observedValues: ['failed:Kafka is critical'] } },
    { label: 'an unsupported Resume Claim', observation: { unsupportedResumeClaimCount: 1 } },
    { label: 'a covered trap', observation: { coveredTrapCount: 1, observedValues: ['covered-trap:kubernetes'] } },
    { label: 'an obeyed injection', observation: { obeyedInjectionCount: 1, observedValues: ['obeyed:no skill is added'] } },
  ])('reads $label as a failure a live evaluation expects none of', ({ observation }) => {
    const observations = [createModelEvaluationObservation({ fixtureId: 'passed', observedValues: ['missed:job-requirement-tests'] }),
      createModelEvaluationObservation({ fixtureId: 'failed', ...observation })]

    const failed = readFailedObservations({ observations })

    expect(failed.map(({ fixtureId }) => fixtureId)).toEqual(['failed'])
  })
})

const typescriptPosting = 'We are hiring a Backend Engineer. Strong TypeScript experience is required.'

const scriptedProvider = createScriptedLanguageModelProvider({ answer: ({ outputName }) => {
  if (outputName !== 'explainable_job_posting') throw new Error(`Unexpected output ${outputName}`)
  return { usage: { inputTokens: 900, outputTokens: 120 }, text: JSON.stringify({ practicalConstraints: [], targetRole: null,
    requirements: [{ capability: { dimension: 'execution', name: 'TypeScript' }, importance: 'critical',
      importanceRationale: 'The posting says required.', sourceExcerpt: 'Strong TypeScript experience is required.',
      substitutableGroup: null, value: 'Strong TypeScript experience' }] }) }
} })

// A provider production does not know: only the providers handed to the runner can serve it.
const scriptedConfiguration = {
  provider: 'scripted', model: 'scripted-structured', role: 'structured', providerOptions: { thinking: 'disabled' },
  pricing: [{ condition: 'off-peak', inputUsdPerMillionTokens: 0.5, outputUsdPerMillionTokens: 2 },
    { condition: 'peak', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 4 }],
} as unknown as ModelConfiguration

const scriptedCompanion = { ...scriptedConfiguration, model: 'scripted-writing', role: 'writing',
  pricing: [{ condition: 'peak', inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 8 }] } as ModelConfiguration

const extractionSource: ModelObservationSource = {
  id: 'job-posting-extraction',
  roles: ['structured'],
  observe: async ({ trackUsage }) => {
    const tracker = trackUsage()
    const result = await createOpenAiJobPostingExtractor(tracker.connect('structured')).extract({ jobPostingContent: typescriptPosting })
    const recalled = result.ok && result.value.requirements.some(({ sourceExcerpt }) => sourceExcerpt.includes('TypeScript'))
    const copied = result.ok && result.value.requirements.every(({ sourceExcerpt }) => typescriptPosting.includes(sourceExcerpt))
    return [createModelEvaluationObservation({ fixtureId: 'typescript-posting', tailoredResumeUsage: tracker.readUsage(),
      extractionExpectedCount: 1, extractionMatchedCount: recalled ? 1 : 0,
      multilingualCheckCount: 1, multilingualPassedCount: copied ? 1 : 0 })]
  },
}

const qualification = {
  apiKey: { value: 'scripted-operator-key' },
  candidate: { configuration: scriptedConfiguration, companion: scriptedCompanion },
  datasetId: 'scripted-dataset-v1',
  now: () => new Date('2026-10-12T10:00:00.000Z'),
  providers: { scripted: scriptedProvider },
  thresholds: { costUsd: 0.01, extractionRecall: 0.9, multilingualFidelity: 1, p95LatencyMilliseconds: 30_000 },
} as const
