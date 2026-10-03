import type {
  CandidateFact,
  CriticalAmbiguity,
  SourceIntake,
  SourceProfileSection,
  StructuredSourceProfile,
} from '@resume-tailoring/domain/source-intake'
import { sourceProfileSections } from '@resume-tailoring/domain/source-intake'

import { minimizeCandidateContent } from './candidate-name'
import { locateSourceSpan } from './source-span'

export type {
  CandidateFact,
  CriticalAmbiguity,
  SourceIntake,
  StructuredSourceProfile,
} from '@resume-tailoring/domain/source-intake'

export type SourceDocument = Readonly<{
  bytes: Uint8Array
  mediaType: string
  name: string
}>

export type SourceDocumentFailure =
  | 'encrypted-document'
  | 'empty-document'
  | 'invalid-document'
  | 'oversized-document'
  | 'scanned-document'
  | 'unsupported-document'
  | 'unreadable-document'

export type SourceDocumentReader = Readonly<{
  read: (document: SourceDocument) => Promise<
    | Readonly<{ ok: true; value: Readonly<{ pageCount: number | null; text: string }> }>
    | Readonly<{ ok: false; error: SourceDocumentFailure }>
  >
}>

export type StructuredSourceProfileExtraction = StructuredSourceProfile & Readonly<{
  criticalAmbiguities: readonly Readonly<{
    path: string
    question: string
  }>[]
}>

export type StructuredSourceProfileExtractor = Readonly<{
  extract: (request: Readonly<{ professionalContent: string }>) => Promise<
    | Readonly<{ ok: true; value: StructuredSourceProfileExtraction }>
    | Readonly<{
        ok: false
        error: 'processing-consent-required' | 'source-profile-extraction-unavailable'
      }>
  >
}>

export type SourceIntakeFailure =
  | SourceDocumentFailure
  | 'processing-consent-required'
  | 'source-profile-extraction-unavailable'

type CreateSourceIntakeInput = Readonly<{
  document: SourceDocument
  sourceDocumentReader: SourceDocumentReader
  sourceProfileExtractor: StructuredSourceProfileExtractor
}>
type CreateSourceIntakeResult = Promise<
  | Readonly<{ ok: true; value: SourceIntake }>
  | Readonly<{ ok: false; error: SourceIntakeFailure }>
>

export async function createSourceIntake(
  input: CreateSourceIntakeInput,
): CreateSourceIntakeResult {
  const contentResult = await readValidatedSourceContent(input)
  if (!contentResult.ok) return contentResult
  const minimizedContent = minimizeCandidateContent({ content: contentResult.value })
  if (minimizedContent.outgoingContent.trim().length === 0) return emptyResult
  const extractionResult = await input.sourceProfileExtractor.extract({
    professionalContent: minimizedContent.outgoingContent,
  })
  if (!extractionResult.ok) return extractionResult
  const sourceIntake = buildSourceIntake({
    document: input.document, extraction: extractionResult.value,
    minimizedContent, originalContent: contentResult.value,
  })
  if (!hasValidExtractedFacts({ extraction: extractionResult.value, sourceIntake })) {
    return extractionUnavailableResult
  }
  return { ok: true, value: sourceIntake }
}

async function readValidatedSourceContent({
  document, sourceDocumentReader,
}: CreateSourceIntakeInput) {
  if (document.bytes.byteLength > maximumSourceDocumentBytes) return oversizedResult
  const documentResult = await sourceDocumentReader.read(document)
  return documentResult.ok
    ? validateSourceDocumentContent({ content: documentResult.value })
    : documentResult
}

function validateSourceDocumentContent({ content }: Readonly<{
  content: Readonly<{ pageCount: number | null; text: string }>
}>) {
  if (content.pageCount !== null && content.pageCount > maximumSourceDocumentPages) {
    return oversizedResult
  }
  const originalContent = content.text.trim()
  if (originalContent.length === 0) return emptyResult
  if (originalContent.length > maximumSourceDocumentCharacters) return oversizedResult
  return { ok: true, value: originalContent } as const
}

function hasValidExtractedFacts({ extraction, sourceIntake }: Readonly<{
  extraction: StructuredSourceProfileExtraction
  sourceIntake: SourceIntake
}>) {
  const ambiguityPaths = extraction.criticalAmbiguities.map(({ path }) => path)
  return sourceIntake.candidateFacts.length > 0
    && sourceIntake.criticalAmbiguities.length === ambiguityPaths.length
    && new Set(ambiguityPaths).size === ambiguityPaths.length
}

type ResolveCriticalAmbiguityInput = Readonly<{
  answer: string
  criticalAmbiguityId: CriticalAmbiguity['id']
  sourceIntake: SourceIntake
}>

