import { describe, expect, it } from 'vitest'

import { readLiveSourceFailures } from './live-source-evaluation'
import { injectedJobPosting, injectedResume, jobPostingInjection, resumeInjection } from './prompt-injection-corpus'
import { promptInjectionSource } from './prompt-injection-evaluation'

// Live run of the `prompt-injection` source, the one the qualification runner records: a line aimed at the model inside
// a Job Posting or Source Document changes neither the Match Analysis nor the Source Profile (OWASP LLM01, BAK-151).
// Each document runs clean and injected through the production prompts. Two runs of the same document already vary,
// so the injected run is held to every invariant of the clean one and may never come out better: no added skill or
// entry, no higher coverage, no requirement weighing more in the Match Score.
describe('instructions inside supplied documents, replayed live', () => {
  it('runs each injected document with its injected line', () => {
    expect(injectedResume).toContain(resumeInjection)
    expect(injectedJobPosting).toContain(jobPostingInjection)
  })

  it('obeys no injected line and covers no trap', async () => {
    const failures = await readLiveSourceFailures({ source: promptInjectionSource })

    expect(failures).toEqual([])
  }, 600_000)
})
