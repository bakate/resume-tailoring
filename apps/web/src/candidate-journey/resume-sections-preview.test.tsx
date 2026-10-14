import { describe, expect, it } from 'vitest'

import type { ResumeSectionSnapshot } from '@resume-tailoring/application/candidate-journey'
import type { Locale } from '../localization/localization'
import { renderLocalizedMarkup } from './localized-markup'
import { ResumeSectionsPanel } from './resume-sections-preview'

const validatedEducation: ResumeSectionSnapshot = { key: 'education', kind: 'education', attempt: 1, status: 'validated',
  content: { kind: 'education', fields: [{ id: 'education-1', factIds: [], text: 'Computer Science degree' }] } }
const plannedSkills: ResumeSectionSnapshot = { key: 'skills', kind: 'skills', attempt: 0, status: 'planned' }

describe('Resume Sections preview', () => {
  it.each([
    ['en', 'Not final', 'may still change'],
    ['fr', 'Provisoire', 'peuvent encore changer'],
  ] as const)('marks the validated sections of a running preparation as not final in %s', (locale, marker, description) => {
    const sections = [validatedEducation, plannedSkills]

    const markup = renderPanel({ locale, sections, state: 'preparing' })

    expect(markup).toContain('Computer Science degree')
    expect(markup).toContain(marker)
    expect(markup).toContain(description)
  })

  it('shows validated sections read-only, with a placeholder holding the place of the others', () => {
    const sections = [validatedEducation, plannedSkills]

    const markup = renderPanel({ locale: 'en', sections, state: 'preparing' })

    expect(markup).not.toMatch(/<(input|textarea|select|button)\b|contenteditable/u)
    expect(markup).toContain('Writing Skills…')
  })

  it('does not mark the sections a failed preparation kept as not final', () => {
    const sections = [validatedEducation]

    const markup = renderPanel({ locale: 'en', sections, state: 'kept' })

    expect(markup).toContain('Computer Science degree')
    expect(markup).not.toContain('Not final')
  })
})

function renderPanel({ locale, sections, state }: Readonly<{
  locale: Locale; sections: readonly ResumeSectionSnapshot[]; state: 'preparing' | 'kept'
}>) {
  return renderLocalizedMarkup({ locale, render: (localization) => <ResumeSectionsPanel {...{ localization, sections, state }}
    naming={{ sourceIntake: null }} resumeLocale="en" /> })
}
