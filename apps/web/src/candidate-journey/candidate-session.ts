import { failureCauseTypes, hiddenContentOrigins, resumePreparationFailures, resumeSectionKinds } from '@resume-tailoring/application/candidate-journey'
import { z } from 'zod'

import {
  candidateJourneyPhases,
  candidateSessionStorageVersion,
} from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession } from '@resume-tailoring/application/candidate-journey'
import { structuredSourceProfileSchema } from './structured-source-profile-schema'
import {
  capabilityDimensions,
  matchBands,
  requirementCoverages,
  requirementImportances,
} from '@resume-tailoring/application/job-match'

const processingPolicySchema = z.strictObject({
  provider: z.string().min(1),
  purposes: z.array(z.string().min(1)).readonly(),
  retentionPolicy: z.string().min(1),
  storageBehavior: z.string().min(1),
  transmittedDataCategories: z.array(z.string().min(1)).readonly(),
  version: z.string().min(1),
})

const candidateSessionIdPattern = /^candidate-session-[0-9a-f-]+$/u
const candidateFactIdSchema = z.templateLiteral(['source-fact-', z.string().min(1)])
const requirementIdSchema = z.templateLiteral(['job-requirement-', z.string().min(1)])

export const sourceIntakeSchema = z.strictObject({
  candidateFacts: z.array(z.strictObject({
    id: candidateFactIdSchema,
    path: z.string().min(1),
    status: z.enum(['attested', 'excluded-critical-ambiguity']),
    value: z.string(),
  })),
  contactDetails: z.array(z.strictObject({
    kind: z.enum(['address', 'date-of-birth', 'email', 'name', 'personal-information', 'phone', 'url']),
    value: z.string().min(1),
  })),
  criticalAmbiguities: z.array(z.strictObject({
    candidateFactId: candidateFactIdSchema,
    id: z.templateLiteral(['critical-ambiguity-', z.string().min(1)]),
    path: z.string().min(1),
    question: z.string().min(1),
  })),
  originalContent: z.string().min(1),
  sourceDocument: z.strictObject({
    kind: z.enum(['docx', 'pasted-text', 'pdf']),
    name: z.string().min(1),
  }),
  sourceProfile: structuredSourceProfileSchema,
})

const jobRequirementSchema = z.strictObject({
  capability: z.strictObject({
    dimension: z.enum(capabilityDimensions),
    name: z.string().min(1),
  }),
  id: requirementIdSchema,
  importance: z.enum(requirementImportances),
  importanceRationale: z.string().min(1),
  sourceExcerpt: z.string().min(1),
  substitutableGroup: z.string().min(1).optional(),
  value: z.string().min(1),
})

export const jobMatchSchema = z.strictObject({
  analysis: z.strictObject({
    adjacentEvidence: z.array(z.strictObject({
      factIds: z.array(candidateFactIdSchema).min(1),
      requirementId: requirementIdSchema,
    })).default([]),
    criticalRequirementReserve: z.strictObject({
      requirementIds: z.array(requirementIdSchema),
      status: z.enum(['clear', 'present']),
    }),
    evidence: z.array(z.strictObject({
      coverage: z.enum(requirementCoverages),
      factIds: z.array(candidateFactIdSchema),
      requirementId: requirementIdSchema,
    })),
    generationEligibility: z.enum(['denied', 'eligible']),
    matchBand: z.enum(matchBands),
    matchBandQualification: z.literal('critical-requirement-reserve').nullable(),
    matchScore: z.number().int().min(0).max(100),
    relevantFactIds: z.array(candidateFactIdSchema),
    requirementGroups: z.array(z.strictObject({
      capabilities: z.array(jobRequirementSchema.shape.capability),
      coverage: z.enum([...requirementCoverages, 'uncovered']),
      effectiveWeight: z.number().nonnegative(),
      importance: z.enum(requirementImportances),
      requirementIds: z.array(requirementIdSchema),
    })),
  }),
  jobPosting: z.strictObject({
    kind: z.enum(['pasted-text', 'pdf', 'txt']),
    name: z.string().min(1),
    originalContent: z.string().min(1),
  }),
  practicalConstraints: z.array(z.strictObject({
    sourceExcerpt: z.string().min(1),
    value: z.string().min(1),
  })),
  priorityGapRequirementIds: z.array(requirementIdSchema).max(3),
  requirements: z.array(jobRequirementSchema).min(1),
  strengthRequirementIds: z.array(requirementIdSchema).max(3),
  targetRole: z.strictObject({
    sourceExcerpt: z.string().min(1),
    value: z.string().min(1),
  }).nullable(),
})

export const tailoredResumeFieldSchema = z.strictObject({
  id: z.string().min(1),
  factIds: z.array(candidateFactIdSchema).min(1),
  text: z.string(),
})

const resumeSectionNameSchema = z.enum(['value-proposition', 'experiences', 'skills', 'education', 'languages', 'projects', 'certifications'])

