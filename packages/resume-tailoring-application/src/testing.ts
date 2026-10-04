/**
 * One in-memory fake per Candidate Journey port. Each fake answers from the anonymized structured-resume fixtures so
 * a behavior test overrides only the behavior it varies.
 */
import type {
  CandidateSession,
} from './candidate-journey'
import type { MatchEvidenceProposal } from './job-match'
import type { ProcessingPolicy } from './language-model-gateway'
import type { PrivacySafeTelemetryEvent } from './privacy-safe-telemetry'
import { assessResumeExport } from './resume-export'
import type { ResumeRenderRequest } from './resume-export'
import { readGroupedResumeSection, structuredResumeJobMatch, structuredResumeSource } from './structured-resume-fixtures'
import type { CandidateJourneyDependencies, CandidateSessionPersistence, CandidateSessionStorageResult,
  JobPostingDocumentReader, JobPostingExtractor, MatchEvidenceMatcher, PrivacySafeTelemetry, ResumeDocumentPorts,
  ResumeDocumentRenderer, ResumeSectionModels, SourceDocumentReader, StructuredSourceProfileExtractor } from './ports'

export { describeCandidateSessionPersistenceContract } from './candidate-session-persistence-contract'
export type { CandidateSessionPersistenceSetup } from './candidate-session-persistence-contract'

export const testProcessingPolicy = {
  provider: 'Test', purposes: ['Write'], retentionPolicy: 'None',
  storageBehavior: 'Browser-local', transmittedDataCategories: ['Evidence'], version: 'test',
} as const satisfies ProcessingPolicy

/** Correspondence between the fixture React skill and the fixture React requirement. */
const reactFactMatch = { factId: 'source-fact-skills-0-name-0', factExcerpt: 'React', requirementExcerpt: 'React' } as const

export const fixtureMatchEvidence = {
  adjacentEvidence: [],
  evidence: [{ coverage: 'covered', factMatches: [reactFactMatch], requirementId: 'job-requirement-react' }],
  relevance: [{ requirementId: 'job-requirement-react', factMatch: reactFactMatch }],
} as const satisfies MatchEvidenceProposal

export const noMatchEvidence = { adjacentEvidence: [], evidence: [], relevance: [] } as const satisfies MatchEvidenceProposal

const unavailableStorage = { ok: false, error: 'candidate-session-storage-unavailable' } as const

/** Keeps one Candidate Session in memory and returns it as stored, as browser storage does. */
export function createInMemoryCandidateSessionPersistence({ session = null, storageAvailable = true }: Readonly<{
  session?: CandidateSession | null
  storageAvailable?: boolean
}> = {}): CandidateSessionPersistence & Readonly<{ readStoredSession: () => CandidateSession | null }> {
  let storedSession = session
  const store = <TValue>(operation: () => TValue): CandidateSessionStorageResult<TValue> =>
    storageAvailable ? { ok: true, value: operation() } : unavailableStorage
  return {
    delete: () => store(() => { storedSession = null; return null }),
    restore: () => store(() => ({ notice: null, session: storedSession })),
    save: ({ session: nextSession }) => store(() => { storedSession = nextSession; return nextSession }),
    readStoredSession: () => storedSession,
  }
}

/** Reads every Source Document as UTF-8 text without a known page count. */
export function createFakeSourceDocumentReader(overrides: Partial<SourceDocumentReader> = {}): SourceDocumentReader {
  return {
    read: ({ bytes }) => Promise.resolve({ ok: true, value: { pageCount: null, text: new TextDecoder().decode(bytes) } }),
    ...overrides,
  }
}

/** Extracts the fixture Source Profile, without Critical Ambiguities, from any professional content. */
export function createFakeSourceProfileExtractor(
  overrides: Partial<StructuredSourceProfileExtractor> = {},
): StructuredSourceProfileExtractor {
  return {
    extract: () => Promise.resolve({ ok: true, value: { ...structuredResumeSource.sourceProfile, criticalAmbiguities: [] } }),
    ...overrides,
  }
}

/** Reads every Job Posting as UTF-8 text. */
export function createFakeJobPostingDocumentReader(overrides: Partial<JobPostingDocumentReader> = {}): JobPostingDocumentReader {
  return {
    read: ({ bytes }) => Promise.resolve({ ok: true, value: { text: new TextDecoder().decode(bytes) } }),
    ...overrides,
  }
}

