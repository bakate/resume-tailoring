import { readExperienceFields, readSectionFields, replaceEmDashes } from '@resume-tailoring/application/tailored-resume'
import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import type { ResumeSectionName, TailoredResume, TailoredResumeExperience, TailoredResumeSection } from '@resume-tailoring/application/tailored-resume'
import { tailoredResumeDocumentStyles } from '../resume-tailoring/structured-resume-document-styles'

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

export function renderTailoredResumeDocument({ tailoredResume, photoDataUrl }: Readonly<{
  tailoredResume: TailoredResume
  photoDataUrl?: string
}>) {
  const title = tailoredResume.identity?.value ?? 'Tailored resume'
  const heading = tailoredResume.purpose === 'normalized'
    ? readResumeHeading({ key: 'normalized', locale: tailoredResume.locale }) : tailoredResume.targetRole?.value ?? ''
  // Each detail stays on one line, so an address never splits across lines.
  const contactDetails = tailoredResume.contactDetails
    .map(({ value }) => `<span class="contact-detail">${renderText(value)}</span>`).join(' · ')
  const defaultOrder: readonly ResumeSectionName[] = ['value-proposition', 'experiences',
    ...tailoredResume.sections.map(({ section }) => section)]
  const sectionOrder = [...new Set([...(tailoredResume.sectionOrder ?? []), ...defaultOrder])]
  const sections = sectionOrder.map((sectionName) => {
    if (sectionName === 'value-proposition') return renderValueProposition({ tailoredResume })
    if (sectionName === 'experiences') return renderExperiences({ tailoredResume })
    return tailoredResume.sections.filter(({ section }) => section === sectionName)
      .map((section) => renderSection({ section, locale: tailoredResume.locale })).join('')
  }).join('')
  const photo = photoDataUrl !== undefined && /^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/]+=*$/u.test(photoDataUrl)
    ? `<img class="resume-photo" alt="" src="${photoDataUrl}">` : ''
  return `<!doctype html><html lang="${tailoredResume.locale}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src data:; img-src data:; style-src 'unsafe-inline'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${tailoredResumeDocumentStyles}</style></head><body><main class="resume-page"><header${photo === '' ? '' : ' class="with-photo"'}><div class="resume-identity"><h1>${renderText(title)}</h1><p>${renderText(heading)}</p><address>${contactDetails}</address></div>${photo}</header>${sections}</main></body></html>`
}

function renderValueProposition({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  const { kind, paragraphs } = tailoredResume.valueProposition
  const title = readResumeHeading({ key: 'summary', locale: tailoredResume.locale })
  if (kind === 'evidence-excerpts') return renderFieldSection({ fields: paragraphs, title })
  if (paragraphs.length === 0) return ''
  return `<section><h2>${title}</h2>${paragraphs.map(({ text }) => `<p>${renderText(text)}</p>`).join('')}</section>`
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
  return `<section><h2>${readResumeHeading({ key: 'experiences', locale: tailoredResume.locale })}</h2>${entries}</section>`
}

function renderExperience({ experience }: Readonly<{ experience: TailoredResumeExperience }>) {
  const role = experience.role === null ? '' : `<h3>${renderText(experience.role.text)}</h3>`
  const organization = experience.organization === null ? ''
    : `<p class="experience-organization">${renderText(experience.organization.text)}</p>`
  const dates = [experience.startDate, experience.endDate].filter((field) => field !== null)
    .map(({ text }) => renderText(text)).join(' – ')
  const context = experience.context === null ? '' : `<p>${renderText(experience.context.text)}</p>`
  const achievements = experience.achievements.map(({ text }) => `<li>${renderText(text)}</li>`).join('')
  // The heading stays whole and with what follows it, so a page never ends on a role without its dates.
  const heading = `<div class="experience-heading">${role}${organization}${renderPeriod({ dates, location: experience.location ?? null })}</div>`
  return `<article class="resume-experience">${heading}${context}${achievements.length === 0 ? '' : `<ul>${achievements}</ul>`}</article>`
}

/** The dates line, with the location at its far end when the experience has one. */
function renderPeriod({ dates, location }: Readonly<{ dates: string; location: TailoredResumeExperience['location'] }>) {
  if (location === null || location === undefined) return dates.length === 0 ? '' : `<p class="experience-dates">${dates}</p>`
  return `<p class="experience-dates"><span>${dates}</span><span class="experience-location">${renderText(location.text)}</span></p>`
}

function renderSection({ section, locale }: Readonly<{
  section: TailoredResumeSection; locale: TailoredResume['locale']
}>) {
  const title = readResumeHeading({ key: section.section, locale })
  if (section.section !== 'skills') return renderFieldSection({ fields: section.fields, title })
  const groups = section.groups.filter(({ items }) => items.length > 0).map(({ category, items }) => {
    const heading = category === null ? '' : `<h3>${renderText(category.text)}</h3>`
    return `<div class="skill-group">${heading}<p>${items.map(({ text }) => renderText(text)).join(' · ')}</p></div>`
  }).join('')
  return groups.length === 0 ? '' : `<section><h2>${title}</h2>${groups}</section>`
}

function renderFieldSection({ fields, title }: Readonly<{
  fields: readonly Readonly<{ text: string }>[]
  title: string
}>) {
  if (fields.length === 0) return ''
  return `<section><h2>${title}</h2><ul>${fields.map(({ text }) => `<li>${renderText(text)}</li>`).join('')}</ul></section>`
}

/** A resume section heading in the resume language, shared by the final document and the progressive preview. */
export function readResumeHeading({ key, locale }: Readonly<{ key: ResumeHeadingKey; locale: 'en' | 'fr' }>) {
  return labels[locale][key]
}

/** Escapes text for the document, written with an en dash wherever the content carries an em dash. */
function renderText(value: string) {
  return replaceEmDashes(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

export type ResumeHeadingKey = keyof typeof labels.en

const labels = {
  en: { normalized: 'General resume – not tailored to a job', certifications: 'Certifications', education: 'Education', experiences: 'Experience', languages: 'Languages', projects: 'Projects', skills: 'Skills', summary: 'Summary' },
  fr: { normalized: 'CV général – non adapté à une offre', certifications: 'Certifications', education: 'Formation', experiences: 'Expérience', languages: 'Langues', projects: 'Projets', skills: 'Compétences', summary: 'Profil' },
} as const
