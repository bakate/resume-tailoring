import type { TailoredResume, TailoredResumeSection } from './tailored-resume'

/** Shared operation vocabulary for the existing Candidate Journey, not another orchestrator. */
export type ResumeDraft = Readonly<{
  document: TailoredResume
  revision: string
}>

/** Identity and contacts never cross professional model ports. */
export type ProfessionalResumeDocument = Omit<TailoredResume, 'identity' | 'contactDetails'>

export type ResumeOperationFailure = Readonly<{
  status: 'failed'
  reason: 'processing-consent-required' | 'unavailable' | 'unsupported-content' | 'incoherent-content' | 'stale-result'
  recovery: 'renew-consent' | 'retry' | 'correct-content' | 'retry-current-draft'
}>

export type ResumePreparationOutcome =
  | Readonly<{ status: 'prepared'; revision: string; document: ProfessionalResumeDocument }>
  | Readonly<{ status: 'no-relevant-evidence'; revision: string; alternative: 'normalized' }>
  | ResumeOperationFailure

export type ResumeSectionChange = Readonly<{ baseRevision: string }> & (
  | Readonly<{ section: 'value-proposition'; replacement: TailoredResume['valueProposition'] }>
  | Readonly<{ section: 'experiences'; replacement: TailoredResume['experiences'] }>
  | Readonly<{ section: 'skills'; replacement: Extract<TailoredResumeSection, { section: 'skills' }> }>
  | Readonly<{ section: Exclude<TailoredResumeSection['section'], 'skills'>;
      replacement: readonly TailoredResume['valueProposition']['paragraphs'][number][] }>
)

export type ResumeSectionChangeOutcome =
  | Readonly<{ status: 'validated'; change: ResumeSectionChange }>
  | Readonly<{ status: 'unsupported'; baseRevision: string; fieldIds: readonly string[] }>
  | ResumeOperationFailure

export type ResumeLayoutOutcome =
  | Readonly<{ status: 'fits'; revision: string; pageCount: 1 | 2 }>
  | Readonly<{ status: 'overflow'; revision: string; pageCount: number }>
  | Readonly<{ status: 'unavailable'; revision: string }>

export type ResumeExportBlocker = 'unsupported-content' | 'missing-identity'
  | 'missing-contact' | 'overflow' | 'layout-unavailable' | 'stale-layout'

export type ResumeExportEligibility =
  | Readonly<{ status: 'eligible'; revision: string; pageCount: 1 | 2 }>
  | Readonly<{ status: 'blocked'; revision: string; reasons: readonly ResumeExportBlocker[] }>

export type ResumeCondensationProposal = Readonly<{
  id: string
  baseRevision: string
  document: ProfessionalResumeDocument
  layout: ResumeLayoutOutcome
}>

export type ResumeCondensationOutcome =
  | Readonly<{ status: 'proposed'; proposal: ResumeCondensationProposal }>
  | ResumeOperationFailure

export type ResumeProposalDecision = Readonly<{
  proposalId: string
  baseRevision: string
}>

export type ResumeProposalDecisionOutcome =
  | Readonly<{ status: 'accepted'; draft: ResumeDraft }>
  | Readonly<{ status: 'rejected'; draft: ResumeDraft }>
  | ResumeOperationFailure

export type ResumeLayoutAssessment = Readonly<{
  layout: ResumeLayoutOutcome
  exportEligibility: ResumeExportEligibility
}>

export type ResumeDocumentReview = Readonly<{
  draft: ResumeDraft
  proposal: ResumeCondensationProposal | null
  assessment: ResumeLayoutAssessment | null
  failure: ResumeOperationFailure | null
}>
