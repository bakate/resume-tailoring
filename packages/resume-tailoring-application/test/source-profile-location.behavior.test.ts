import { describe, expect, it } from 'vitest'

import { createSourceIntake } from '@resume-tailoring/application/source-intake'
import type { SourceIntake, StructuredSourceProfileExtraction } from '@resume-tailoring/application/source-intake'
import { createFakeSourceDocumentReader, createFakeSourceProfileExtractor } from '@resume-tailoring/application/testing'

describe('Experience location from the Source Document', () => {
  it('keeps the location exactly as the source writes it', async () => {
    const system = createSystemUnderTest()

    await system.readSource({ text: sourceText, extractedLocation: 'paris,  france' })

    system.expectLocation('Paris, France')
  })

  it('drops a location the source does not contain', async () => {
    const system = createSystemUnderTest()

    await system.readSource({ text: sourceText, extractedLocation: 'Lyon, France' })

    system.expectNoLocation()
  })
})

function createSystemUnderTest() {
  return new SourceProfileLocationSystem()
}

class SourceProfileLocationSystem {
  #sourceIntake: SourceIntake | null = null

  async readSource({ text, extractedLocation }: Readonly<{ text: string; extractedLocation: string }>) {
    const extraction = createExtraction({ location: extractedLocation })
    const result = await createSourceIntake({
      document: { bytes: new TextEncoder().encode(text), mediaType: 'text/plain', name: 'resume.txt' },
      sourceDocumentReader: createFakeSourceDocumentReader(),
      sourceProfileExtractor: createFakeSourceProfileExtractor({ extract: () => Promise.resolve({ ok: true, value: extraction }) }),
    })
    if (!result.ok) throw new Error(`Source intake failed: ${result.error}`)
    this.#sourceIntake = result.value
  }

  expectLocation(location: string) {
    expect(this.#sourceIntake?.sourceProfile.experiences[0]?.location).toBe(location)
    expect(this.#locationFacts()).toEqual([location])
  }

  expectNoLocation() {
    expect(this.#sourceIntake?.sourceProfile.experiences[0]?.location).toBeNull()
    expect(this.#locationFacts()).toEqual([])
  }

  #locationFacts() {
    return this.#sourceIntake?.candidateFacts.filter(({ path }) => path.startsWith('experiences.0.location.'))
      .map(({ value }) => value)
  }
}

const sourceText = 'Frontend Engineer at Northwind\nParis, France\nBuilt accessible billing screens.'

function createExtraction({ location }: Readonly<{ location: string }>): StructuredSourceProfileExtraction {
  return {
    certifications: [], criticalAmbiguities: [], education: [], languages: [], projects: [], skills: [],
    experiences: [{ achievements: ['Built accessible billing screens'], context: null, endDate: null,
      location, organization: 'Northwind', role: 'Frontend Engineer', startDate: null }],
  }
}
