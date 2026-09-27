import { describe, expect, it } from 'vitest'

import type { TailoredResumePdfInputs } from '../resume-tailoring/tailored-resume-contract'
import { createTailoredResumePdf } from '../resume-tailoring/tailored-resume-pdf'
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
    fixtureId: 'synthetic-tailored-resume-v1',
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

function renderRepresentativePdf({ signal }: Readonly<{ signal?: AbortSignal }> = {}) {
  return createTailoredResumePdf({ inputs: representativePdfInputs, semanticValidator, signal })
}

const representativeFacts = [
  ['delivery', 'experience', 'Led delivery of twelve TypeScript services for a distributed platform team.'],
  ['performance', 'experience', 'Reduced API p95 latency by 38% through profiling and query redesign.'],
  ['reliability', 'experience', 'Improved service availability to 99.95% with observability and incident reviews.'],
  ['frontend', 'experience', 'Built accessible React workflows used across desktop and mobile browsers.'],
  ['mentoring', 'experience', 'Mentored six engineers through design reviews and production ownership.'],
  ['typescript', 'skill', 'Uses TypeScript in strict mode for production web applications.'],
  ['architecture', 'skill', 'Applies hexagonal architecture to isolate domain and infrastructure code.'],
  ['education', 'education', 'Completed a software engineering degree.'],
] as const

const representativePdfInputs = {
  contactItems: [
    { kind: 'email', value: 'synthetic-candidate@example.invalid' },
    { kind: 'url', value: 'https://example.invalid/portfolio' },
  ],
  locale: 'en',
  source: {
    claims: representativeFacts.map(([factSuffix, , value]) => ({
      id: `resume-claim-${factSuffix}` as const,
      segments: [{ factIds: [`source-fact-${factSuffix}` as const], text: value }],
    })),
    evidence: representativeFacts.slice(0, 7).map(([factSuffix]) => ({
      factIds: [`source-fact-${factSuffix}` as const],
      requirementId: `job-requirement-${factSuffix}` as const,
    })),
    requirements: representativeFacts.slice(0, 7).map(([factSuffix]) => ({
      classification: 'required' as const,
      id: `job-requirement-${factSuffix}` as const,
    })),
    verifiedFacts: representativeFacts.map(([factSuffix, kind, value]) => ({
      id: `source-fact-${factSuffix}` as const,
      kind,
      value,
    })),
  },
} as const satisfies TailoredResumePdfInputs

const semanticValidator = {
  validate: () => Promise.resolve({ ok: true, value: { feedback: [], supported: true } } as const),
} as const
const requestCountPerLevel = 12
const targetConcurrencyLevels = [1, 2, 4] as const
const timeoutMilliseconds = 10_000
