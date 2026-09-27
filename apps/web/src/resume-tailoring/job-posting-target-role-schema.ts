import { z } from 'zod'

export const jobPostingTargetRoleMaximumCharacters = 200
export const jobPostingTargetRoleSourceExcerptMaximumCharacters = 2_000

export const jobPostingTargetRoleSchema = z.object({
  sourceExcerpt: z.string().min(1).max(jobPostingTargetRoleSourceExcerptMaximumCharacters),
  value: z.string().min(1).max(jobPostingTargetRoleMaximumCharacters),
}).strict().refine(({ sourceExcerpt, value }) => sourceExcerpt.includes(value), {
  message: 'Expected the target role value to be an exact source substring',
  path: ['value'],
})

export function hasSourceBackedTargetRole({
  jobPostingContent,
  targetRole,
}: Readonly<{
  jobPostingContent: string
  targetRole: Readonly<{ sourceExcerpt: string }> | null | undefined
}>) {
  return targetRole === null
    || targetRole === undefined
    || jobPostingContent.includes(targetRole.sourceExcerpt)
}
