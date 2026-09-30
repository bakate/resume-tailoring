import { unavailableResumeRender } from '@resume-tailoring/application/candidate-journey'
import type { ResumeRenderRequest } from '@resume-tailoring/application/candidate-journey'
import { describe, expect, it } from 'vitest'

import { crossSegmentQualificationCorpus } from './cross-segment-corpus'
import { createQualificationResume, findUnsupportedFields, qualifyCrossSegmentDocuments } from './cross-segment-document-qualification'

describe('cross-segment document qualification harness', () => {
  it('fails PDF export validity in every scope when rendering is unavailable', async () => {
    const report = await qualifyCrossSegmentDocuments({ corpus: crossSegmentQualificationCorpus, split: 'held-out',
      renderDocument: (request: ResumeRenderRequest) => Promise.resolve(unavailableResumeRender(request)) })

    expect(report.passed).toBe(false)
    expect(report.overall.pdfExportValidity).toEqual({ passed: false, threshold: 1, value: 0 })
    expect(Object.values(report.roleFamilies).every(({ pdfExportValidity }) => !pdfExportValidity.passed)).toBe(true)
    expect(report.outcomes.every(({ exportBlockers }) => exportBlockers.includes('layout-unavailable'))).toBe(true)
  })

  it('reports a professional statement whose number is absent from the cited evidence', () => {
    const fixture = crossSegmentQualificationCorpus.fixtures.find(({ relevantFactIds }) => relevantFactIds.length > 0)
    if (fixture === undefined) throw new Error('The corpus needs a scenario with relevant evidence')
    const document = createQualificationResume({ fixture })
    const inflated = { ...document, valueProposition: { ...document.valueProposition,
      paragraphs: document.valueProposition.paragraphs.map((paragraph) => ({ ...paragraph, text: `${paragraph.text} Led 40 people.` })) } }

    expect(findUnsupportedFields({ document, fixture })).toEqual([])
    expect(findUnsupportedFields({ document: inflated, fixture })).toEqual(['summary'])
  })

  it('writes a non-tailored reference document when a scenario has no relevant evidence', () => {
    const fixture = crossSegmentQualificationCorpus.fixtures.find(({ relevantFactIds }) => relevantFactIds.length === 0)
    if (fixture === undefined) throw new Error('The corpus needs a scenario without relevant evidence')

    expect(createQualificationResume({ fixture })).toMatchObject({ purpose: 'normalized', targetRole: null,
      valueProposition: { kind: 'evidence-excerpts', paragraphs: [] } })
  })
})
