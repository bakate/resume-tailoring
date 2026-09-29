import type {
  SourceIntake,
  StructuredSourceProfile,
} from '@resume-tailoring/application/source-intake'
import type { Localization } from '../localization/localization'

export function formatNormalizedSourceResume({ sourceIntake, translate }: Readonly<{
  sourceIntake: SourceIntake
  translate: Localization['translate']
}>) {
  const labels = readNormalizedResumeLabels({ translate })
  const profile = sourceIntake.sourceProfile
  return [
    labels.documentTitle,
    formatContactDetails({ labels, sourceIntake }),
    formatExperiences({ experiences: profile.experiences, labels }),
    formatProjects({ labels, projects: profile.projects }),
    formatSkills({ labels, skills: profile.skills }),
    formatEducation({ education: profile.education, labels }),
    formatLanguages({ labels, languages: profile.languages }),
    formatCertifications({ certifications: profile.certifications, labels }),
    formatAdditionalFacts({ labels, sourceIntake }),
  ].filter((section) => section.length > 0).join('\n\n')
}

function readNormalizedResumeLabels({ translate }: Pick<Localization, 'translate'>) {
  return {
    additional: translate('jobMatch.generation.normalizedAdditional'),
    certifications: translate('jobMatch.generation.normalizedCertifications'),
    contact: translate('jobMatch.generation.normalizedContact'),
    documentTitle: translate('jobMatch.generation.normalizedDocumentTitle'),
    education: translate('jobMatch.generation.normalizedEducation'),
    experience: translate('jobMatch.generation.normalizedExperience'),
    experienceFallback: translate('jobMatch.generation.normalizedExperienceFallback'),
    languages: translate('jobMatch.generation.normalizedLanguages'),
    projects: translate('jobMatch.generation.normalizedProjects'),
    skills: translate('jobMatch.generation.normalizedSkills'),
    translate,
  }
}

type NormalizedResumeLabels = ReturnType<typeof readNormalizedResumeLabels>

function formatContactDetails({ labels, sourceIntake }: Readonly<{
  labels: NormalizedResumeLabels
  sourceIntake: SourceIntake
}>) {
  return formatSection({
    entries: sourceIntake.contactDetails.map(({ kind, value }) =>
      `${labels.translate(`jobMatch.generation.contact.${kind}`)}: ${value}`),
    title: labels.contact,
  })
}

function formatExperiences({ experiences, labels }: Readonly<{
  experiences: StructuredSourceProfile['experiences']
  labels: NormalizedResumeLabels
}>) {
  return formatSection({
    entries: experiences.map((experience) => formatExperience({ experience, labels })),
    title: labels.experience,
  })
}

function formatExperience({ experience, labels }: Readonly<{
  experience: StructuredSourceProfile['experiences'][number]
  labels: NormalizedResumeLabels
}>) {
  const heading = joinValues({ values: [experience.role, experience.organization] })
  const dates = joinValues({ separator: ' – ', values: [experience.startDate, experience.endDate] })
  const details = [dates, experience.context, ...experience.achievements.map(bullet)]
    .filter(isPresent)
  return [heading.length > 0 ? heading : labels.experienceFallback, ...details].join('\n')
}

function formatProjects({ labels, projects }: Readonly<{
  labels: NormalizedResumeLabels
  projects: StructuredSourceProfile['projects']
}>) {
  return formatSection({ entries: projects.map(({ description, name }) =>
    [name, description].filter(isPresent).join('\n')), title: labels.projects })
}

function formatSkills({ labels, skills }: Readonly<{
  labels: NormalizedResumeLabels
  skills: StructuredSourceProfile['skills']
}>) {
  return formatSection({ entries: skills.map(({ category, name }) =>
    bullet(category === null ? name : `${name} — ${category}`)), title: labels.skills })
}

function formatEducation({ education, labels }: Readonly<{
  education: StructuredSourceProfile['education']
  labels: NormalizedResumeLabels
}>) {
  return formatSection({ entries: education.map(({ institution, qualification }) =>
    joinValues({ values: [qualification, institution] })), title: labels.education })
}

function formatLanguages({ labels, languages }: Readonly<{
  labels: NormalizedResumeLabels
  languages: StructuredSourceProfile['languages']
}>) {
  return formatSection({ entries: languages.map(({ name, proficiency }) =>
    bullet(joinValues({ values: [name, proficiency] }))), title: labels.languages })
}

function formatCertifications({ certifications, labels }: Readonly<{
  certifications: StructuredSourceProfile['certifications']
  labels: NormalizedResumeLabels
}>) {
  return formatSection({ entries: certifications.map(({ issuedAt, issuer, name }) =>
    joinValues({ values: [name, issuer, issuedAt] })), title: labels.certifications })
}

function formatAdditionalFacts({ labels, sourceIntake }: Readonly<{
  labels: NormalizedResumeLabels
  sourceIntake: SourceIntake
}>) {
  const entries = sourceIntake.candidateFacts.filter(({ path, status }) =>
    status === 'attested' && path.includes('.candidate-enrichment.'))
    .map(({ value }) => bullet(value))
  return formatSection({ entries, title: labels.additional })
}

function formatSection({ entries, title }: Readonly<{
  entries: readonly string[]
  title: string
}>) {
  const presentEntries = entries.filter(isPresent)
  return presentEntries.length === 0 ? '' : [title, ...presentEntries].join('\n')
}

function joinValues({ separator = ' — ', values }: Readonly<{
  separator?: string
  values: readonly (string | null)[]
}>) {
  return values.filter(isPresent).join(separator)
}

function bullet(value: string) {
  return `- ${value}`
}

function isPresent(value: string | null): value is string {
  return value !== null && value.trim().length > 0
}
