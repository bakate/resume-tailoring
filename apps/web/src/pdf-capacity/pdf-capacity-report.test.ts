import { describe, expect, it } from 'vitest'

import { createPdfCapacityReport } from './pdf-capacity-report'

describe('PDF rendering capacity report', () => {
  it('reports concurrency, p95 latency, peak memory, timeout rate, and rendering failure rate', () => {
    const report = createPdfCapacityReport(reportInputs)

    expect(report.scenarios).toEqual(expectedScenarios)
  })
})

const reportInputs = {
  fixtureId: 'synthetic-tailored-resume-v1',
  recordedAt: '2026-09-27T10:00:00.000Z',
  runtime: { architecture: 'arm64', nodeVersion: 'v24.15.0', platform: 'darwin' },
  scenarios: [{
    observations: [
      { latencyMilliseconds: 100, outcome: 'success' },
      { latencyMilliseconds: 200, outcome: 'success' },
      { latencyMilliseconds: 300, outcome: 'rendering-failure' },
      { latencyMilliseconds: 400, outcome: 'timeout' },
    ],
    peakResidentMemoryBytes: 512 * 1_024 * 1_024,
    targetConcurrency: 4,
    timeoutMilliseconds: 350,
  }],
} as const

const expectedScenarios = [{
  completedRequestCount: 4,
  p95LatencyMilliseconds: 400,
  peakResidentMemoryMegabytes: 512,
  renderingFailureRate: 0.25,
  targetConcurrency: 4,
  timeoutMilliseconds: 350,
  timeoutRate: 0.25,
}] as const
