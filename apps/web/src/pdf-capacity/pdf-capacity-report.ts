export type PdfRenderingOutcome = 'rendering-failure' | 'success' | 'timeout'

export type PdfRenderingObservation = Readonly<{
  latencyMilliseconds: number
  outcome: PdfRenderingOutcome
}>

export type PdfCapacityScenarioMeasurements = Readonly<{
  observations: readonly PdfRenderingObservation[]
  peakResidentMemoryBytes: number
  targetConcurrency: number
  timeoutMilliseconds: number
}>

export type PdfCapacityReportInputs = Readonly<{
  fixtureId: string
  recordedAt: string
  runtime: Readonly<{
    architecture: string
    nodeVersion: string
    platform: string
  }>
  scenarios: readonly PdfCapacityScenarioMeasurements[]
}>

export function createPdfCapacityReport(inputs: PdfCapacityReportInputs) {
  return {
    fixtureId: inputs.fixtureId,
    recordedAt: inputs.recordedAt,
    runtime: inputs.runtime,
    scenarios: inputs.scenarios.map(createScenarioReport),
  }
}

function createScenarioReport(scenario: PdfCapacityScenarioMeasurements) {
  const completedRequestCount = scenario.observations.length
  return {
    completedRequestCount,
    p95LatencyMilliseconds: calculateP95({ observations: scenario.observations }),
    peakResidentMemoryMegabytes: toMegabytes(scenario.peakResidentMemoryBytes),
    renderingFailureRate: calculateRate({
      observations: scenario.observations, outcome: 'rendering-failure',
    }),
    targetConcurrency: scenario.targetConcurrency,
    timeoutMilliseconds: scenario.timeoutMilliseconds,
    timeoutRate: calculateRate({ observations: scenario.observations, outcome: 'timeout' }),
  }
}

function calculateP95({ observations }: Readonly<{
  observations: readonly PdfRenderingObservation[]
}>) {
  if (observations.length === 0) return 0
  const latencies = observations.map(({ latencyMilliseconds }) => latencyMilliseconds)
    .sort((leftLatency, rightLatency) => leftLatency - rightLatency)
  return latencies[Math.ceil(latencies.length * 0.95) - 1] ?? 0
}

function calculateRate({ observations, outcome }: Readonly<{
  observations: readonly PdfRenderingObservation[]
  outcome: PdfRenderingOutcome
}>) {
  if (observations.length === 0) return 0
  const matchingCount = observations.filter((observation) => observation.outcome === outcome).length
  return Number((matchingCount / observations.length).toFixed(4))
}

function toMegabytes(bytes: number) {
  return Number((bytes / 1_024 / 1_024).toFixed(1))
}