/** Extracts the fixture Job Posting requirements from any Job Posting content. */
export function createFakeJobPostingExtractor(overrides: Partial<JobPostingExtractor> = {}): JobPostingExtractor {
  return {
    extract: () => Promise.resolve({ ok: true, value: structuredResumeJobMatch }),
    ...overrides,
  }
}

/** Matches the fixture React skill to the fixture React requirement. */
export function createFakeMatchEvidenceMatcher(overrides: Partial<MatchEvidenceMatcher> = {}): MatchEvidenceMatcher {
  return {
    match: () => Promise.resolve({ ok: true, value: fixtureMatchEvidence }),
    ...overrides,
  }
}

/** Section models answering with slices of `groupedResumeDocument`. */
export function createFakeResumeSectionModels(overrides: Partial<ResumeSectionModels> = {}): ResumeSectionModels {
  return {
    writeSection: ({ section }) => Promise.resolve({ ok: true, value: readGroupedResumeSection(section) }),
    validateFields: ({ fields }) => Promise.resolve({ ok: true,
      value: { fields: fields.map(({ id }) => ({ fieldId: id, supported: true })) } }),
    checkCoherence: () => Promise.resolve({ ok: true, value: { coherent: true, languageMatches: true, issues: [] } }),
    ...overrides,
  }
}

/** Lays out every draft on one page; export eligibility follows the draft's own content. */
export function createFakeResumeDocumentRenderer(overrides: Partial<ResumeDocumentRenderer> = {}): ResumeDocumentRenderer {
  return {
    render: (request) => Promise.resolve({ assessment: assessOnePageLayout(request), pdf: new TextEncoder().encode('%PDF-') }),
    ...overrides,
  }
}

/**
 * Never vouches for a claim's meaning, lays out every draft on one page, and keeps condensed wording unchanged. A
 * scenario that accepts an edit or a condensation overrides `validateClaim`.
 */
export function createFakeResumeDocumentPorts(overrides: Partial<ResumeDocumentPorts> = {}): ResumeDocumentPorts {
  return {
    validateClaim: () => Promise.resolve({ ok: true, value: { supported: false } }),
    condenseClaim: ({ claim }) => Promise.resolve({ ok: true, value: claim }),
    assessLayout: (request) => Promise.resolve(assessOnePageLayout(request)),
    ...overrides,
  }
}

/** Records every privacy-safe event in order. */
export function createRecordingTelemetry(): PrivacySafeTelemetry & Readonly<{ events: readonly PrivacySafeTelemetryEvent[] }> {
  const events: PrivacySafeTelemetryEvent[] = []
  return {
    events,
    record: (event) => { events.push(event); return Promise.resolve({ ok: true, value: undefined }) },
  }
}

/** Announces the test Processing Policy. */
export function createFakeLanguageModelGateway(
  overrides: Partial<CandidateJourneyDependencies['languageModelGateway']> = {},
): CandidateJourneyDependencies['languageModelGateway'] {
  return { processingPolicy: testProcessingPolicy, ...overrides }
}

/**
 * Every required Candidate Journey dependency backed by its fake; a test overrides only the dependencies it varies. The
 * optional section models, document ports, renderer, and telemetry stay absent unless a test passes them.
 */
export function createFakeCandidateJourneyDependencies(
  overrides: Partial<CandidateJourneyDependencies> = {},
): CandidateJourneyDependencies {
  let sessionCount = 0
  return {
    createIdentifier: () => {
      sessionCount += 1
      return `00000000-0000-4000-8000-${String(sessionCount).padStart(12, '0')}`
    },
    now: () => Date.now(),
    jobPostingDocumentReader: createFakeJobPostingDocumentReader(),
    jobPostingExtractor: createFakeJobPostingExtractor(),
    languageModelGateway: createFakeLanguageModelGateway(),
    matchEvidenceMatcher: createFakeMatchEvidenceMatcher(),
    persistence: createInMemoryCandidateSessionPersistence(),
    sourceDocumentReader: createFakeSourceDocumentReader(),
    sourceProfileExtractor: createFakeSourceProfileExtractor(),
    ...overrides,
  }
}

function assessOnePageLayout(request: Omit<ResumeRenderRequest, 'photoDataUrl'>) {
  return assessResumeExport({ ...request, layout: { status: 'fits', revision: request.draft.revision, pageCount: 1 } })
}
