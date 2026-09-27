import type { JobRequirement } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

export type JobRequirementGroup = Readonly<{
  groupId: JobRequirement['groupId']
  requirements: readonly JobRequirement[]
  sourceExcerpt: string
}>

export function groupJobRequirements({ requirements }: Readonly<{
  requirements: readonly JobRequirement[]
}>): readonly JobRequirementGroup[] {
  const groups = new Map<JobRequirement['groupId'], JobRequirementGroup>()
  for (const requirement of requirements) {
    const existingGroup = groups.get(requirement.groupId)
    if (existingGroup !== undefined) {
      groups.set(requirement.groupId, {
        ...existingGroup,
        requirements: [...existingGroup.requirements, requirement],
      })
      continue
    }
    groups.set(requirement.groupId, {
      groupId: requirement.groupId,
      requirements: [requirement],
      sourceExcerpt: requirement.sourceExcerpt,
    })
  }
  return [...groups.values()]
}
