import type {
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
  SourceDocument,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import type {
  SourceDocumentReader,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'

type JobPostingAnalysisDependencies = Readonly<{
  execute: ResumeTailoringWorkflow['execute']
  sourceDocumentReader: SourceDocumentReader
}>

export function createJobPostingAnalysis(dependencies: JobPostingAnalysisDependencies) {
  return {
    analyzePastedJobPosting: ({ content }: Readonly<{ content: string }>) =>
      analyzeJobPosting({ ...dependencies, content }),
    analyzeUploadedJobPosting: ({ document }: Readonly<{ document: SourceDocument }>) =>
      analyzeUploadedJobPosting({ ...dependencies, document }),
  }
}

async function analyzeUploadedJobPosting({
  document,
  sourceDocumentReader,
  ...dependencies
}: JobPostingAnalysisDependencies & Readonly<{ document: SourceDocument }>) {
  const readResult = await sourceDocumentReader.read(document)
  if (!readResult.ok) return readResult
  return analyzeJobPosting({ ...dependencies, content: readResult.value })
}

async function analyzeJobPosting({
  content,
  execute,
}: Pick<JobPostingAnalysisDependencies, 'execute'> & Readonly<{ content: string }>): Promise<
  ResumeTailoringResult<ResumeTailoringView>
> {
  const reviewed = await execute({ type: 'review-job-posting', content })
  if (!reviewed.ok) return reviewed
  const extracted = await execute({ type: 'extract-job-requirements' })
  if (!extracted.ok) return extracted
  return execute({ type: 'analyze-match' })
}
