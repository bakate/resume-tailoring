import { readExperienceFields, readSectionFields } from '@resume-tailoring/application/tailored-resume'
import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import type { TailoredResume, TailoredResumeExperience, TailoredResumeSection } from '@resume-tailoring/application/tailored-resume'
import { tailoredResumeDocumentStyles } from './candidate-journey-theme'

export type TailoredResumeExportSource = Readonly<{
  candidateFacts: readonly CandidateFact[]
  tailoredResume: TailoredResume
}>

export function hasValidTailoredResumeExport({ candidateFacts, tailoredResume }: TailoredResumeExportSource) {
  if (!hasRequiredContactDetails({ tailoredResume })) return false
  return hasValidTailoredResumeProvenance({ candidateFacts, tailoredResume })
}

export function hasValidTailoredResumeProvenance({ candidateFacts, tailoredResume }: TailoredResumeExportSource) {
  const candidateFactIds = new Set(candidateFacts.filter(({ status }) => status === 'attested').map(({ id }) => id))
  return readProfessionalFields({ tailoredResume }).every(({ factIds }) =>
    factIds.length > 0 && factIds.every((factId) => candidateFactIds.has(factId)))
}

export function renderTailoredResumeDocument({ tailoredResume }: Readonly<{
  tailoredResume: TailoredResume
}>) {
  const title = tailoredResume.identity?.value ?? 'Tailored Resume'
  const heading = tailoredResume.purpose === 'normalized'
    ? label({ key: 'normalized', locale: tailoredResume.locale }) : tailoredResume.targetRole?.value ?? ''
  const contactDetails = tailoredResume.contactDetails.map(({ value }) => escapeHtml(value)).join(' · ')
  const sections = [
    renderValueProposition({ tailoredResume }),
    renderExperiences({ tailoredResume }),
    ...tailoredResume.sections.map((section) => renderSection({ section, locale: tailoredResume.locale })),
  ].join('')
  return `<!doctype html><html lang="${tailoredResume.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${tailoredResumeDocumentStyles}</style></head><body><main class="resume-page"><header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(heading)}</p><address>${contactDetails}</address></header>${sections}</main></body></html>`
}

function renderValueProposition({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  const { kind, paragraphs } = tailoredResume.valueProposition
  const title = label({ key: 'summary', locale: tailoredResume.locale })
  if (kind === 'evidence-excerpts') return renderFieldSection({ fields: paragraphs, title })
  if (paragraphs.length === 0) return ''
  return `<section><h2>${title}</h2>${paragraphs.map(({ text }) => `<p>${escapeHtml(text)}</p>`).join('')}</section>`
}

function hasRequiredContactDetails({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  const identity = tailoredResume.identity
  return identity !== null && identity.value.trim().length > 0
    && tailoredResume.contactDetails.some(({ kind, value }) =>
      (kind === 'email' || kind === 'phone') && value.trim().length > 0)
}

function readProfessionalFields({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  return [
    ...tailoredResume.valueProposition.paragraphs,
    ...tailoredResume.experiences.flatMap((experience) => readExperienceFields({ experience })),
    ...tailoredResume.sections.flatMap((section) => readSectionFields({ section })),
  ]
}

function renderExperiences({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  if (tailoredResume.experiences.length === 0) return ''
  const entries = tailoredResume.experiences.map((experience) => renderExperience({ experience })).join('')
  return `<section><h2>${label({ key: 'experiences', locale: tailoredResume.locale })}</h2>${entries}</section>`
}

function renderExperience({ experience }: Readonly<{ experience: TailoredResumeExperience }>) {
  const role = experience.role === null ? '' : `<h3>${escapeHtml(experience.role.text)}</h3>`
  const organization = experience.organization === null ? ''
    : `<p class="experience-organization">${escapeHtml(experience.organization.text)}</p>`
  const dates = [experience.startDate, experience.endDate].filter((field) => field !== null)
    .map(({ text }) => escapeHtml(text)).join(' – ')
  const context = experience.context === null ? '' : `<p>${escapeHtml(experience.context.text)}</p>`
  const achievements = experience.achievements.map(({ text }) => `<li>${escapeHtml(text)}</li>`).join('')
  return `<article class="resume-experience">${role}${organization}${dates.length === 0 ? '' : `<p class="experience-dates">${dates}</p>`}${context}${achievements.length === 0 ? '' : `<ul>${achievements}</ul>`}</article>`
}

function renderSection({ section, locale }: Readonly<{
  section: TailoredResumeSection; locale: TailoredResume['locale']
}>) {
  const title = label({ key: section.section, locale })
  if (section.section !== 'skills') return renderFieldSection({ fields: section.fields, title })
  const groups = section.groups.filter(({ items }) => items.length > 0).map(({ category, items }) => {
    const heading = category === null ? '' : `<h3>${escapeHtml(category.text)}</h3>`
    return `<div class="skill-group">${heading}<p>${items.map(({ text }) => escapeHtml(text)).join(' · ')}</p></div>`
  }).join('')
  return groups.length === 0 ? '' : `<section><h2>${title}</h2>${groups}</section>`
}

function renderFieldSection({ fields, title }: Readonly<{
  fields: readonly Readonly<{ text: string }>[]
  title: string
}>) {
  if (fields.length === 0) return ''
  return `<section><h2>${title}</h2><ul>${fields.map(({ text }) => `<li>${escapeHtml(text)}</li>`).join('')}</ul></section>`
}

function label({ key, locale }: Readonly<{ key: keyof typeof labels.en; locale: 'en' | 'fr' }>) {
  return labels[locale][key]
}

function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

const labels = {
  en: { normalized: 'Normalized Resume — not tailored', certifications: 'Certifications', education: 'Education', experiences: 'Experience', languages: 'Languages', projects: 'Projects', skills: 'Skills', summary: 'Summary' },
  fr: { normalized: 'CV normalisé — non adapté à l’offre', certifications: 'Certifications', education: 'Formation', experiences: 'Expérience', languages: 'Langues', projects: 'Projets', skills: 'Compétences', summary: 'Profil' },
} as const
