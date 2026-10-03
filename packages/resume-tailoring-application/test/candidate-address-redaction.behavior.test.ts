import { describe, expect, it } from 'vitest'

import { createSourceIntake } from '@resume-tailoring/application/source-intake'
import type { SourceIntake, StructuredSourceProfileExtraction } from '@resume-tailoring/application/source-intake'
import { createFakeSourceDocumentReader, createFakeSourceProfileExtractor } from '@resume-tailoring/application/testing'

describe('Local postal address redaction', () => {
  it('keeps an address marked by a location icon out of model-bound text', async () => {
    const system = createSystemUnderTest()

    await system.readSource([
      'Alex MORGAN   📍   12, Rue Exemple. 75003 Paris ',
      'Développeur   Full-Stack   📞   +33 6 12 34 56 78 |   ✉   alex@example.com ',
      'Ingénieur Full-Stack avec plus de 5 ans d’expérience.',
    ].join('\n'))

    system.expectAddressKeptLocally('12, Rue Exemple. 75003 Paris')
  })

  it('keeps an unlabeled street address in the resume header out of model-bound text', async () => {
    const system = createSystemUnderTest()

    await system.readSource('Alex Morgan\n12 bis rue de la Paix, 75002 Paris\nalex@example.com\nFrontend Engineer at Northwind.')

    system.expectAddressKeptLocally('12 bis rue de la Paix, 75002 Paris')
  })

  it('keeps a postcode and city in the resume header out of model-bound text', async () => {
    const system = createSystemUnderTest()

    await system.readSource('Alex Morgan · 94600 Choisy-Le-Roi · alex@example.com\nFrontend Engineer at Northwind.')

    system.expectAddressKeptLocally('94600 Choisy-Le-Roi')
  })

  it('leaves professional content that only resembles an address untouched', async () => {
    const system = createSystemUnderTest()
    const professionalContent = [
      'Built dashboards used by 10000 Users across 30 points de vente.',
      'Opened the 75003 Paris office for Northwind.',
      'Moved 3 place settings into one reusable component.',
    ]

    await system.readSource(['Alex Morgan', 'alex@example.com', 'Experience', 'Northwind', 'Frontend Engineer',
      'Customer billing team', ...professionalContent].join('\n'))

    system.expectSentUnchanged(professionalContent)
  })
})

function createSystemUnderTest() {
  return new CandidateAddressRedactionSystem()
}

class CandidateAddressRedactionSystem {
  readonly #modelBoundText: string[] = []
  #sourceIntake: SourceIntake | null = null

  async readSource(text: string) {
    const result = await createSourceIntake({
      document: { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'resume.txt' },
      sourceDocumentReader: createFakeSourceDocumentReader(),
      sourceProfileExtractor: createFakeSourceProfileExtractor({ extract: ({ professionalContent }) => {
        this.#modelBoundText.push(professionalContent)
        return Promise.resolve({ ok: true, value: extraction })
      } }),
    })
    if (!result.ok) throw new Error(`Source intake failed: ${result.error}`)
    this.#sourceIntake = result.value
  }

  expectAddressKeptLocally(address: string) {
    expect(this.#modelBoundText).toHaveLength(1)
    for (const part of address.split(/[\s,.]+/u).filter((word) => word.length > 2)) {
      expect(this.#modelBoundText[0], `"${part}" is never sent`).not.toContain(part)
    }
    expect(this.#sourceIntake?.contactDetails).toContainEqual({ kind: 'address', value: address })
  }

  expectSentUnchanged(lines: readonly string[]) {
    expect(this.#modelBoundText).toHaveLength(1)
    for (const line of lines) expect(this.#modelBoundText[0]).toContain(line)
    expect(this.#sourceIntake?.contactDetails.filter(({ kind }) => kind === 'address')).toEqual([])
  }
}

const extraction: StructuredSourceProfileExtraction = {
  certifications: [], criticalAmbiguities: [], education: [], languages: [], projects: [],
  experiences: [{ achievements: ['Built accessible billing screens'], context: null, endDate: null,
    organization: 'Northwind', role: 'Frontend Engineer', startDate: null }],
  skills: [],
}
