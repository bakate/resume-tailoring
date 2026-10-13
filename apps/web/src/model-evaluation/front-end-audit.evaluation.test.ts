import { describe, expect, it } from 'vitest'

import { frontEndAuditSource } from './front-end-audit-evaluation'
import { readLiveSourceFailures } from './live-source-evaluation'

// Live run of the `front-end-audit` source, the one the qualification runner records: the audited front-end run
// (BAK-139) replayed through the production extraction, Match Analysis and section-by-section preparation, in French
// and in English. Each defect the audit saw is one check of the source.
describe('audited front-end run, replayed live', () => {
  it('writes both documents without any defect the audit saw', async () => {
    const failures = await readLiveSourceFailures({ source: frontEndAuditSource })

    expect(failures).toEqual([])
  }, 900_000)
})
