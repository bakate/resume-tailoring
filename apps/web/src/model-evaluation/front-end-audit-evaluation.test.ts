import { describe, expect, it } from 'vitest'

import { readAuditedCoverage } from './front-end-audit-evaluation'

describe('audited Requirement Coverage of the front-end audit', () => {
  it('finds the requirement whose value states what the audit looks for', () => {
    const jobMatch = createJobMatch({ value: '3 ans d\'expérience minimum en React', sourceExcerpt: '3 ans d\'expérience minimum en React' })

    const coverage = readAuditedCoverage({ jobMatch, requirement: /3 ans/iu })

    expect(coverage).toBe('covered')
  })

  it('finds the requirement whose excerpt states it when its value names the capability alone (BAK-175)', () => {
    const jobMatch = createJobMatch({ value: 'React', sourceExcerpt: '3 ans d\'expérience minimum en React' })

    const coverage = readAuditedCoverage({ jobMatch, requirement: /3 ans/iu })

    expect(coverage).toBe('covered')
  })

  it('reads no coverage when no requirement states what the audit looks for', () => {
    const jobMatch = createJobMatch({ value: 'React', sourceExcerpt: 'Développer de nouvelles fonctionnalités en React' })

    const coverage = readAuditedCoverage({ jobMatch, requirement: /3 ans/iu })

    expect(coverage).toBeNull()
  })
})

function createJobMatch({ sourceExcerpt, value }: Readonly<{ sourceExcerpt: string; value: string }>) {
  const id = 'job-requirement-1' as const
  return {
    requirements: [{ id, sourceExcerpt, value }],
    analysis: { requirementGroups: [{ requirementIds: [id], coverage: 'covered' as const }] },
  }
}
