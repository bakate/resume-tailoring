import { describe, expect, it } from 'vitest'

import { preparationProgressPhases } from '@resume-tailoring/application/candidate-journey'
import type { PreparationProgress } from '@resume-tailoring/application/candidate-journey'
import { locales } from '../localization/localization'
import type { Locale } from '../localization/localization'
import { renderLocalizedMarkup } from './localized-markup'
import { PreparationPhaseStatus } from './preparation-phase-status'

describe('Preparation phase status', () => {
  it.each(locales)('names every preparation phase with its own label in %s', (locale) => {
    const phases = preparationProgressPhases

    const labels = phases.map((phase) => readText(renderStatus({ locale, progress: { phase, sections: [], sectionCount: null } })))

    expect(new Set(labels).size).toBe(phases.length)
    expect(labels.filter((label) => label.length === 0 || label.includes('preparationPhase.'))).toEqual([])
  })

  it('labels each phase differently in each interface language', () => {
    const phases = preparationProgressPhases

    const [english, french] = locales.map((locale) => phases.map((phase) =>
      readText(renderStatus({ locale, progress: { phase, sections: [], sectionCount: null } }))))

    expect(english?.filter((label, index) => label === french?.[index])).toEqual([])
  })

  it.each(locales)('names no model, provider or AI in %s', (locale) => {
    const phases = preparationProgressPhases

    const labels = phases.map((phase) => readText(renderStatus({ locale, progress: { phase, sections: [], sectionCount: null } })))

    expect(labels.filter((label) => /\b(AI|IA|model|modèle|LLM|GPT|DeepSeek|OpenAI|provider|fournisseur)\b/iu.test(label))).toEqual([])
  })

  it.each([
    ['en', '3 of 8 sections written'],
    ['fr', '3 rubriques rédigées sur 8'],
  ] as const)('shows the Resume Sections written out of the total in %s', (locale, count) => {
    const progress = { phase: 'resume-sections', sections: [], sectionCount: { written: 3, total: 8 } } as const

    const markup = renderStatus({ locale, progress })

    expect(readText(markup)).toContain(count)
  })

  it('keeps the line of the section count before the sections are planned, so nothing shifts when they are', () => {
    const progress = { phase: 'job-posting-extraction', sections: [], sectionCount: null } as const

    const markup = renderStatus({ locale: 'en', progress })

    expect(markup).toContain('preparation-phase-status-count')
  })

  it('leaves announcing the phase to the polite status region', () => {
    const progress = { phase: 'coherence', sections: [], sectionCount: null } as const

    const markup = renderStatus({ locale: 'en', progress })

    expect(markup).not.toMatch(/aria-live|role="(status|alert)"/u)
  })
})

function renderStatus({ locale, progress }: Readonly<{ locale: Locale; progress: PreparationProgress }>) {
  return renderLocalizedMarkup({ locale, render: (localization) => <PreparationPhaseStatus {...{ localization, progress }} /> })
}

function readText(markup: string) {
  return markup.replace(/<[^>]+>/gu, '').replaceAll('&nbsp;', ' ').replaceAll(' ', ' ').trim()
}
