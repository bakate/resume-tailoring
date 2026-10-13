import { describe, expect, it } from 'vitest'

import { readLiveSourceFailures } from '../../model-evaluation/live-source-evaluation'
import { matchEvidenceSource } from '../../model-evaluation/match-evidence-evaluation'

// Live run of the `match-evidence` source, the one the qualification runner records: Requirement Coverage judged by the
// model and verified by the engine. Positive cases measure recall; traps must never receive more coverage than the
// rules allow, and a related but distinct capability must surface as Adjacent Evidence next to its gap.
describe('Job Match evidence live evaluation', () => {
  it('finds expected coverage, never covers a trap, and reports expected Adjacent Evidence', async () => {
    const failures = await readLiveSourceFailures({ source: matchEvidenceSource })

    expect(failures).toEqual([])
  }, 600_000)
})
