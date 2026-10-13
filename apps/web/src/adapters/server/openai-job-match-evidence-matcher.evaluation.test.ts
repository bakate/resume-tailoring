import { describe, expect, it } from 'vitest'

import { validateServerEnvironment } from '../../env'
import {
  evaluateMatchEvidenceCase,
  matchEvidenceEvaluationCases,
  minimumExpectedCoverageRecall,
  summarizeMatchEvidenceOutcomes,
} from '../../model-evaluation/match-evidence-evaluation'
import type { ModelCallMeasurement } from './language-model-request'

// Live evaluation of Requirement Coverage judged by the model and verified by the engine.
// Positive cases measure recall; traps must never receive more coverage than the rules allow,
// and a related but distinct capability must surface as Adjacent Evidence next to its gap.
// The same cases feed the qualification runner (`match-evidence` source).
describe('Job Match evidence live evaluation', () => {
  it('finds expected coverage, never covers a trap, and reports expected Adjacent Evidence', async () => {
    const { languageModel } = readServerEnvironment()
    const outcomes = []
    const cases = []
    for (const evaluationCase of matchEvidenceEvaluationCases) {
      const calls: ModelCallMeasurement[] = []
      outcomes.push(await evaluateMatchEvidenceCase({ evaluationCase, connection: {
        apiKey: { value: languageModel.apiKey }, configuration: languageModel.structured.active,
        observeCall: (call) => { calls.push(call) },
      } }))
      cases.push({ name: evaluationCase.name,
        calls: calls.map(({ latencyMilliseconds, outcome, usage }) => ({ latencyMilliseconds, outcome, usage })) })
    }
    const report = { ...summarizeMatchEvidenceOutcomes({ outcomes }), cases }
    console.info(JSON.stringify(report))

    expect(outcomes.every(({ ok }) => ok)).toBe(true)
    expect(report.expectedCoverageRecall).toBeGreaterThanOrEqual(minimumExpectedCoverageRecall)
    expect(report.trapViolations).toEqual([])
    expect(report.missingAdjacentEvidence).toEqual([])
  }, 600_000)
})

/** The structured role the Match Evidence route uses, validated as the server validates it. */
function readServerEnvironment() {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('A Language Model Provider key must be configured for live evaluation')
  return environment.value
}
