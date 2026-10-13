import { describe, expect, it } from 'vitest'
import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'

import { checkDocumentLanguage } from './document-language'

describe('the language a prepared document is written in', () => {
  it('passes every prose field written in the requested language', () => {
    const document = createDocument({ achievements: [
      'Conception et développement d\'une plateforme de paiement avec TypeScript pour les équipes produit',
      'Mise en place des tests de bout en bout dans la chaîne d\'intégration continue',
    ] })

    const checks = checkDocumentLanguage({ document, locale: 'fr' })

    expect(checks).toEqual([
      { name: 'achievement-0 is written in fr', passed: true },
      { name: 'achievement-1 is written in fr', passed: true },
    ])
  })

  it.each([
    { locale: 'fr', failed: { name: 'achievement-1 is written in fr', passed: false } },
    { locale: 'en', failed: { name: 'achievement-0 is written in en', passed: false } },
  ] as const)('fails a prose field left in another language than $locale', ({ failed, locale }) => {
    const document = createDocument({ achievements: [
      'Conception et développement d\'une plateforme de paiement avec TypeScript pour les équipes produit',
      'Built the end-to-end test suite for the payments platform and ran it in the CI pipeline',
    ] })

    const checks = checkDocumentLanguage({ document, locale })

    expect(checks.filter(({ passed }) => !passed)).toEqual([failed])
  })

  it('skips fields too short or too neutral to tell, such as a list of tools', () => {
    const document = createDocument({ achievements: ['TypeScript, React, Node.js', 'Kubernetes Terraform AWS GitHub Actions Datadog'] })

    const checks = checkDocumentLanguage({ document, locale: 'fr' })

    expect(checks).toEqual([])
  })

  it.each(['education', 'certifications'] as const)('skips %s, whose official names may stay in their own language', (section) => {
    const document = createDocument({ achievements: [], sections: [{ section, fields: [
      'Licence professionnelle Développement Web de l\'Université de Lille, 2018',
      'Professional Licence in Web Development (Licence professionnelle Développement Web de l\'Université de Lille), 2018',
    ].map((text, index) => ({ id: `${section}-${String(index)}`, text, factIds: ['source-fact-0'] })) }] })

    const checks = checkDocumentLanguage({ document, locale: 'en' })

    expect(checks).toEqual([])
  })
})

function createDocument({ achievements, sections = [] }: Readonly<{
  achievements: readonly string[]
  sections?: ProfessionalResumeDocument['sections']
}>): ProfessionalResumeDocument {
  return {
    purpose: 'tailored', locale: 'fr', targetRole: null,
    valueProposition: { kind: 'prose', paragraphs: [] },
    experiences: [{ id: 'experiences.0', chronology: 'relevant', role: null, organization: null, startDate: null,
      endDate: null, context: null, achievements: achievements.map((text, index) => ({ id: `achievement-${String(index)}`,
        text, factIds: ['source-fact-0'] })) }],
    sections,
  }
}
