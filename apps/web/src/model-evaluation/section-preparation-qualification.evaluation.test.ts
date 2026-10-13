import { describe, expect, it } from 'vitest'

import { readLiveSourceFailures } from './live-source-evaluation'
import { sectionPreparationSource } from './section-preparation-evaluation'

// Live run of the `section-preparation` source, the one the qualification runner records.
describe('section-by-section preparation on a real-sized resume', () => {
  it('writes every section and the whole preparation within the latency budgets, with no unsupported Resume Claim', async () => {
    const failures = await readLiveSourceFailures({ source: sectionPreparationSource })

    expect(failures).toEqual([])
  }, 900_000)
})
