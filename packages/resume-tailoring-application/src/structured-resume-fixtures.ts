import { createTailoredResume } from './tailored-resume'
import type { TailoredResume } from './tailored-resume'
import type { ResumeLayoutOutcome, ResumeExportEligibility, ResumeSectionChange, ResumeSectionChangeOutcome, ResumePreparationOutcome } from './structured-resume-contract'
import type { JobMatch } from './job-match'
import type { SourceIntake } from './source-intake'
import type { ResumeSectionContent, ResumeSectionPlanEntry, ResumeSectionWritingInput } from './resume-sections'

/** Anonymized evidence shared by preparation, editing, and rendering consumers. */
export const structuredResumeSource: SourceIntake = {
  candidateFacts: [
    ['experiences.0.role.0', 'Frontend Engineer'],
    ['experiences.0.organization.0', 'Northwind'],
    ['experiences.0.startDate.0', '2021'],
    ['experiences.0.endDate.0', '2024'],
    ['experiences.0.context.0', 'Customer billing team'],
    ['experiences.0.achievements.0', 'Built accessible billing screens'],
    ['experiences.1.role.0', 'Software Developer'],
    ['experiences.1.organization.0', 'Contoso'],
    ['experiences.1.startDate.0', '2018'],
    ['experiences.1.endDate.0', '2021'],
    ['skills.0.category.0', 'Front-end'],
    ['skills.0.name.0', 'React'],
    ['skills.1.category.0', 'Front-end'],
    ['skills.1.name.0', 'TypeScript'],
    ['skills.2.category.0', 'Front-end'],
    ['skills.2.name.0', 'React'],
    ['education.0.qualification.0', 'Computer Science degree'],
    ['languages.0.name.0', 'English'],
    ['projects.0.name.0', 'Accessible component library'],
    ['certifications.0.name.0', 'Cloud practitioner'],
  ].map(([path = '', value = '']) => ({
    id: `source-fact-${path.replaceAll('.', '-')}`,
    path, status: 'attested', value,
  })),
  contactDetails: [
    { kind: 'personal-information', value: 'Alex Morgan' },
    { kind: 'email', value: 'alex@example.com' },
  ],
  criticalAmbiguities: [],
  originalContent: 'Frontend Engineer at Northwind, 2021–2024. Software Developer at Contoso, 2018–2021.',
  sourceDocument: { kind: 'pasted-text', name: 'anonymized-resume.txt' },
  sourceProfile: {
    certifications: [{ name: 'Cloud practitioner', issuer: null, issuedAt: null }],
    education: [{ qualification: 'Computer Science degree', institution: null }],
    experiences: [
      { role: 'Frontend Engineer', organization: 'Northwind', startDate: '2021', endDate: '2024', location: null,
        context: 'Customer billing team', achievements: ['Built accessible billing screens'] },
      { role: 'Software Developer', organization: 'Contoso', startDate: '2018', endDate: '2021', location: null,
        context: null, achievements: [] },
    ],
    languages: [{ name: 'English', proficiency: null }],
    projects: [{ name: 'Accessible component library', description: null }],
    skills: [
      { category: 'Front-end', name: 'React' }, { category: 'Front-end', name: 'TypeScript' },
      { category: 'Front-end', name: 'React' },
    ],
  },
}

export const structuredResumeJobMatch: JobMatch = {
  analysis: {
    adjacentEvidence: [],
    criticalRequirementReserve: { requirementIds: [], status: 'clear' },
    evidence: [{ coverage: 'covered', factIds: ['source-fact-skills-0-name-0'], requirementId: 'job-requirement-react' }],
    generationEligibility: 'eligible', matchBand: 'strong', matchBandQualification: null,
    matchScore: 100, relevantFactIds: ['source-fact-skills-0-name-0', 'source-fact-experiences-0-achievements-0'],
    requirementGroups: [],
  },
  jobPosting: { kind: 'pasted-text', name: 'job.txt', originalContent: 'Frontend Engineer. React is required.' },
  practicalConstraints: [], priorityGapRequirementIds: [], strengthRequirementIds: ['job-requirement-react'],
  requirements: [{ id: 'job-requirement-react', value: 'React', sourceExcerpt: 'React is required.',
    importance: 'central', importanceRationale: 'Explicit requirement',
    capability: { dimension: 'technical-expertise', name: 'React' } }],
  targetRole: { value: 'Frontend Engineer', sourceExcerpt: 'Frontend Engineer.' },
}