export const tailoredResumeSchema = z.strictObject({
  sectionOrder: z.array(resumeSectionNameSchema).optional(),
  purpose: z.enum(['tailored', 'normalized']),
  contactDetails: sourceIntakeSchema.shape.contactDetails,
  experiences: z.array(z.strictObject({
    id: z.string().min(1),
    chronology: z.enum(['context', 'earlier', 'relevant']),
    role: tailoredResumeFieldSchema.nullable(),
    organization: tailoredResumeFieldSchema.nullable(),
    startDate: tailoredResumeFieldSchema.nullable(),
    endDate: tailoredResumeFieldSchema.nullable(),
    // Optional so a Tailored Resume prepared before locations existed still restores.
    location: tailoredResumeFieldSchema.nullable().optional(),
    context: tailoredResumeFieldSchema.nullable(),
    achievements: z.array(tailoredResumeFieldSchema),
    // Optional so a Tailored Resume prepared before copied experiences were marked still restores as written.
    origin: z.literal('copied-from-source').optional(),
  })),
  identity: sourceIntakeSchema.shape.contactDetails.element.extend({ origin: z.literal('detected').optional() }).nullable(),
  locale: z.enum(['en', 'fr']),
  sections: z.array(z.discriminatedUnion('section', [z.strictObject({
    section: z.literal('skills'),
    groups: z.array(z.strictObject({ id: z.string().min(1),
      category: tailoredResumeFieldSchema.nullable(), items: z.array(tailoredResumeFieldSchema) })),
  }), z.strictObject({
    fields: z.array(tailoredResumeFieldSchema),
    section: z.enum(['certifications', 'education', 'languages', 'projects']),
  })])),
  targetRole: jobMatchSchema.shape.targetRole,
  valueProposition: z.strictObject({ kind: z.enum(['evidence-excerpts', 'prose']),
    paragraphs: z.array(tailoredResumeFieldSchema) }),
})

const resumeSectionContentSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('value-proposition'), paragraphs: z.array(tailoredResumeFieldSchema) }),
  z.strictObject({ kind: z.literal('experience'), experience: tailoredResumeSchema.shape.experiences.element }),
  z.strictObject({ kind: z.literal('skills'), groups: tailoredResumeSchema.shape.sections.def.element.options[0].shape.groups }),
  z.strictObject({ kind: z.enum(['education', 'languages', 'projects', 'certifications']), fields: z.array(tailoredResumeFieldSchema) }),
])
const resumeSectionSnapshotSchema = z.discriminatedUnion('status', [
  z.strictObject({ key: z.string().min(1), kind: z.enum(resumeSectionKinds), attempt: z.number().int().nonnegative(),
    status: z.enum(['planned', 'writing', 'validating', 'failed']) }),
  z.strictObject({ key: z.string().min(1), kind: z.enum(resumeSectionKinds), attempt: z.number().int().nonnegative(),
    status: z.literal('validated'), content: resumeSectionContentSchema }),
])
const failureCauseSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('rate-limited'), retryAfterSeconds: z.number().int().nonnegative() }),
  z.strictObject({ type: z.enum(failureCauseTypes).exclude(['rate-limited']) }),
])
const storedIntakeDocumentSchema = z.strictObject({ data: z.string(), mediaType: z.string(), name: z.string() })
const resumePreparationSchema = z.strictObject({
  revision: z.string().min(1),
  status: z.enum(['outdated', 'pending', 'interrupted', 'awaiting-correction', 'no-relevant-evidence', 'failed', 'prepared']),
  sourceDocument: storedIntakeDocumentSchema.nullable(), jobPosting: storedIntakeDocumentSchema.nullable(),
  locale: z.enum(['en', 'fr']).nullable(), purpose: z.enum(['tailored', 'normalized']),
  sourceIntake: sourceIntakeSchema.nullable(), jobMatch: jobMatchSchema.nullable(), failure: z.enum(resumePreparationFailures).nullable(),
  failureCause: failureCauseSchema.optional(), sections: z.array(resumeSectionSnapshotSchema).optional(),
})

const resumeFieldLocationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('value-proposition'), fieldId: z.string() }),
  z.strictObject({ kind: z.literal('experience'), experienceId: z.string(), fieldId: z.string(),
    fieldName: z.enum(['role', 'organization', 'startDate', 'endDate', 'location', 'context', 'achievements']) }),
  z.strictObject({ kind: z.literal('section'), fieldId: z.string(),
    section: z.enum(['certifications', 'education', 'languages', 'projects']) }),
  z.strictObject({ kind: z.literal('skill-group'), fieldId: z.string(), groupId: z.string(),
    fieldName: z.enum(['category', 'items']) }),
])

export const candidateSessionSchema = z.strictObject({
  preparedResumeStatus: z.enum(['current', 'outdated']).optional(),
  preparedResumeRevision: z.string().optional(),
  preparation: resumePreparationSchema.optional(),
  resumeFactLocations: z.array(z.strictObject({ factId: candidateFactIdSchema, location: resumeFieldLocationSchema })).optional(),
  resumeEditing: z.strictObject({ revision: z.string().min(1), manuallyEdited: z.boolean(),
    unsupportedFieldIds: z.array(z.string()),
    hiddenExperiences: tailoredResumeSchema.shape.experiences.optional(), hiddenFields: z.array(z.strictObject({
      field: tailoredResumeFieldSchema, location: resumeFieldLocationSchema,
      origin: z.enum(hiddenContentOrigins).default('candidate'),
    })), restoredFieldIds: z.array(z.string()).optional() }).optional(),
  expiresAt: z.number().int().positive(),
  jobMatch: jobMatchSchema.nullable(),
  phase: z.enum(candidateJourneyPhases),
  processingConsent: z.strictObject({
    grantedAt: z.number().int().nonnegative(),
    policy: processingPolicySchema,
  }).nullable(),
  sessionId: z.custom<CandidateSession['sessionId']>(
    (value) => typeof value === 'string' && candidateSessionIdPattern.test(value),
  ),
  sourceIntake: sourceIntakeSchema.nullable(),
  tailoredResume: tailoredResumeSchema.nullable(),
  resumePhoto: z.strictObject({ dataUrl: z.string().regex(/^data:image\/(?:png|jpeg|webp);base64,/u), name: z.string() }).optional(),
  startedAt: z.number().int().nonnegative(),
  version: z.literal(candidateSessionStorageVersion),
})
