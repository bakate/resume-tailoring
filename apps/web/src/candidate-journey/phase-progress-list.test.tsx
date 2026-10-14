import { describe, expect, it } from 'vitest'

import { renderLocalizedMarkup } from './localized-markup'
import { PhaseProgressList } from './phase-progress-list'

describe('Phase progress list', () => {
  it('marks the current phase without a spinner, leaving the only spinner to the step under way', () => {
    const markup = renderLocalizedMarkup({ locale: 'en',
      render: (localization) => <PhaseProgressList activePhase="tailored-resume-preparation" localization={localization} /> })

    expect(markup).toContain('aria-current="step"')
    expect(markup).not.toMatch(/tabler-icon-loader/u)
  })
})