export const noRelevantEvidenceJobMatch: JobMatch = {
  ...structuredResumeJobMatch,
  analysis: { ...structuredResumeJobMatch.analysis, evidence: [], generationEligibility: 'denied',
    matchBand: 'ambitious', matchScore: 0, relevantFactIds: [] },
  strengthRequirementIds: [],
}

/** Independent reference document; no production composer or model adapter is required. */
export const groupedResumeDocument = {
  purpose: 'tailored', locale: 'en',
  identity: { kind: 'personal-information', value: 'Alex Morgan' },
  contactDetails: [{ kind: 'email', value: 'alex@example.com' }],
  targetRole: { value: 'Frontend Engineer', sourceExcerpt: 'Frontend Engineer.' },
  valueProposition: { kind: 'evidence-excerpts', paragraphs: [
    { id: 'summary-billing', text: 'Built accessible billing screens',
      factIds: ['source-fact-experiences-0-achievements-0'] },
  ] },
  experiences: [
    { id: 'experiences.0', chronology: 'relevant',
      role: { id: 'role-northwind', text: 'Frontend Engineer', factIds: ['source-fact-experiences-0-role-0'] },
      organization: { id: 'organization-northwind', text: 'Northwind', factIds: ['source-fact-experiences-0-organization-0'] },
      startDate: { id: 'start-northwind', text: '2021', factIds: ['source-fact-experiences-0-startDate-0'] },
      endDate: { id: 'end-northwind', text: '2024', factIds: ['source-fact-experiences-0-endDate-0'] }, location: null,
      context: { id: 'context-northwind', text: 'Customer billing team', factIds: ['source-fact-experiences-0-context-0'] },
      achievements: [{ id: 'billing', text: 'Built accessible billing screens', factIds: ['source-fact-experiences-0-achievements-0'] }] },
    { id: 'experiences.1', chronology: 'context',
      role: { id: 'role-contoso', text: 'Software Developer', factIds: ['source-fact-experiences-1-role-0'] },
      organization: { id: 'organization-contoso', text: 'Contoso', factIds: ['source-fact-experiences-1-organization-0'] },
      startDate: { id: 'start-contoso', text: '2018', factIds: ['source-fact-experiences-1-startDate-0'] },
      endDate: { id: 'end-contoso', text: '2021', factIds: ['source-fact-experiences-1-endDate-0'] }, location: null,
      context: null, achievements: [] },
  ],
  sections: [
    { section: 'skills', groups: [{ id: 'skills.0',
      category: { id: 'frontend', text: 'Front-end', factIds: ['source-fact-skills-0-category-0',
        'source-fact-skills-1-category-0', 'source-fact-skills-2-category-0'] },
      items: [
        { id: 'react', text: 'React', factIds: ['source-fact-skills-0-name-0', 'source-fact-skills-2-name-0'] },
        { id: 'typescript', text: 'TypeScript', factIds: ['source-fact-skills-1-name-0'] },
      ] }] },
    { section: 'education', fields: [{ id: 'degree', text: 'Computer Science degree', factIds: ['source-fact-education-0-qualification-0'] }] },
    { section: 'languages', fields: [{ id: 'english', text: 'English', factIds: ['source-fact-languages-0-name-0'] }] },
    { section: 'projects', fields: [{ id: 'library', text: 'Accessible component library', factIds: ['source-fact-projects-0-name-0'] }] },
    { section: 'certifications', fields: [{ id: 'cloud', text: 'Cloud practitioner', factIds: ['source-fact-certifications-0-name-0'] }] },
  ],
} as const satisfies TailoredResume

