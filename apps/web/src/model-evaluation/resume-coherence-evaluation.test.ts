import { describe, expect, it } from 'vitest'

import { createScriptedLanguageModelProvider } from '../adapters/server/scripted-language-model-provider'
import { createOpenAiModelConfiguration } from '../language-model-configuration'
import type { ModelConfiguration } from './model-qualification'
import { runModelQualification } from './model-qualification-runner'
import { resumeCoherenceFixtures, resumeCoherenceSource, valuePropositionFieldId } from './resume-coherence-evaluation'

describe('the coherence check on a cross-employer Value Proposition', () => {
  it('passes when it flags each Value Proposition chaining two employers, and spares the faithful one', async () => {
    const { recordedRun, report } = await qualifyCoherence({ flags: (fixture) => fixture.mixesEmployers })

    expect(recordedRun.observations.filter(({ operation }) => operation === undefined).map((observation) => ({
      fixtureId: observation.fixtureId, recall: [observation.extractionMatchedCount, observation.extractionExpectedCount],
      unsupported: observation.unsupportedResumeClaimCount, observedValues: observation.observedValues }))).toEqual([
      { fixtureId: 'resume-coherence:mixed-association-en', recall: [1, 1], unsupported: 0, observedValues: [] },
      { fixtureId: 'resume-coherence:mixed-association-fr', recall: [1, 1], unsupported: 0, observedValues: [] },
      { fixtureId: 'resume-coherence:faithful-association-en', recall: [1, 1], unsupported: 0, observedValues: [] },
    ])
    expect(report.gates.provenanceSafety.passed).toBe(true)
  })

  it('fails provenance safety when a Value Proposition chaining two employers goes through unflagged', async () => {
    const { recordedRun, report } = await qualifyCoherence({ flags: () => false })

    expect(recordedRun.observations[0]).toMatchObject({ unsupportedResumeClaimCount: 1,
      observedValues: ['failed:the coherence check flags the Value Proposition as a mixed association'] })
    expect(report.gates.provenanceSafety).toMatchObject({ passed: false, unsupportedResumeClaimCount: 2 })
  })

  it('counts a faithful Value Proposition flagged as a mixed association against recall, never provenance', async () => {
    const { recordedRun } = await qualifyCoherence({ flags: () => true })

    expect(recordedRun.observations[2]).toMatchObject({ extractionExpectedCount: 1, extractionMatchedCount: 0,
      unsupportedResumeClaimCount: 0,
      observedValues: ['failed:the coherence check leaves the faithful Value Proposition unflagged'] })
  })
})

type CoherenceFixture = typeof resumeCoherenceFixtures[number]

async function qualifyCoherence({ flags }: Readonly<{ flags: (fixture: CoherenceFixture) => boolean }>) {
  const provider = createScriptedLanguageModelProvider({ answer: ({ outputName, userText }) => {
    if (outputName !== 'resume_document_coherence') throw new Error(`Unexpected output ${outputName}`)
    const fixture = resumeCoherenceFixtures.find(({ document }) =>
      userText.includes(document.valueProposition.paragraphs[0]?.text ?? 'no Value Proposition'))
    if (fixture === undefined) throw new Error('No scripted answer for this document')
    const flagged = flags(fixture)
    return { text: JSON.stringify({ coherent: !flagged, languageMatches: true,
      issues: flagged ? [{ fieldId: valuePropositionFieldId, kind: 'mixed-association' }] : [] }) }
  } })
  return runModelQualification({ apiKey: { value: 'scripted-key' }, candidate: { configuration }, datasetId: 'scripted-v1',
    providers: { scripted: provider }, sources: [resumeCoherenceSource],
    thresholds: { costUsd: 1, extractionRecall: 0.9, multilingualFidelity: 1, p95LatencyMilliseconds: 30_000 } })
}

// A provider production does not know, so the source is shown to run on any provider the runner is handed.
const configuration = {
  provider: 'scripted', model: 'scripted-structured', role: 'structured', providerOptions: {},
  operations: createOpenAiModelConfiguration({ model: 'scripted', reasoningEffort: 'low', role: 'structured' }).operations,
  pricing: [{ condition: 'standard', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 4 }],
} as unknown as ModelConfiguration
