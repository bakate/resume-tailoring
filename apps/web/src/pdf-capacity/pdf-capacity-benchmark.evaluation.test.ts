import { describe, expect, it } from 'vitest'

import { groupedResumeDocument, resumeContractRevision } from '@resume-tailoring/application/structured-resume-fixtures'
import { renderResumeDocument } from '../candidate-journey/resume-document-renderer'
import { runPdfCapacityScenario } from './pdf-capacity-benchmark'
import { createPdfCapacityReport } from './pdf-capacity-report'
import { readProcessTreeResidentMemoryBytes } from './process-tree-memory'

describe('synchronous Chromium PDF rendering capacity', () => {
  it('reports representative one-page Tailored Resume load', async () => {
    const result = await runPdfCapacityBenchmark()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.scenarios).toHaveLength(targetConcurrencyLevels.length)
  }, 180_000)
})

async function runPdfCapacityBenchmark() {
  const warmup = await renderRepresentativePdf()
  if (!warmup.ok) return { ok: false, error: { type: 'warmup-render-failed' } } as const
  const scenarios = await measureCapacityScenarios()
  if (!scenarios.ok) return scenarios
  const report = createPdfCapacityReport({
    fixtureId: 'grouped-resume-document-v1',
    recordedAt: new Date().toISOString(),
    runtime: { architecture: process.arch, nodeVersion: process.version, platform: process.platform },
    scenarios: scenarios.value,
  })
  process.stdout.write(`PDF_CAPACITY_REPORT=${JSON.stringify(report)}\n`)
  return { ok: true, value: report } as const
}

async function measureCapacityScenarios() {
  const scenarios = []
  for (const targetConcurrency of targetConcurrencyLevels) {
    const result = await runPdfCapacityScenario({
      readResidentMemoryBytes: readProcessTreeResidentMemoryBytes,
      renderPdf: renderRepresentativePdf,
      requestCount: requestCountPerLevel,
      targetConcurrency,
      timeoutMilliseconds,
    })
    if (!result.ok) return result
    scenarios.push(result.value)
  }
  return { ok: true, value: scenarios } as const
}

async function renderRepresentativePdf() {
  const result = await renderResumeDocument({
    draft: { document: groupedResumeDocument, revision: resumeContractRevision },
    unsupportedFieldIds: [],
  })
  return { ok: result.pdf !== null }
}

const requestCountPerLevel = 12
const targetConcurrencyLevels = [1, 2, 4] as const
const timeoutMilliseconds = 10_000
