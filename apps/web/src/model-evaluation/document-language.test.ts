import { describe, expect, it } from 'vitest'
import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'

import { checkDocumentLanguage } from './document-language'

describe('the language a prepared document is written in', () => {
  it('passes every prose field written in the requested language', () => {
    const document = createDocument({ achievements: [
      'Conception et développement d\'une plateforme de paiement avec TypeScript pour les équipes produit',
      'Mise en place des tests de bout en bout dans la chaîne d\'intégration continue',
    ] })

    expect(checkDocumentLanguage({ document, locale: 'fr' })).toEqual([
      { name: 'achievement-0 is written in fr', passed: true },
      { name: 'achievement-1 is written in fr', passed: true },
    ])
  })

  it('fails a prose field left in another language', () => {
    const document = createDocument({ achievements: [
      'Conception et développement d\'une plateforme de paiement avec TypeScript pour les équipes produit',
      'Built the end-to-end test suite for the payments platform and ran it in the CI pipeline',
    ] })

    expect(checkDocumentLanguage({ document, locale: 'fr' }).filter(({ passed }) => !passed))
      .toEqual([{ name: 'achievement-1 is written in fr', passed: false }])
    expect(checkDocumentLanguage({ document, locale: 'en' }).filter(({ passed }) => !passed))
      .toEqual([{ name: 'achievement-0 is written in en', passed: false }])
  })

  it('skips fields too short or too neutral to tell, such as a list of tools', () => {
    const document = createDocument({ achievements: ['TypeScript, React, Node.js', 'Kubernetes Terraform AWS GitHub Actions Datadog'] })

    expect(checkDocumentLanguage({ document, locale: 'fr' })).toEqual([])
  })
})

function createDocument({ achievements }: Readonly<{ achievements: readonly string[] }>): ProfessionalResumeDocument {
  return {
    purpose: 'tailored', locale: 'fr', targetRole: null,
    valueProposition: { kind: 'prose', paragraphs: [] },
    experiences: [{ id: 'experiences.0', chronology: 'relevant', role: null, organization: null, startDate: null,
      endDate: null, context: null, achievements: achievements.map((text, index) => ({ id: `achievement-${String(index)}`,
        text, factIds: ['source-fact-0'] })) }],
    sections: [],
  }
}
