const targetRoleLabel = /^(?:job title|intitulé du poste|position|poste|role|rôle|title)\s*:\s*([^.!?]+)/iu

export function isExactTargetRoleTitle({ jobPostingContent, value }: Readonly<{
  jobPostingContent: string
  value: string
}>) {
  const targetRoleValue = value.trim()
  if (targetRoleValue.length === 0) return false
  return jobPostingContent.split(/\r?\n/u).some((line) => (
    readTargetRoleTitle({ line }) === targetRoleValue
  ))
}

function readTargetRoleTitle({ line }: Readonly<{ line: string }>) {
  const trimmedLine = line.trim()
  return trimmedLine.match(targetRoleLabel)?.[1]?.trim() ?? null
}
