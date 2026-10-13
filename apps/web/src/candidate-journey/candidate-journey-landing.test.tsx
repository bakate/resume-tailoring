import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { ProcessingPolicy } from '@resume-tailoring/application/language-model-gateway'
import type { Locale } from '../localization/localization'
import { LocalizationProvider } from '../localization/localization'
import { createProcessingPolicy } from '../processing-policy'
import { CandidateJourneyLanding } from './candidate-journey-shell'

/** The landing is rendered by the server before any Candidate Journey, so what it states is read in its static markup. */
describe('Candidate Journey landing', () => {
  it.each([
    ['en', 'DeepSeek processes and stores your professional content in China (outside the European Union).'],
    ['fr', 'DeepSeek traite et stocke ton contenu professionnel en Chine (hors de l’Union européenne).'],
  ] as const)('states in %s, outside "Learn more", that DeepSeek processes in China', (locale, statement) => {
    const processingPolicy = createProcessingPolicy({ provider: 'deepseek' })

    const markup = renderLanding({ locale, processingPolicy })

    expect(readOutsideLearnMore(markup)).toContain(statement)
  })

  it('translates every DeepSeek policy statement behind "Learn more"', () => {
    const processingPolicy = createProcessingPolicy({ provider: 'deepseek' })

    const markup = renderLanding({ locale: 'fr', processingPolicy })

    expect([processingPolicy.processingCountry, processingPolicy.retentionPolicy, processingPolicy.storageBehavior]
      .filter((statement) => statement !== undefined && markup.includes(statement))).toEqual([])
  })

  it('states no processing country for a provider whose policy does not name one', () => {
    const processingPolicy = createProcessingPolicy({ provider: 'openai' })

    const markup = renderLanding({ locale: 'en', processingPolicy })

    expect(markup).not.toMatch(/stores your professional content in|Processing country/u)
  })
})

function renderLanding({ locale, processingPolicy }: Readonly<{
  locale: Locale
  processingPolicy: ProcessingPolicy
}>) {
  return renderToStaticMarkup(<MantineProvider><LocalizationProvider renderedLocale={locale}>
    <CandidateJourneyLanding processingPolicy={processingPolicy} />
  </LocalizationProvider></MantineProvider>).replaceAll('&#x27;', '\'')
}

function readOutsideLearnMore(markup: string) {
  return markup.replace(/<details>.*<\/details>/su, '')
}
