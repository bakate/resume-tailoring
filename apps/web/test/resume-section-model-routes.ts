import type { Page } from '@playwright/test'
import type { ResumeFieldValidationInput, ResumeSectionContent, ResumeSectionWritingInput } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResumeField } from '@resume-tailoring/application/tailored-resume'
import { groupedResumeDocument, readResumeSection } from '@resume-tailoring/application/structured-resume-fixtures'

type SectionModelRoutes = Readonly<{
  write?: (input: ResumeSectionWritingInput) => ResumeSectionContent
  supported?: () => boolean
}>

/** Answers the three section model routes from slices of the grouped fixture, limited to each section's facts. */
export async function routeResumeSectionModels(page: Page, { write = writeFixtureSection, supported = () => true }: SectionModelRoutes = {}) {
  await page.route('**/api/resume-section-writing', (route) => route.fulfill({ json: { ok: true,
    value: write(route.request().postDataJSON() as ResumeSectionWritingInput) } }))
  await page.route('**/api/resume-section-validation', (route) => {
    const input = route.request().postDataJSON() as ResumeFieldValidationInput
    return route.fulfill({ json: { ok: true, value: { fields: input.fields.map(({ id }) => ({ fieldId: id, supported: supported() })) } } })
  })
  await page.route('**/api/resume-document-coherence', (route) => route.fulfill({ json: { ok: true,
    value: { coherent: true, languageMatches: true } } }))
}

export function writeFixtureSection(input: ResumeSectionWritingInput, achievements?: readonly TailoredResumeField[]): ResumeSectionContent {
  const facts = new Map(input.candidateFacts.map((fact) => [fact.id, fact]))
  const restrict = (field: TailoredResumeField | null) => {
    const factIds = field?.factIds.filter((factId) => facts.has(factId)) ?? []
    return field === null || factIds.length === 0 ? null : { ...field, factIds }
  }
  const restrictAll = (fields: readonly TailoredResumeField[]) => fields.map(restrict).filter((field) => field !== null)
  if (input.section.kind === 'value-proposition') return { kind: 'value-proposition', paragraphs: restrictAll([{ id: 'summary-billing',
    text: input.locale === 'fr' ? 'Développement d’interfaces de facturation accessibles.' : 'Accessible billing interfaces backed by React experience.',
    factIds: ['source-fact-experiences-0-achievements-0', 'source-fact-skills-0-name-0'] }]) }
  const content = readResumeSection({ document: groupedResumeDocument, section: input.section })
  if (content.kind === 'experience') {
    const { experience } = content
    const context = restrict(experience.context)
    return { kind: 'experience', experience: { ...experience, role: restrict(experience.role), organization: restrict(experience.organization),
      startDate: restrict(experience.startDate), endDate: restrict(experience.endDate),
      context: context === null ? null : { ...context,
        text: context.factIds.map((factId) => facts.get(factId)?.value).find((value) => value !== undefined) ?? context.text },
      achievements: restrictAll(input.section.key === 'experiences.0' && achievements !== undefined ? achievements : experience.achievements) } }
  }
  if (content.kind === 'skills') return { kind: 'skills', groups: content.groups.map((group) => ({ ...group,
    category: restrict(group.category), items: restrictAll(group.items) })).filter(({ items }) => items.length > 0) }
  if (content.kind === 'value-proposition') return content
  return { ...content, fields: restrictAll(content.fields) }
}
