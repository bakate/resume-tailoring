export const sourceProfileSections = [
  'experiences',
  'projects',
  'skills',
  'education',
  'languages',
  'certifications',
] as const

export type SourceProfileSection = typeof sourceProfileSections[number]
export type CandidateFactId = `source-fact-${string}`

export type CandidateFact = Readonly<{
  id: CandidateFactId
  path: string
  status: 'attested' | 'excluded-critical-ambiguity'
  value: string
}>

export type SourceProfileExperience = Readonly<{
  achievements: readonly string[]
  context: string | null
  endDate: string | null
  /** Where the experience took place (a city, a region, remote); absent from profiles extracted before it existed. */
  location?: string | null
  organization: string | null
  role: string | null
  startDate: string | null
}>

export type SourceProfileProject = Readonly<{
  description: string | null
  name: string
}>

export type SourceProfileSkill = Readonly<{
  category: string | null
  name: string
}>

export type SourceProfileEducation = Readonly<{
  institution: string | null
  qualification: string | null
}>

export type SourceProfileLanguage = Readonly<{
  name: string
  proficiency: string | null
}>

export type SourceProfileCertification = Readonly<{
  issuedAt: string | null
  issuer: string | null
  name: string
}>

export type StructuredSourceProfile = Readonly<{
  certifications: readonly SourceProfileCertification[]
  education: readonly SourceProfileEducation[]
  experiences: readonly SourceProfileExperience[]
  languages: readonly SourceProfileLanguage[]
  projects: readonly SourceProfileProject[]
  skills: readonly SourceProfileSkill[]
}>

export type CriticalAmbiguity = Readonly<{
  candidateFactId: CandidateFactId
  id: `critical-ambiguity-${string}`
  path: string
  question: string
}>

export type LocalContactDetail = Readonly<{
  kind: 'address' | 'date-of-birth' | 'email' | 'name' | 'personal-information' | 'phone' | 'url'
  value: string
}>

export type SourceIntake = Readonly<{
  candidateFacts: readonly CandidateFact[]
  contactDetails: readonly LocalContactDetail[]
  criticalAmbiguities: readonly CriticalAmbiguity[]
  originalContent: string
  sourceDocument: Readonly<{
    kind: 'docx' | 'pasted-text' | 'pdf'
    name: string
  }>
  sourceProfile: StructuredSourceProfile
}>