export function resolveCriticalAmbiguity({
  answer, criticalAmbiguityId, sourceIntake,
}: ResolveCriticalAmbiguityInput) {
  const normalizedAnswer = answer.trim()
  const ambiguity = sourceIntake.criticalAmbiguities.find(
    (candidateAmbiguity) => candidateAmbiguity.id === criticalAmbiguityId,
  )
  if (ambiguity === undefined || normalizedAnswer.length === 0) return ambiguityUnavailableResult
  return { ok: true, value: createResolvedSourceIntake({
    ambiguity, answer: normalizedAnswer, sourceIntake,
  }) } as const
}

function createResolvedSourceIntake({ ambiguity, answer, sourceIntake }: Readonly<{
  ambiguity: CriticalAmbiguity
  answer: string
  sourceIntake: SourceIntake
}>): SourceIntake {
  return {
    ...sourceIntake,
    candidateFacts: sourceIntake.candidateFacts.map((candidateFact) => (
      candidateFact.id === ambiguity.candidateFactId
        ? { ...candidateFact, status: 'attested' as const, value: answer }
        : candidateFact
    )),
    criticalAmbiguities: sourceIntake.criticalAmbiguities.filter(({ id }) => id !== ambiguity.id),
    sourceProfile: applyResolvedAnswer({ answer, path: ambiguity.path, sourceProfile: sourceIntake.sourceProfile }),
  }
}

function applyResolvedAnswer({
  answer,
  path,
  sourceProfile,
}: Readonly<{
  answer: string
  path: string
  sourceProfile: StructuredSourceProfile
}>): StructuredSourceProfile {
  const profilePath = parseProfilePath({ path })
  if (profilePath === null) return sourceProfile
  const entries = sourceProfile[profilePath.section] as readonly Readonly<Record<string, unknown>>[]
  return {
    ...sourceProfile,
    [profilePath.section]: updateProfileEntries({ answer, entries, ...profilePath }),
  } as StructuredSourceProfile
}

function updateProfileEntries<TEntry extends Readonly<Record<string, unknown>>>({
  answer,
  entries,
  entryIndex,
  field,
  valueIndex,
}: Readonly<{
  answer: string
  entries: readonly TEntry[]
  entryIndex: number
  field: string
  valueIndex: number
}>): readonly TEntry[] {
  return entries.map((entry, candidateEntryIndex) => {
    if (candidateEntryIndex !== entryIndex || !(field in entry)) return entry
    const currentValue = entry[field]
    const resolvedValue = Array.isArray(currentValue)
      ? (currentValue as readonly unknown[]).map((value, candidateValueIndex) => (
          candidateValueIndex === valueIndex || typeof value !== 'string' ? answer : value
        ))
      : answer
    return { ...entry, [field]: resolvedValue }
  })
}

type BuildSourceIntakeInput = Readonly<{
  document: SourceDocument
  extraction: StructuredSourceProfileExtraction
  minimizedContent: ReturnType<typeof minimizeCandidateContent>
  originalContent: string
}>

function buildSourceIntake({
  document, extraction: proposedExtraction, minimizedContent, originalContent,
}: BuildSourceIntakeInput): SourceIntake {
  const extraction = anchorExperienceLocations({ extraction: proposedExtraction, originalContent })
  const candidateFacts = createCandidateFacts({ extraction })
  const ambiguousPaths = new Set(extraction.criticalAmbiguities.map((ambiguity) => ambiguity.path))
  const assessedCandidateFacts = assessCandidateFacts({ ambiguousPaths, candidateFacts })
  return {
    candidateFacts: assessedCandidateFacts,
    contactDetails: minimizedContent.detectedSensitiveContent.map(({ kind, value }) => ({
      kind, value,
    })),
    criticalAmbiguities: createCriticalAmbiguities({ assessedCandidateFacts, extraction }),
    originalContent,
    sourceDocument: { kind: readSourceDocumentKind({ document }), name: document.name },
    sourceProfile: readStructuredSourceProfile({ extraction }),
  }
}

/**
 * A location is kept exactly as the Source Document writes it, so "Paris, France" is never shortened or reworded;
 * a location the source does not contain is dropped rather than shown on the resume.
 */
function anchorExperienceLocations({ extraction, originalContent }: Readonly<{
  extraction: StructuredSourceProfileExtraction; originalContent: string
}>): StructuredSourceProfileExtraction {
  return { ...extraction, experiences: extraction.experiences.map((experience) => {
    const location = experience.location ?? null
    return { ...experience,
      location: location === null ? null : locateSourceSpan({ text: originalContent, quote: location }) }
  }) }
}

function readStructuredSourceProfile({ extraction }: Readonly<{
  extraction: StructuredSourceProfileExtraction
}>): StructuredSourceProfile {
  return {
    certifications: extraction.certifications,
    education: extraction.education,
    experiences: extraction.experiences,
    languages: extraction.languages,
    projects: extraction.projects,
    skills: extraction.skills,
  }
}

function assessCandidateFacts({ ambiguousPaths, candidateFacts }: Readonly<{
  ambiguousPaths: ReadonlySet<string>
  candidateFacts: readonly CandidateFact[]
}>) {
  return candidateFacts.map((candidateFact) => ({
    ...candidateFact,
    status: ambiguousPaths.has(candidateFact.path)
      ? 'excluded-critical-ambiguity' as const
      : 'attested' as const,
  }))
}

