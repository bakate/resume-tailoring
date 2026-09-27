import type {
  PdfCapacityScenarioMeasurements,
  PdfRenderingObservation,
} from './pdf-capacity-report'

type PdfRenderResult = Readonly<{ ok: boolean }>
export type MemoryMeasurementResult =
  | Readonly<{ ok: true; value: number }>
  | Readonly<{ ok: false; error: Readonly<{ type: 'memory-measurement-unavailable' }> }>

type PdfCapacityScenarioResult =
  | Readonly<{ ok: true; value: PdfCapacityScenarioMeasurements }>
  | Extract<MemoryMeasurementResult, { readonly ok: false }>

type PdfCapacityScenarioInputs = Readonly<{
  readResidentMemoryBytes: () => Promise<MemoryMeasurementResult>
  renderPdf: (request: Readonly<{ signal: AbortSignal }>) => Promise<PdfRenderResult>
  requestCount: number
  targetConcurrency: number
  timeoutMilliseconds: number
}>

export async function runPdfCapacityScenario(
  inputs: PdfCapacityScenarioInputs,
): Promise<PdfCapacityScenarioResult> {
  const memorySamplingController = new AbortController()
  const memorySampling = samplePeakResidentMemory({
    readResidentMemoryBytes: inputs.readResidentMemoryBytes,
    signal: memorySamplingController.signal,
  })
  const observations = await runConcurrentRequests(inputs)
  memorySamplingController.abort()
  const memoryMeasurement = await memorySampling
  if (!memoryMeasurement.ok) return memoryMeasurement
  return { ok: true, value: {
    observations,
    peakResidentMemoryBytes: memoryMeasurement.value,
    targetConcurrency: inputs.targetConcurrency,
    timeoutMilliseconds: inputs.timeoutMilliseconds,
  } }
}

async function runConcurrentRequests(inputs: PdfCapacityScenarioInputs) {
  const requestIndexes = Array.from({ length: inputs.requestCount }, (unusedValue, requestIndex) => {
    void unusedValue
    return requestIndex
  })
  const workerCount = Math.min(inputs.targetConcurrency, inputs.requestCount)
  const workers = Array.from({ length: workerCount }, async () => runWorker({ inputs, requestIndexes }))
  return (await Promise.all(workers)).flat()
}

async function runWorker({ inputs, requestIndexes }: Readonly<{
  inputs: PdfCapacityScenarioInputs
  requestIndexes: number[]
}>) {
  const observations: PdfRenderingObservation[] = []
  for (;;) {
    const requestIndex = requestIndexes.shift()
    if (requestIndex === undefined) return observations
    observations.push(await measurePdfRender(inputs))
  }
}

async function measurePdfRender({ renderPdf, timeoutMilliseconds }: PdfCapacityScenarioInputs) {
  const startedAt = performance.now()
  const renderController = new AbortController()
  const timeoutHandle = setTimeout(() => { renderController.abort() }, timeoutMilliseconds)
  const renderAttempt = renderPdf({ signal: renderController.signal })
    .catch(() => ({ ok: false } as const))
  const firstResult = await Promise.race([
    renderAttempt,
    waitForAbort({ signal: renderController.signal }),
  ])
  const result = renderController.signal.aborted ? await renderAttempt : firstResult
  clearTimeout(timeoutHandle)
  return createRenderingObservation({ renderController, result, startedAt })
}

function createRenderingObservation({ renderController, result, startedAt }: Readonly<{
  renderController: AbortController
  result: PdfRenderResult
  startedAt: number
}>) {
  return {
    latencyMilliseconds: Math.round(performance.now() - startedAt),
    outcome: renderController.signal.aborted
      ? 'timeout'
      : result.ok ? 'success' : 'rendering-failure',
  } as const satisfies PdfRenderingObservation
}

function waitForAbort({ signal }: Readonly<{ signal: AbortSignal }>): Promise<PdfRenderResult> {
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => { resolve({ ok: false }) }, { once: true })
  })
}

async function samplePeakResidentMemory({ readResidentMemoryBytes, signal }: Readonly<{
  readResidentMemoryBytes: () => Promise<MemoryMeasurementResult>
  signal: AbortSignal
}>) {
  let measurement = await readResidentMemoryBytes()
  if (!measurement.ok) return measurement
  let peakResidentMemoryBytes = measurement.value
  while (!signal.aborted) {
    await new Promise((resolve) => setTimeout(resolve, memorySamplingIntervalMilliseconds))
    measurement = await readResidentMemoryBytes()
    if (!measurement.ok) return measurement
    peakResidentMemoryBytes = Math.max(peakResidentMemoryBytes, measurement.value)
  }
  return { ok: true, value: peakResidentMemoryBytes } as const
}

const memorySamplingIntervalMilliseconds = 25
