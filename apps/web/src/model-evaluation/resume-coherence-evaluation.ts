import type { ProfessionalResumeDocument } from '@resume-tailoring/application/candidate-journey'

import { createModelResumeCoherenceChecker } from '../adapters/server/model-resume-section-models'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'

export const valuePropositionFieldId = 'value-proposition-0'

type Locale = ProfessionalResumeDocument['locale']

/**
 * The Candidate of the BAK-171 spike, reduced to the two employers both DeepSeek models chained in 3 of 4 Value
 * Propositions: Fabrikam, where the Candidate is Staff Platform Engineer, and Contoso, where they were Senior SRE.
 */
const experiences = {
  en: [
    { organization: 'Fabrikam', role: 'Staff Platform Engineer', startDate: '2021', endDate: 'Present',
      achievement: 'Cut deployment time from 40 to 12 minutes by building a shared CI platform for 30 teams' },
    { organization: 'Contoso', role: 'Senior SRE', startDate: '2017', endDate: '2021',
      achievement: 'Led the incident response programme that reduced major outages by 45%' },
  ],
  fr: [
    { organization: 'Fabrikam', role: 'Staff Platform Engineer', startDate: '2021', endDate: 'Aujourd’hui',
      achievement: 'Réduction du temps de déploiement de 40 à 12 minutes grâce à une plateforme CI partagée par 30 équipes' },
    { organization: 'Contoso', role: 'Senior SRE', startDate: '2017', endDate: '2021',
      achievement: 'Pilotage du programme de réponse aux incidents qui a réduit les pannes majeures de 45 %' },
  ],
} as const satisfies Record<Locale, readonly unknown[]>

/**
 * Each Value Proposition cites both achievements' Candidate Facts, so field validation accepts it: only the coherence
 * check can see that a mixed one places the Contoso achievement under the Fabrikam role.
 */
export const resumeCoherenceFixtures = [
  { id: 'mixed-association-en', mixesEmployers: true, document: createDocument({ locale: 'en', valueProposition:
    'As Staff Platform Engineer at Fabrikam, cut deployment time from 40 to 12 minutes and led the incident response programme that reduced major outages by 45%.' }) },
  { id: 'mixed-association-fr', mixesEmployers: true, document: createDocument({ locale: 'fr', valueProposition:
    'Staff Platform Engineer chez Fabrikam, a réduit le temps de déploiement de 40 à 12 minutes et piloté le programme de réponse aux incidents qui a réduit les pannes majeures de 45 %.' }) },
  { id: 'faithful-association-en', mixesEmployers: false, document: createDocument({ locale: 'en', valueProposition:
    'Staff Platform Engineer at Fabrikam who cut deployment time from 40 to 12 minutes; earlier, as Senior SRE at Contoso, led the incident response programme that reduced major outages by 45%.' }) },
] as const

/**
 * The coherence check is the only net for a cross-employer association (BAK-171), so one it lets through reaches the
 * document as a claim no Candidate Fact supports: a provenance safety violation. Flagging the faithful proposition
 * would rewrite a sound field, which counts against recall only. A check that fails to answer throws, which fails the
 * recording.
 */
export const resumeCoherenceSource: ModelObservationSource = {
  id: 'resume-coherence',
  roles: ['structured'],
  observe: async ({ connect }) => {
    const checker = createModelResumeCoherenceChecker(connect('structured'))
    const observations = []
    for (const { document, id, mixesEmployers } of resumeCoherenceFixtures) {
      const result = await checker.check({ document })
      if (!result.ok) throw new Error(`The coherence check of ${id} failed: ${result.error.type}`)
      const flagged = result.value.issues.some(({ fieldId, kind }) => fieldId === valuePropositionFieldId
        && kind === 'mixed-association')
      observations.push(mixesEmployers
        ? createModelEvaluationObservation({ fixtureId: id, extractionExpectedCount: 1, extractionMatchedCount: Number(flagged),
          unsupportedResumeClaimCount: Number(!flagged), observedValues: flagged ? []
            : ['failed:the coherence check flags the Value Proposition as a mixed association'] })
        : createModelEvaluationObservation({ fixtureId: id, extractionExpectedCount: 1, extractionMatchedCount: Number(!flagged),
          observedValues: flagged ? ['failed:the coherence check leaves the faithful Value Proposition unflagged'] : [] }))
    }
    return observations
  },
}

function createDocument({ locale, valueProposition }: Readonly<{ locale: Locale; valueProposition: string }>): ProfessionalResumeDocument {
  return {
    purpose: 'tailored', locale, targetRole: null,
    valueProposition: { kind: 'prose', paragraphs: [{ id: valuePropositionFieldId, text: valueProposition,
      factIds: ['source-fact-fabrikam-deployment', 'source-fact-contoso-incidents'] }] },
    experiences: experiences[locale].map((experience, index) => {
      const factId = index === 0 ? 'source-fact-fabrikam-deployment' : 'source-fact-contoso-incidents'
      const field = (name: string, text: string) => ({ id: `experiences.${String(index)}.${name}`, text,
        factIds: [`source-fact-${experience.organization.toLowerCase()}-${name}` as const] })
      return { id: `experiences.${String(index)}`, chronology: 'relevant', context: null,
        role: field('role', experience.role), organization: field('organization', experience.organization),
        startDate: field('startDate', experience.startDate), endDate: field('endDate', experience.endDate),
        achievements: [{ id: `experiences.${String(index)}.achievements.0`, text: experience.achievement, factIds: [factId] }] }
    }),
    sections: [],
  }
}
