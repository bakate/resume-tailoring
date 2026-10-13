import { describe, expect, it } from 'vitest'

import { readLiveSourceFailures } from './live-source-evaluation'
import { resumeCoherenceFixtures, resumeCoherenceSource } from './resume-coherence-evaluation'

// Live run of the `resume-coherence` source, the one the qualification runner records: both DeepSeek models chained a
// Contoso achievement under the Fabrikam role in 3 of 4 Value Propositions (BAK-171). Each proposition cites real
// Candidate Facts, so field validation accepts it, and the coherence check is the only net. It must flag the mixed
// association in English and in French, and leave the faithful proposition alone.
describe('a cross-employer Value Proposition, checked live', () => {
  it('checks a mixed Value Proposition in English and in French, and one faithful one', () => {
    const fixtures = resumeCoherenceFixtures

    expect(fixtures.map(({ document, mixesEmployers }) => [document.locale, mixesEmployers]))
      .toEqual([['en', true], ['fr', true], ['en', false]])
  })

  it('flags each mixed association and spares the faithful proposition', async () => {
    const failures = await readLiveSourceFailures({ source: resumeCoherenceSource })

    expect(failures).toEqual([])
  }, 600_000)
})
