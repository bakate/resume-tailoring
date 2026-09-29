import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'

export type TailoredResumeExportSource = Readonly<{
  candidateFacts: readonly CandidateFact[]
  tailoredResume: TailoredResume
}>

export function hasValidTailoredResumeExport({ candidateFacts, tailoredResume }: TailoredResumeExportSource) {
  if (!hasRequiredContactDetails({ tailoredResume })) return false
  const candidateFactIds = new Set(candidateFacts.map(({ id }) => id))
  return readProfessionalFields({ tailoredResume }).every(({ factIds }) =>
    factIds.length > 0 && factIds.every((factId) => candidateFactIds.has(factId)))
}

export function renderTailoredResumeDocument({ tailoredResume }: Readonly<{
  tailoredResume: TailoredResume
}>) {
  const title = tailoredResume.identity?.value ?? 'Tailored Resume'
  const contactDetails = tailoredResume.contactDetails.map(({ value }) => escapeHtml(value)).join(' · ')
  const sections = [
    renderFieldSection({ fields: tailoredResume.valueProposition, title: label({ key: 'summary', locale: tailoredResume.locale }) }),
    renderExperiences({ tailoredResume }),
    ...tailoredResume.sections.map((section) => renderFieldSection({
      fields: section.fields, title: label({ key: section.section, locale: tailoredResume.locale }),
    })),
  ].join('')
  return `<!doctype html><html lang="${tailoredResume.locale}"><head><meta charset="utf-8"><style>${styles}</style></head><body><main class="resume-page"><header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(tailoredResume.targetRole?.value ?? '')}</p><address>${contactDetails}</address></header>${sections}</main></body></html>`
}

function hasRequiredContactDetails({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  const identity = tailoredResume.identity
  return identity !== null && identity.value.trim().length > 0
    && tailoredResume.contactDetails.some(({ kind, value }) =>
      (kind === 'email' || kind === 'phone') && value.trim().length > 0)
}

function readProfessionalFields({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  return [
    ...tailoredResume.valueProposition,
    ...tailoredResume.experiences.flatMap(({ fields }) => fields),
    ...tailoredResume.sections.flatMap(({ fields }) => fields),
  ]
}

function renderExperiences({ tailoredResume }: Readonly<{ tailoredResume: TailoredResume }>) {
  const fields = tailoredResume.experiences.flatMap(({ fields: experienceFields }) => experienceFields)
  return renderFieldSection({ fields, title: label({ key: 'experiences', locale: tailoredResume.locale }) })
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
  en: { certifications: 'Certifications', education: 'Education', experiences: 'Experience', languages: 'Languages', projects: 'Projects', skills: 'Skills', summary: 'Summary' },
  fr: { certifications: 'Certifications', education: 'Formation', experiences: 'Expérience', languages: 'Langues', projects: 'Projets', skills: 'Compétences', summary: 'Profil' },
} as const

const styles = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;color:#151820;font-family:Arial,sans-serif}.resume-page{width:210mm;min-height:297mm;padding:17mm 18mm}header{border-bottom:.5mm solid #164f3d;padding-bottom:6mm}h1,h2{margin:0;color:#164f3d;font-family:Georgia,serif}h1{font-size:25pt}h2{font-size:14pt}header p,address{margin:3mm 0 0;font-style:normal}section{margin-top:6mm;break-inside:avoid}ul{margin:2mm 0 0;padding-left:5mm}li{margin-top:2mm;line-height:1.35}`
