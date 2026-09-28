import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { Localization } from '../localization/localization'
import { MatchAnalysisWorkspace } from './match-analysis-workspace'
import type { CandidateSessionController } from './use-candidate-session'

describe('MatchAnalysisWorkspace', () => {
  it('leads with the decision summary and keeps complete Match Evidence expandable', () => {
    const html = renderToStaticMarkup(<MatchAnalysisWorkspace
      candidateSession={createCandidateSession()}
      localization={createLocalization()} />)

    expect(html).toContain('matchAnalysis.band.strong')
    expect(html).toContain('matchAnalysis.practicalConstraints')
    expect(html).toContain('Hybrid work in Paris')
    expect(html).toContain('Mention CI/CD conventions')
    expect(html).toContain('<summary>matchAnalysis.showDetails</summary>')

    const strengths = readListAfter({ html, title: 'matchAnalysis.strengthTitle' })
    expect(strengths).toContain('Professional strength 1')
    expect(strengths).toContain('Professional strength 3')
    expect(strengths).not.toContain('Professional strength 4')

    const gaps = readListAfter({ html, title: 'matchAnalysis.gapTitle' })
    expect(gaps).toContain('Professional gap 1')
    expect(gaps).toContain('Professional gap 3')
    expect(gaps).not.toContain('Professional gap 4')
    expect(gaps).toContain('matchAnalysis.coverage.partial')
    expect(gaps).toContain('matchAnalysis.coverage.uncovered')
  })

  it('shows the Match Score before at most three optional highest-impact prompts', () => {
    const html = renderToStaticMarkup(<MatchAnalysisWorkspace
      candidateSession={createCandidateSession()}
      localization={createLocalization()} />)

    const enrichment = html.split('id="profile-enrichment-title"')[1] ?? ''
    const promptValues = [...enrichment.matchAll(
      /<form class="profile-enrichment-prompt">.*?<strong>(.*?)<\/strong>/g,
    )].map((match) => match[1])
    expect(html.indexOf('class="match-score"')).toBeLessThan(
      html.indexOf('id="profile-enrichment-title"'),
    )
    expect(enrichment.match(/matchAnalysis\.enrichmentQuestion/g)).toHaveLength(3)
    expect(promptValues).toEqual([
      'Professional gap 2', 'Professional gap 3', 'Professional gap 4',
    ])
    expect(enrichment.match(/matchAnalysis\.enrichmentSkip/g)).toHaveLength(3)
    expect(html).toContain('resumeClaims.generate')
  })
})

function readListAfter({ html, title }: Readonly<{ html: string; title: string }>) {
  return html.split(`<h4 id="match-gap-title">${title}</h4>`)[1]?.split('</ul>')[0]
    ?? html.split(`<h4>${title}</h4>`)[1]?.split('</ul>')[0]
    ?? ''
}

function createCandidateSession() {
  const professionalRequirements = Array.from({ length: 8 }, (_unusedValue, requirementIndex) => ({
    classification: 'required' as const,
    groupId: `job-requirement-group-${String(requirementIndex)}` as const,
    id: `job-requirement-${String(requirementIndex)}` as const,
    sourceExcerpt: `Professional requirement ${String(requirementIndex + 1)}`,
    value: requirementIndex < 3
      ? `Professional strength ${String(requirementIndex + 1)}`
      : `Professional gap ${String(requirementIndex - 2)}`,
  }))
  const facts = professionalRequirements.slice(0, 4).map((requirement, factIndex) => ({
    id: `source-fact-${String(factIndex)}` as const,
    kind: 'experience' as const,
    propositionKey: `proposition-${String(factIndex)}` as const,
    status: 'verified' as const,
    value: requirement.value,
  }))
  return {
    pendingOperation: null,
    generateResumeClaims: () => undefined,
    view: {
      status: 'ready',
      sessionId: 'candidate-session-test',
      expiresAt: 1,
      sourceProfile: {
        status: 'reviewing-facts',
        documentName: 'resume.pdf',
        detectedSensitiveContent: [],
        outgoingContent: 'Professional profile',
        processingNotice: null,
        facts,
      },
      jobPosting: {
        status: 'reviewing-requirements',
        detectedSensitiveContent: [],
        outgoingContent: 'Job Posting',
        processingNotice: null,
        practicalConstraints: [{
          sourceExcerpt: 'Hybrid work in Paris',
          value: 'Hybrid work in Paris',
        }],
        requirements: professionalRequirements,
      },
      matchAnalysis: {
        evidence: professionalRequirements.slice(0, 4).map((requirement, factIndex) => ({
          coverage: factIndex < 3 ? 'covered' as const : 'partially-covered' as const,
          requirementId: requirement.id,
          factIds: [`source-fact-${String(factIndex)}` as const],
        })),
        gapAnalysis: {
          partiallyCoveredRequiredRequirementIds: ['job-requirement-3' as const],
          uncoveredRequiredRequirementIds: professionalRequirements.slice(4).map(({ id }) => id),
        },
        generationEligibility: 'eligible',
        improvementOpportunities: ['Mention CI/CD conventions'],
        matchScore: 78,
        relevantFactIds: facts.map(({ id }) => id),
        warning: null,
      },
    },
  } as unknown as CandidateSessionController
}

function createLocalization(): Localization {
  return {
    locale: 'en',
    preferencePersistenceError: null,
    readiness: 'ready',
    selectLocale: () => undefined,
    translate: (key) => key,
  }
}
