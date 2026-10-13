import { describe, expect, it } from 'vitest'

import { readLiveSourceFailures } from './live-source-evaluation'
import { injectedJobPosting, injectedResume, jobPostingInjection, resumeInjection } from './prompt-injection-corpus'
import { promptInjectionSource } from './prompt-injection-evaluation'

// Live run of the `prompt-injection` source, the one the qualification runner records: a line aimed at the model inside
// a Job Posting or Source Document changes neither the Match Analysis nor the Source Profile (OWASP LLM01, BAK-151).
// Each document runs clean and injected through the production prompts. The injected run must not do what its lines
// ask: no injected content, skill or entry in the Source Profile, no injected Job Requirement, and the Kubernetes
// requirement the Candidate cannot prove stays uncovered. Two runs of the same document already differ in Match Score,
// coverage and importance, so nothing else is compared.
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
