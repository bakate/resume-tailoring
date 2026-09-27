import type {
  JobPostingReview,
  JobRequirement,
  JobRequirementContent,
  JobRequirementGroupId,
} from '@resume-tailoring/domain/resume-tailoring-state'
import { jobRequirementMaximumCount } from '@resume-tailoring/domain/resume-tailoring-state'

import { minimizeSensitiveContent } from './content-privacy'
import type {
  JobRequirementGroupIdentity,
  JobRequirementIdentity,
} from './resume-tailoring-workflow-ports'

export function createReviewingJobPosting({ content }: Readonly<{
  content: string
}>): JobPostingReview {
  const minimizedContent = minimizeSensitiveContent({ content })
  return {
    status: 'reviewing-posting',
    ...minimizedContent,
    processingNotice: null,
    targetRole: null,
    requirements: [],
  }
}

export function updateJobPosting({
  jobPosting,
  outgoingContent,
}: Readonly<{ jobPosting: JobPostingReview; outgoingContent: string }>): JobPostingReview {
  if (outgoingContent === jobPosting.outgoingContent) return jobPosting
  return {
    ...jobPosting,
    status: 'reviewing-posting',
    ...minimizeSensitiveContent({ content: outgoingContent }),
    processingNotice: null,
    targetRole: null,
    requirements: [],
  }
}

export function identifyJobRequirements({
  contents,
  groupIdentity,
  requirementIdentity,
}: Readonly<{
  contents: readonly JobRequirementContent[]
  groupIdentity: JobRequirementGroupIdentity
  requirementIdentity: JobRequirementIdentity
}>): readonly JobRequirement[] | null {
  if (contents.length > jobRequirementMaximumCount) return null
  const groupIds = identifyRequirementGroups({ contents, groupIdentity })
  if (groupIds === null) return null

  const requirements = contents.map((content) => createJobRequirement({
    content,
    groupId: groupIds.get(content.sourceExcerpt),
    requirementIdentity,
  }))
  return requirements.includes(null) ? null : requirements.filter((requirement) => requirement !== null)
}

function identifyRequirementGroups({
  contents,
  groupIdentity,
}: Readonly<{
  contents: readonly JobRequirementContent[]
  groupIdentity: JobRequirementGroupIdentity
}>) {
  const groupIds = new Map<string, JobRequirementGroupId>()
  for (const { sourceExcerpt } of contents) {
    if (groupIds.has(sourceExcerpt)) continue
    const identity = groupIdentity.create()
    if (!identity.ok) return null
    groupIds.set(sourceExcerpt, identity.value)
  }
  return groupIds
}

function createJobRequirement({
  content,
  groupId,
  requirementIdentity,
}: Readonly<{
  content: JobRequirementContent
  groupId: JobRequirementGroupId | undefined
  requirementIdentity: JobRequirementIdentity
}>): JobRequirement | null {
  if (groupId === undefined) return null
  const identity = requirementIdentity.create()
  if (!identity.ok) return null
  return {
    classification: content.classification,
    groupId,
    id: identity.value,
    sourceExcerpt: content.sourceExcerpt,
    value: content.value,
  }
}
