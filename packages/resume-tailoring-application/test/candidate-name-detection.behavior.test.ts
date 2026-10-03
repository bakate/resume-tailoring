import { describe, expect, it } from 'vitest'

import { createSourceIntake } from '@resume-tailoring/application/source-intake'
import type { StructuredSourceProfileExtraction } from '@resume-tailoring/application/source-intake'
import { readLocalResumeContacts } from '@resume-tailoring/application/tailored-resume'

describe('Local Candidate name detection', () => {
  it('detects the name on the first line', async () => {
    const system = createSystemUnderTest()

    await system.readSource('Alex Morgan\nalex@example.com\nFrontend Engineer at Northwind.')

    system.expectDetectedName('Alex Morgan')
  })

  it('detects the name next to the contact details when a role title comes first', async () => {
    const system = createSystemUnderTest()

    await system.readSource('Senior Frontend Engineer\nAlex Morgan\nalex@example.com · 06 12 34 56 78\nBuilt accessible billing screens.')

    system.expectDetectedName('Alex Morgan')
  })

  it('detects the name that shares its line with other header details', async () => {
    const system = createSystemUnderTest()

    await system.readSource([
      'Alex MORGAN   📍   12, Rue Exemple. 75003 Paris ',
      'Développeur   Full-Stack   📞   +33 6 12 34 56 78 |   ✉   alex@example.com ',
      'Ingénieur Full-Stack avec plus de 5 ans d’expérience.',
    ].join('\n'))

    system.expectDetectedName('Alex MORGAN')
  })

  it('detects an upper-case name', async () => {
    const system = createSystemUnderTest()

    await system.readSource('ALEX MORGAN\nalex@example.com\nFrontend Engineer at Northwind.')

    system.expectDetectedName('ALEX MORGAN')
  })

  it('detects no name when the resume does not start with one', async () => {
    const system = createSystemUnderTest()

    await system.readSource('Frontend Engineer at Northwind\nalex@example.com\nBuilt accessible billing screens with React.')

    system.expectNoDetectedName()
  })

  it('does not take the name of a person quoted in a recommendation', async () => {
    const system = createSystemUnderTest()

    await system.readSource([
      'Frontend Engineer',
      'Built accessible billing screens with React and TypeScript.',
      'Led the migration of the design system to accessible components.',
      'Mentored four engineers across two product teams.',
      'Recommendations',
      '“Alex shipped the billing redesign ahead of schedule.”',
      'Jordan Smith',
      'jordan.smith@northwind.example',
    ].join('\n'))

    system.expectNoDetectedName()
  })

  it.each([
    'Data Scientist\nalex@example.com\nBuilt forecasting models.',
    'Work Experience\nalex@example.com\nFrontend Engineer at Northwind.',
    'Professional Summary\nalex@example.com\nFrontend Engineer at Northwind.',
    'Expérience Professionnelle\nalex@example.com\nDéveloppeuse chez Northwind.',
    'Contact Information\nalex@example.com\nFrontend Engineer at Northwind.',
  ])('does not take a section heading or a role for a name: %s', async (source) => {
    const system = createSystemUnderTest()

    await system.readSource(source)

    system.expectNoDetectedName()
  })

  it('keeps every occurrence of the detected name out of model-bound text', async () => {
    const system = createSystemUnderTest()

    await system.readSource('Alex Morgan\nalex@example.com\nFrontend Engineer. alex morgan led the billing redesign.')

    system.expectNameAbsentFromModelBoundText('Alex Morgan')
  })
})

function createSystemUnderTest() {
  return new CandidateNameDetectionSystem()
}

class CandidateNameDetectionSystem {
  readonly #modelBoundText: string[] = []
  #identity: ReturnType<typeof readLocalResumeContacts>['identity'] | undefined

  async readSource(text: string) {
    const result = await createSourceIntake({
      document: { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'resume.txt' },
      sourceDocumentReader: { read: () => Promise.resolve({ ok: true, value: { pageCount: null, text } }) },
      sourceProfileExtractor: { extract: ({ professionalContent }) => {
        this.#modelBoundText.push(professionalContent)
        return Promise.resolve({ ok: true, value: extraction })
      } },
    })
    if (!result.ok) throw new Error(`Source intake failed: ${result.error}`)
    this.#identity = readLocalResumeContacts({ sourceIntake: result.value }).identity
  }

  expectDetectedName(name: string) {
    expect(this.#identity).toEqual({ kind: 'personal-information', value: name, origin: 'detected' })
  }

  expectNoDetectedName() {
    expect(this.#identity).toBeNull()
  }

  expectNameAbsentFromModelBoundText(name: string) {
    expect(this.#modelBoundText).toHaveLength(1)
    expect(this.#modelBoundText[0]?.toLowerCase()).not.toContain(name.toLowerCase())
    expect(this.#modelBoundText[0]).toContain('led the billing redesign')
  }
}

const extraction: StructuredSourceProfileExtraction = {
  certifications: [], criticalAmbiguities: [], education: [], languages: [], projects: [],
  experiences: [{ achievements: ['Built accessible billing screens'], context: null, endDate: null,
    organization: 'Northwind', role: 'Frontend Engineer', startDate: null }],
  skills: [],
}
