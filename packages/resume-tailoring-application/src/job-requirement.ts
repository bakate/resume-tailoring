import type {
  JobPostingReview,
  JobRequirement,
  JobRequirementContent,
  JobRequirementGroupId,
  JobRequirementGroupKey,
} from '@resume-tailoring/domain/resume-tailoring-state'

import type {
  JobRequirementGroupIdentity,
  JobRequirementIdentity,
} from './resume-tailoring-workflow-ports'

export function createReviewingJobPosting({ content }: Readonly<{
  content: string
}>): JobPostingReview {
  return {
    status: 'reviewing-posting',
    outgoingContent: content,
    processingNotice: null,
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
  const groupIds = identifyRequirementGroups({ contents, groupIdentity })
  if (groupIds === null) return null

  const requirements = contents.map((content) => createJobRequirement({
    content,
    groupId: groupIds.get(content.groupKey),
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
  const groupIds = new Map<JobRequirementGroupKey, JobRequirementGroupId>()
  for (const { groupKey } of contents) {
    if (groupIds.has(groupKey)) continue
    const identity = groupIdentity.create()
    if (!identity.ok) return null
    groupIds.set(groupKey, identity.value)
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
