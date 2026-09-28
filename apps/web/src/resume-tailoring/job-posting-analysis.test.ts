import type {
  ResumeTailoringCommand,
  ResumeTailoringResult,
  ResumeTailoringView,
  ResumeTailoringWorkflow,
  SourceDocument,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import type {
  SourceDocumentReader,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import { describe, expect, it } from 'vitest'

import { createJobPostingAnalysis } from './job-posting-analysis'

describe('Job Posting analysis', () => {
  it('reviews pasted content, extracts requirements, and analyzes the match in one action', async () => {
    const system = createSystemUnderTest()

    const result = await system.analysis.analyzePastedJobPosting({
      content: 'Senior TypeScript Developer',
    })

    expect(result).toEqual(successResult)
    expect(system.commands).toEqual([
      { type: 'review-job-posting', content: 'Senior TypeScript Developer' },
      { type: 'extract-job-requirements' },
      { type: 'analyze-match' },
    ])
  })

  it.each([
    ['PDF', { bytes: new Uint8Array([37, 80, 68, 70]), mediaType: 'application/pdf', name: 'job.pdf' }],
    ['TXT', { bytes: new TextEncoder().encode('job'), mediaType: 'text/plain', name: 'job.txt' }],
  ] as const)('sends an uploaded %s through the same analysis journey', async (_format, document) => {
    const system = createSystemUnderTest()

    const result = await system.analysis.analyzeUploadedJobPosting({ document })

    expect(result).toEqual(successResult)
    expect(system.documents).toEqual([document])
    expect(system.commands).toEqual([
      { type: 'review-job-posting', content: 'Senior TypeScript Developer' },
      { type: 'extract-job-requirements' },
      { type: 'analyze-match' },
    ])
  })

  it('returns the typed extraction failure without discarding the review retry seam', async () => {
    const extractionFailure = {
      ok: false,
      error: { type: 'job-requirement-transport-unavailable' },
    } as const satisfies ResumeTailoringResult<ResumeTailoringView>
    const system = createSystemUnderTest({ commandFailure: extractionFailure })

    const result = await system.analysis.analyzePastedJobPosting({
      content: 'Senior TypeScript Developer',
    })

    expect(result).toEqual(extractionFailure)
    expect(system.commands).toEqual([
      { type: 'review-job-posting', content: 'Senior TypeScript Developer' },
      { type: 'extract-job-requirements' },
    ])
  })

  it('returns a typed document failure before starting the analysis journey', async () => {
    const documentFailure = {
      ok: false,
      error: { type: 'unreadable-source-document', reason: 'text-empty' },
    } as const
    const system = createSystemUnderTest({ documentFailure })

    const result = await system.analysis.analyzeUploadedJobPosting({
      document: { bytes: new Uint8Array(), mediaType: 'text/plain', name: 'empty.txt' },
    })

    expect(result).toEqual(documentFailure)
    expect(system.commands).toEqual([])
  })
})

function createSystemUnderTest({
  commandFailure,
  documentFailure,
}: Readonly<{
  commandFailure?: ResumeTailoringResult<ResumeTailoringView>
  documentFailure?: Awaited<ReturnType<SourceDocumentReader['read']>>
}> = {}) {
  const commands: ResumeTailoringCommand[] = []
  const documents: SourceDocument[] = []
  const execute: ResumeTailoringWorkflow['execute'] = (command) => {
    commands.push(command)
    if (command.type === 'extract-job-requirements' && commandFailure !== undefined) {
      return Promise.resolve(commandFailure)
    }
    return Promise.resolve(successResult)
  }
  const sourceDocumentReader: SourceDocumentReader = {
    read: (document) => {
      documents.push(document)
      return Promise.resolve(documentFailure ?? {
        ok: true,
        value: 'Senior TypeScript Developer',
      })
    },
  }
  return {
    analysis: createJobPostingAnalysis({ execute, sourceDocumentReader }),
    commands,
    documents,
  }
}

const successResult = {
  ok: true,
  value: {
    status: 'ready',
    sessionId: 'candidate-session-test',
    expiresAt: 1,
  },
} as const satisfies ResumeTailoringResult<ResumeTailoringView>
