import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  mergeRecordedRuns,
  recordModelQualification,
  renderRecordedRunsModule,
} from './model-qualification-recording'
import { recordedLiveModelEvaluationRuns } from './recorded-live-model-evaluation-runs'

// Run through `pnpm test:evaluation:record <candidate>`. It records the candidate's observations, whether it qualifies
// or not, into recorded-live-model-evaluation-runs.ts, and its JSON report into docs/evaluations/qualification-reports/.
describe('live qualification recording', () => {
  it('records the candidate\'s observations and report', async () => {
    const candidateId = process.env.MODEL_QUALIFICATION_CANDIDATE ?? ''
    const { recordedRun, report } = await recordModelQualification({ candidateId, environment: process.env })
    const runsPath = fileURLToPath(new URL('recorded-live-model-evaluation-runs.ts', import.meta.url))
    const reportPath = fileURLToPath(new URL(`../../../../docs/evaluations/qualification-reports/${candidateId}.json`,
      import.meta.url))
    await writeFile(runsPath, renderRecordedRunsModule({ runs: mergeRecordedRuns({ recordedRun,
      runs: recordedLiveModelEvaluationRuns }) }))
    await mkdir(dirname(reportPath), { recursive: true })
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
    console.info(JSON.stringify({ candidateId, gates: report.gates, qualified: report.qualified,
      written: [runsPath, reportPath].map((path) => relative(process.cwd(), path)) }))

    expect(recordedRun.observations.length).toBeGreaterThan(0)
  }, 3_600_000)
})
