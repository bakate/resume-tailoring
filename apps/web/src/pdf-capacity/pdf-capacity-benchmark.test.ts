import { describe, expect, it } from 'vitest'

import { runPdfCapacityScenario } from './pdf-capacity-benchmark'

describe('PDF capacity benchmark', () => {
  it('runs the requested load without exceeding target concurrency', async () => {
    const renderTracker = createConcurrencyTrackingRenderer()
    const result = await runPdfCapacityScenario({
      readResidentMemoryBytes: readFixedResidentMemory,
      renderPdf: renderTracker.renderPdf,
      requestCount: 4,
      targetConcurrency: 2,
      timeoutMilliseconds: 1_000,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(renderTracker.readMaximumActiveRequestCount()).toBe(2)
    const measurements = result.value
    expect(measurements.observations).toHaveLength(4)
    expect(measurements.observations.filter(({ outcome }) => outcome === 'rendering-failure')).toHaveLength(1)
    expect(measurements.peakResidentMemoryBytes).toBe(256 * 1_024 * 1_024)
  })

  it('aborts an overdue render and records a timeout', async () => {
    const cleanupTracker = createTimeoutCleanupTracker()
    const result = await runPdfCapacityScenario({
      readResidentMemoryBytes: () => Promise.resolve({ ok: true, value: 1 } as const),
      renderPdf: cleanupTracker.renderPdf,
      requestCount: 1,
      targetConcurrency: 1,
      timeoutMilliseconds: 5,
    })

    expect(result).toMatchObject({
      ok: true,
      value: { observations: [{ outcome: 'timeout' }] },
    })
    expect(cleanupTracker.readActiveRequestCount()).toBe(0)
  })

  it('fails instead of reporting incomplete process-tree memory', async () => {
    const result = await runPdfCapacityScenario({
      readResidentMemoryBytes: () => Promise.resolve({
        ok: false, error: { type: 'memory-measurement-unavailable' },
      } as const),
      renderPdf: () => Promise.resolve({ ok: true }),
      requestCount: 1,
      targetConcurrency: 1,
      timeoutMilliseconds: 1_000,
    })

    expect(result).toEqual({
      ok: false, error: { type: 'memory-measurement-unavailable' },
    })
  })
})

function createConcurrencyTrackingRenderer() {
  let activeRequestCount = 0
  let maximumActiveRequestCount = 0
  let renderedRequestCount = 0
  return {
    readMaximumActiveRequestCount: () => maximumActiveRequestCount,
    renderPdf: async () => {
      activeRequestCount += 1
      maximumActiveRequestCount = Math.max(maximumActiveRequestCount, activeRequestCount)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeRequestCount -= 1
      renderedRequestCount += 1
      return { ok: renderedRequestCount !== 3 }
    },
  }
}

function readFixedResidentMemory() {
  return Promise.resolve({ ok: true, value: 256 * 1_024 * 1_024 } as const)
}

function createTimeoutCleanupTracker() {
  let activeRequestCount = 0
  return {
    readActiveRequestCount: () => activeRequestCount,
    renderPdf: ({ signal }: Readonly<{ signal: AbortSignal }>) => new Promise<Readonly<{ ok: false }>>((resolve) => {
      activeRequestCount += 1
      signal.addEventListener('abort', () => {
        setTimeout(() => {
          activeRequestCount -= 1
          resolve({ ok: false })
        }, 5)
      }, { once: true })
    }),
  }
}
