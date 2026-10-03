export type SourceProfileFactId = `source-fact-${string}`
export type JobRequirementId = `job-requirement-${string}`
export type ResumeClaimId = `resume-claim-${string}`

export const sensitiveContentKinds = [
  'email',
  'phone',
  'url',
  'address',
  'date-of-birth',
  'personal-information',
  'name',
] as const

export type SensitiveContentKind = typeof sensitiveContentKinds[number]

export type SensitiveContent = Readonly<{
  id: `sensitive-${string}`
  kind: SensitiveContentKind
  value: string
}>

export const sourceProfileFactKinds = [
  'experience',
  'skill',
  'education',
  'language',
  'project',
] as const

export type SourceProfileFactKind = typeof sourceProfileFactKinds[number]

export type SourceProfileFact = Readonly<{
  id: SourceProfileFactId
  kind: SourceProfileFactKind
  value: string
}>

export const jobRequirementClassifications = ['required', 'preferred'] as const

export type JobRequirement = Readonly<{
  classification: typeof jobRequirementClassifications[number]
  id: JobRequirementId
  value: string
}>

export type ResumeClaimSegment = Readonly<{
  text: string
  factIds: readonly SourceProfileFactId[]
}>

export type ResumeClaim = Readonly<{
  id: ResumeClaimId
  segments: readonly ResumeClaimSegment[]
}>
