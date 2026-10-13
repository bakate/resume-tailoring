import { describe, expect, it } from 'vitest'

import { createScriptedLanguageModelProvider } from '../adapters/server/scripted-language-model-provider'
import { createOpenAiModelConfiguration } from '../language-model-configuration'
import type { ModelConfiguration } from './model-qualification'
import type { RecordedModelEvaluationRun } from './model-qualification'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'
import {
  mergeRecordedRuns,
  recordModelQualification,
  renderQualificationReport,
  renderRecordedRunsModule,
} from './model-qualification-recording'

describe('recording a Qualified Model Configuration candidate', () => {
  it('runs the named candidate on the live dataset with the key its provider reads from the environment', async () => {
    const result = await recordModelQualification({ ...recording, candidateId: 'scripted-structured' })

    expect(result.recordedRun).toMatchObject({ configuration: structured, datasetId: 'resume-tailoring-live-v1' })
    expect(result.report.configuration).toBe(structured)
    expect(keysUsed).toContain('scripted-key-from-environment')
  })

  it('refuses a candidate nobody declared', async () => {
    const recorded = recordModelQualification({ ...recording, candidateId: 'unknown' })

    await expect(recorded).rejects.toThrow('Unknown candidate "unknown"; record one of: scripted-structured')
  })

  it('refuses to run without the key of the candidate\'s provider', async () => {
    const environment = {}

    const recorded = recordModelQualification({ ...recording, candidateId: 'scripted-structured', environment })

    await expect(recorded).rejects.toThrow('SCRIPTED_API_KEY must be set to record "scripted-structured"')
  })

  it('replaces the run of the same configuration and keeps every other', () => {
    const other = { ...run, configuration: { ...structured, model: 'another-model' } as ModelConfiguration }
    const rerun = { ...run, recordedAt: '2026-10-13T10:00:00.000Z' }

    const runs = mergeRecordedRuns({ recordedRun: rerun, runs: [run, other] })

    expect(runs).toEqual([other, rerun])
  })

  it('replaces the run of the same configuration whatever order its fields were written in', () => {
    const { role, pricing, ...rest } = structured
    const reordered = { ...run, configuration: { pricing, role, ...rest } as ModelConfiguration }
    const rerun = { ...run, recordedAt: '2026-10-13T10:00:00.000Z' }

    const runs = mergeRecordedRuns({ recordedRun: rerun, runs: [reordered] })

    expect(runs).toEqual([rerun])
  })

  it('writes the runs as the module qualification reads', () => {
    const module = renderRecordedRunsModule({ runs: [run] })

    expect(module.startsWith("import type { RecordedModelEvaluationRun } from './model-qualification'\n")).toBe(true)
    expect(module).toContain('export const recordedLiveModelEvaluationRuns: readonly RecordedModelEvaluationRun[] = [')
    expect(module).toContain('"recordedAt": "2026-10-12T10:00:00.000Z"')
    expect(module.endsWith('\n')).toBe(true)
  })

  it('writes the report without the observations the recorded runs already hold', async () => {
    const { recordedRun, report } = await recordModelQualification({ ...recording, candidateId: 'scripted-structured' })

    const written = JSON.parse(renderQualificationReport({ recordedRun, report })) as Record<string, unknown>

    expect(Object.keys(written)).toEqual(['configuration', 'datasetId', 'recordedAt', 'gates', 'qualified'])
    expect(written.recordedAt).toBe(recordedRun.recordedAt)
  })
})

const keysUsed: string[] = []

const structured = {
  provider: 'scripted', model: 'scripted-structured', role: 'structured', providerOptions: {},
  operations: createOpenAiModelConfiguration({ model: 'scripted', reasoningEffort: 'low', role: 'structured' }).operations,
  pricing: [{ condition: 'peak', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 4 }],
} as unknown as ModelConfiguration

const keyRecordingSource: ModelObservationSource = { id: 'key', roles: ['structured'], observe: ({ connect }) => {
  keysUsed.push(connect('structured').apiKey.value)
  return Promise.resolve([createModelEvaluationObservation({ fixtureId: 'fixture' })])
} }

const recording = {
  apiKeyVariables: { scripted: 'SCRIPTED_API_KEY' },
  candidates: { 'scripted-structured': { configuration: structured } },
  environment: { SCRIPTED_API_KEY: 'scripted-key-from-environment' },
  providers: { scripted: createScriptedLanguageModelProvider({ answer: () => ({ text: '{}' }) }) },
  sources: [keyRecordingSource],
}

const run: RecordedModelEvaluationRun = {
  configuration: structured, datasetId: 'resume-tailoring-live-v1', recordedAt: '2026-10-12T10:00:00.000Z',
  observations: [createModelEvaluationObservation({ fixtureId: 'fixture' })],
}