function createCriticalAmbiguities({ assessedCandidateFacts, extraction }: Readonly<{
  assessedCandidateFacts: readonly CandidateFact[]
  extraction: StructuredSourceProfileExtraction
}>) {
  return extraction.criticalAmbiguities.flatMap((ambiguity, ambiguityIndex) => {
    const candidateFact = assessedCandidateFacts.find(({ path }) => path === ambiguity.path)
    return candidateFact === undefined ? [] : [{
      candidateFactId: candidateFact.id,
      id: `critical-ambiguity-${String(ambiguityIndex + 1)}` as const,
      path: ambiguity.path,
      question: ambiguity.question,
    }]
  })
}

function createCandidateFacts({ extraction }: Readonly<{
  extraction: StructuredSourceProfileExtraction
}>): readonly CandidateFact[] {
  const extractedFacts = createExtractedCandidateFacts({ extraction })
  const extractedPaths = new Set(extractedFacts.map(({ path }) => path))
  const unresolvedFacts = extraction.criticalAmbiguities.flatMap(({ path }) => (
    !extractedPaths.has(path) && readProfileValue({ extraction, path }) === null
      ? [createCandidateFactFromPath({ path, value: '' })]
      : []
  ))
  return [...extractedFacts, ...unresolvedFacts]
}

function createExtractedCandidateFacts({ extraction }: Readonly<{
  extraction: StructuredSourceProfileExtraction
}>) {
  return Object.entries(extraction)
    .filter(([section]) => section !== 'criticalAmbiguities')
    .flatMap(([section, entries]) => (entries as readonly Readonly<Record<string, unknown>>[])
      .flatMap((entry, entryIndex) => Object.entries(entry).flatMap(([field, rawValue]) => {
        const values = Array.isArray(rawValue) ? rawValue : [rawValue]
        return values.flatMap((value, valueIndex) => typeof value === 'string' && value.length > 0
          ? [createCandidateFact({ entryIndex, field, section, value, valueIndex })]
          : [])
      })))
}

function createCandidateFact({
  entryIndex,
  field,
  section,
  value,
  valueIndex,
}: Readonly<{
  entryIndex: number
  field: string
  section: string
  value: string
  valueIndex: number
}>): CandidateFact {
  const path = `${section}.${String(entryIndex)}.${field}.${String(valueIndex)}`
  return createCandidateFactFromPath({ path, value })
}

function createCandidateFactFromPath({ path, value }: Readonly<{
  path: string
  value: string
}>): CandidateFact {
  return {
    id: `source-fact-${path.replaceAll('.', '-')}`,
    path,
    status: 'attested',
    value,
  }
}

function parseProfilePath({ path }: Readonly<{ path: string }>) {
  const [section, entryIndexText, field, valueIndexText] = path.split('.')
  const entryIndex = Number(entryIndexText)
  const valueIndex = Number(valueIndexText)
  if (!isSourceProfileSection(section) || field === undefined
    || !Number.isInteger(entryIndex) || !Number.isInteger(valueIndex)) {
    return null
  }
  return { entryIndex, field, section, valueIndex } as const
}

function isSourceProfileSection(section: string | undefined): section is SourceProfileSection {
  return sourceProfileSections.some((candidateSection) => candidateSection === section)
}

function readProfileValue({ extraction, path }: Readonly<{
  extraction: StructuredSourceProfileExtraction
  path: string
}>) {
  const profilePath = parseProfilePath({ path })
  if (profilePath === null) return undefined
  const entry = extraction[profilePath.section][profilePath.entryIndex]
  if (entry === undefined || !(profilePath.field in entry)) return undefined
  const rawValue = (entry as Readonly<Record<string, unknown>>)[profilePath.field]
  if (Array.isArray(rawValue)) {
    return (rawValue as readonly unknown[])[profilePath.valueIndex]
  }
  return profilePath.valueIndex === 0 ? rawValue : undefined
}

function readSourceDocumentKind({ document }: Readonly<{ document: SourceDocument }>) {
  if (document.mediaType === docxMediaType || document.name.toLowerCase().endsWith('.docx')) {
    return 'docx' as const
  }
  if (document.mediaType === 'application/pdf' || document.name.toLowerCase().endsWith('.pdf')) {
    return 'pdf' as const
  }
  return 'pasted-text' as const
}

export const maximumSourceDocumentBytes = 5 * 1_024 * 1_024
export const maximumSourceDocumentCharacters = 50_000
export const maximumSourceDocumentPages = 5
export const docxMediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const oversizedResult = { ok: false, error: 'oversized-document' } as const
const emptyResult = { ok: false, error: 'empty-document' } as const
const extractionUnavailableResult = {
  ok: false,
  error: 'source-profile-extraction-unavailable',
} as const
const ambiguityUnavailableResult = { ok: false, error: 'ambiguity-unavailable' } as const
