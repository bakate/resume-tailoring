import { createJobMatch, type JobMatch } from '@resume-tailoring/application/job-match'
import { createSourceIntake, type SourceIntake } from '@resume-tailoring/application/source-intake'

import type { ModelConnection } from '../adapters/server/language-model-request'
import { createModelJobMatchEvidenceMatcher } from '../adapters/server/model-job-match-evidence-matcher'
import { createModelJobPostingExtractor } from '../adapters/server/model-job-posting-extractor'
import { createModelStructuredSourceProfileExtractor } from '../adapters/server/model-structured-source-profile-extractor'

/** A pasted resume through the production Source Profile extraction, as the intake route runs it. */
export async function readLiveSourceIntake({ resume, structured }: Readonly<{
  resume: string
  structured: ModelConnection
}>): Promise<SourceIntake> {
  const result = await createSourceIntake({
    document: { bytes: new TextEncoder().encode(resume), mediaType: 'text/plain', name: 'pasted-resume.txt' },
    sourceDocumentReader: { read: () => Promise.resolve({ ok: true, value: { pageCount: null, text: resume } }) },
    sourceProfileExtractor: createModelStructuredSourceProfileExtractor(structured),
  })
  if (!result.ok) throw new Error(`Source Intake failed: ${result.error}`)
  return result.value
}

/** A pasted Job Posting through the production extraction and Match Evidence, against the given Candidate Facts. */
export async function readLiveJobMatch({ candidateFacts, jobPosting, structured }: Readonly<{
  candidateFacts: SourceIntake['candidateFacts']
  jobPosting: string
  structured: ModelConnection
}>): Promise<JobMatch> {
  const result = await createJobMatch({
    candidateFacts,
    document: { bytes: new TextEncoder().encode(jobPosting), mediaType: 'text/plain', name: 'pasted-job-posting.txt' },
    jobPostingDocumentReader: { read: () => Promise.resolve({ ok: true, value: { text: jobPosting } }) },
    jobPostingExtractor: createModelJobPostingExtractor(structured),
    matchEvidenceMatcher: createModelJobMatchEvidenceMatcher(structured),
    now: Date.now,
  })
  if (!result.ok) throw new Error(`Job Match failed: ${result.error}`)
  return result.value
}

/** Requirement Coverage keyed by Job Requirement value, since requirement ids are only positions in one extraction. */
export function readCoverageByRequirement(jobMatch: JobMatch) {
  return Object.fromEntries(jobMatch.requirements.map(({ id, value }) => [value,
    jobMatch.analysis.requirementGroups.find(({ requirementIds }) => requirementIds.includes(id))?.coverage ?? null]))
}
