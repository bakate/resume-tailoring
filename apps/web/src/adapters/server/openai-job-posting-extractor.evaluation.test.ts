import { describe, expect, it } from 'vitest'

import { jobPostingExtractionSource } from '../../model-evaluation/job-posting-extraction-evaluation'
import { readLiveSourceFailures } from '../../model-evaluation/live-source-evaluation'

// Live run of the `job-posting-extraction` source, the one the qualification runner records: generic duties collapse,
// emphasis reads central, mandatory wording critical, distinct capabilities stay apart, French excerpts are copied, and
// each posting takes one extraction call within the latency budget.
describe('Job Posting extraction representative evaluation', () => {
  it('extracts every representative Job Posting without a failed check', async () => {
    const failures = await readLiveSourceFailures({ source: jobPostingExtractionSource })

    expect(failures).toEqual([])
  }, 300_000)
})