export function readGroupedResumeSection(section: ResumeSectionPlanEntry): ResumeSectionContent {
  return readResumeSection({ document: groupedResumeDocument, section })
}

/** Writes a section verbatim from the Candidate Facts it received, for suites whose facts are not the grouped fixture. */
export function writeResumeSectionFromFacts({ section, candidateFacts }: ResumeSectionWritingInput): ResumeSectionContent {
  return readResumeSection({ section, document: createTailoredResume({ jobMatch: structuredResumeJobMatch,
    sourceIntake: { ...structuredResumeSource, candidateFacts } }) })
}

/** Slices one Resume Section out of a complete fixture document, as a section writing call would return it. */
export function readResumeSection({ document, section }: Readonly<{
  document: Pick<TailoredResume, 'valueProposition' | 'experiences' | 'sections'>; section: ResumeSectionPlanEntry
}>): ResumeSectionContent {
  if (section.kind === 'value-proposition') return { kind: section.kind, paragraphs: document.valueProposition.paragraphs }
  if (section.kind === 'experience') {
    const experience = document.experiences.find(({ id }) => id === section.key)
    if (experience === undefined) throw new Error(`No fixture experience for ${section.key}`)
    return { kind: section.kind, experience }
  }
  const slice = document.sections.find((candidate) => candidate.section === section.kind)
  if (slice?.section === 'skills') return { kind: 'skills', groups: slice.groups }
  if (slice === undefined || section.kind === 'skills') throw new Error(`No fixture section for ${section.key}`)
  return { kind: section.kind, fields: slice.fields }
}

export const resumeContractRevision = 'candidate-session-fixture:draft-1'

/** These are deterministic adapter responses, not measurements of the reference HTML. */
export const resumeLayoutExpectations = [
  { layout: { status: 'fits', revision: resumeContractRevision, pageCount: 1 },
    eligibility: { status: 'eligible', revision: resumeContractRevision, pageCount: 1 } },
  { layout: { status: 'fits', revision: resumeContractRevision, pageCount: 2 },
    eligibility: { status: 'eligible', revision: resumeContractRevision, pageCount: 2 } },
  { layout: { status: 'overflow', revision: resumeContractRevision, pageCount: 3 },
    eligibility: { status: 'blocked', revision: resumeContractRevision, reasons: ['overflow'] } },
  { layout: { status: 'unavailable', revision: resumeContractRevision },
    eligibility: { status: 'blocked', revision: resumeContractRevision, reasons: ['layout-unavailable'] } },
] as const satisfies readonly Readonly<{
  layout: ResumeLayoutOutcome
  eligibility: ResumeExportEligibility
}>[]

export const supportedSectionChange = {
  baseRevision: resumeContractRevision, section: 'value-proposition',
  replacement: { kind: 'prose', paragraphs: [
    { id: 'summary-billing', text: 'Built accessible billing screens',
      factIds: ['source-fact-experiences-0-achievements-0'] },
  ] },
} as const satisfies ResumeSectionChange

export const unsupportedSectionChange = {
  ...supportedSectionChange,
  replacement: { kind: 'prose', paragraphs: [
    { id: 'summary-billing', text: 'Led a global team of 100 engineers',
      factIds: ['source-fact-experiences-0-achievements-0'] },
  ] },
} as const satisfies ResumeSectionChange

export const resumeSectionChangeExpectations = [
  { change: supportedSectionChange, outcome: { status: 'validated', change: supportedSectionChange } },
  { change: unsupportedSectionChange, outcome: { status: 'unsupported', baseRevision: resumeContractRevision,
    fieldIds: ['summary-billing'] } },
] as const satisfies readonly Readonly<{
  change: ResumeSectionChange
  outcome: ResumeSectionChangeOutcome
}>[]

export const noRelevantEvidenceExpectation = {
  jobMatch: noRelevantEvidenceJobMatch,
  outcome: { status: 'no-relevant-evidence', revision: resumeContractRevision, alternative: 'normalized' },
} as const satisfies Readonly<{
  jobMatch: JobMatch
  outcome: ResumePreparationOutcome
}>
