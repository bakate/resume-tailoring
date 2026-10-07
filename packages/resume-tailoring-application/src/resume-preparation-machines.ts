import { assign, enqueueActions, fromPromise, sendParent, setup } from 'xstate'
import type { ResumeSectionSnapshot } from '@resume-tailoring/domain/candidate-session'
import type { PrivacySafeTelemetryEvent, resumeSectionOutcomes } from './privacy-safe-telemetry'
import type { ResumeOperationFailure, ResumePreparationOutcome } from './structured-resume-contract'
import { assembleResumeDocumentWithOrigins, citedCandidateFacts, createSectionWritingInput, hasSupportedSectionStructure,
  isSectionFullyValidated, normalizeSectionContent, planResumeSections, readRejectedFields,
  readSectionContentFields, removeSectionFields } from './resume-sections'
import type { ResumeCoherenceIssue, ResumeDocumentCoherence, ResumeFieldValidation, ResumeFieldValidationInput, ResumeModelUsage,
  ResumeRejectedField, ResumeSectionContent, ResumeSectionModelResult, ResumeSectionPlanEntry, ResumeSectionsRequest,
  ResumeSectionWritingInput } from './resume-sections'
import type { ReadApiFailure, ResumeSectionModels } from './ports'
import { explainFailure, isRetryable } from './failure-cause'
import type { ExplainedFailure } from './failure-cause'

/** Why one Resume Section failed: its content was unsupported, or its last model call failed with this error. */
type ResumeSectionFailure = Readonly<{ type: Exclude<typeof resumeSectionOutcomes[number], 'validated'>; retryAfterSeconds?: number }>

export type ResumeSectionResult = Readonly<{
  section: ResumeSectionPlanEntry
  attempt: number
  durationMilliseconds: number
  usage: ResumeModelUsage
}> & (Readonly<{ status: 'validated'; content: ResumeSectionContent }>
  | Readonly<{ status: 'failed'; failure: ResumeSectionFailure }>)

type SectionProgressStatus = 'writing' | 'validating'

type ResumeSectionMachineInput = Readonly<{
  writingInput: ResumeSectionWritingInput
  models: ResumeSectionModels
  now: () => number
}>

type ResumeSectionMachineContext = ResumeSectionMachineInput & Readonly<{
  attempt: number
  content: ResumeSectionContent | null
  /** The latest version written, kept while `content` is cleared for the next attempt. */
  latestContent: ResumeSectionContent | null
  failure: ResumeSectionFailure | null
  rejectedFields: readonly ResumeRejectedField[]
  startedAt: number
  usage: ResumeModelUsage
}>

const noUsage: ResumeModelUsage = { inputTokens: 0, outputTokens: 0 }
/**
 * Only failures a second attempt can overcome cost a rewrite: unsupported content, an invalid provider response, or a
 * timeout. Any other failure would fail the same way again, so the Candidate is told at once.
 */
const rewritableFailures: ReadonlySet<ResumeSectionFailure['type']> = new Set(['unsupported', 'invalid-provider-response', 'timeout'])
const maximumSectionAttempts = 2
const maximumConcurrentSections = 4

async function callModel<TValue>(call: () => Promise<ResumeSectionModelResult<TValue>>): Promise<ResumeSectionModelResult<TValue>> {
  try { return await call() } catch { return { ok: false, error: { type: 'unexpected-response' } } }
}

const writeSection = fromPromise<ResumeSectionModelResult<ResumeSectionContent>, ResumeSectionMachineInput>(
  ({ input }) => callModel(() => input.models.writeSection(input.writingInput)))

/**
 * A rewrite learns what was rejected and starts from the latest written version, so it changes only that; the
 * text never leaves this section actor.
 */
function readRewritingInput(context: ResumeSectionMachineContext): ResumeSectionMachineInput {
  return { ...context, writingInput: { ...context.writingInput, rejectedFields: context.rejectedFields,
    previousContent: context.latestContent } }
}

const validateSectionFields = fromPromise<ResumeSectionModelResult<ResumeFieldValidation>, Readonly<{
  models: ResumeSectionModels; input: ResumeFieldValidationInput
}>>(({ input }) => callModel(() => input.models.validateFields(input.input)))

type SectionStep = Pick<ResumeSectionMachineContext, 'content' | 'failure' | 'rejectedFields' | 'usage'>

function readWriting({ context, result }: Readonly<{
  context: ResumeSectionMachineContext; result: ResumeSectionModelResult<ResumeSectionContent>
}>): SectionStep {
  const usage = addUsage(context.usage, result.usage)
  // A failed or unstructured write rejected no field, so its retry keeps the feedback the attempt was given.
  if (!result.ok) return { content: null, failure: result.error, rejectedFields: context.rejectedFields, usage }
  const { section, purpose, relevantFactIds } = context.writingInput
  const content = normalizeSectionContent({ content: result.value, purpose, section, relevantFactIds })
  return hasSupportedSectionStructure({ content, input: context.writingInput })
    ? { content, failure: null, rejectedFields: [], usage }
    : { content: null, failure: unsupported, rejectedFields: context.rejectedFields, usage }
}

function readValidation({ context, result }: Readonly<{
  context: ResumeSectionMachineContext; result: ResumeSectionModelResult<ResumeFieldValidation>
}>): SectionStep {
  const usage = addUsage(context.usage, result.usage)
  if (!result.ok) return { content: context.content, failure: result.error, rejectedFields: [], usage }
  if (context.content === null) return { content: null, failure: unsupported, rejectedFields: [], usage }
  return isSectionFullyValidated({ content: context.content, validation: result.value })
    ? { content: context.content, failure: null, rejectedFields: [], usage }
    // The coherence feedback a rewritten section started from still applies to its next rewrite.
    : { content: context.content, failure: unsupported, usage, rejectedFields: [...context.writingInput.rejectedFields,
      ...readRejectedFields({ content: context.content, validation: result.value })] }
}

function canRewrite({ context, step }: Readonly<{ context: ResumeSectionMachineContext; step: SectionStep }>) {
  return context.attempt < maximumSectionAttempts && step.failure !== null && rewritableFailures.has(step.failure.type)
}

const unsupported: ResumeSectionFailure = { type: 'unsupported' }

function addUsage(total: ResumeModelUsage, usage: ResumeModelUsage | undefined): ResumeModelUsage {
  return usage === undefined ? total
    : { inputTokens: total.inputTokens + usage.inputTokens, outputTokens: total.outputTokens + usage.outputTokens }
}

function readSectionResult(context: ResumeSectionMachineContext): ResumeSectionResult {
  const measured = { section: context.writingInput.section, attempt: context.attempt, usage: context.usage,
    durationMilliseconds: Math.max(0, context.now() - context.startedAt) }
  return context.failure === null && context.content !== null
    ? { ...measured, status: 'validated', content: context.content }
    : { ...measured, status: 'failed', failure: context.failure ?? { type: 'unexpected-response' } }
}

/** Writes and validates one Resume Section; a rewritable failure rewrites it once. */
export const resumeSectionMachine = setup({
  types: {} as { context: ResumeSectionMachineContext; input: ResumeSectionMachineInput },
  actors: { writeSection, validateSectionFields },
  actions: {
    reportSectionFinished: sendParent(({ context }: Readonly<{ context: ResumeSectionMachineContext }>) =>
      ({ type: 'SECTION_FINISHED', result: readSectionResult(context) })),
    reportSectionProgressed: sendParent(({ context }: Readonly<{ context: ResumeSectionMachineContext }>, status: SectionProgressStatus) =>
      ({ type: 'SECTION_PROGRESSED', key: context.writingInput.section.key, status, attempt: context.attempt })),
  },
}).createMachine({
  id: 'resume-section',
  // A section sent back by the coherence check starts with the fields it rejected.
  context: ({ input }) => ({ ...input, attempt: 0, content: null, latestContent: input.writingInput.previousContent, failure: null,
    rejectedFields: input.writingInput.rejectedFields, startedAt: input.now(), usage: noUsage }),
  initial: 'planned',
  states: {
    planned: { always: { target: 'writing' } },
    writing: {
      entry: [assign({ attempt: ({ context }) => context.attempt + 1, content: null, failure: null,
        latestContent: ({ context }) => context.content ?? context.latestContent }),
        { type: 'reportSectionProgressed', params: 'writing' }],
      invoke: {
        src: 'writeSection',
        input: ({ context }) => readRewritingInput(context),
        onDone: [
          { guard: ({ context, event }) => readWriting({ context, result: event.output }).content !== null,
            target: 'validating', actions: assign(({ context, event }) => readWriting({ context, result: event.output })) },
          { guard: ({ context, event }) => canRewrite({ context, step: readWriting({ context, result: event.output }) }),
            target: 'writing', reenter: true,
            actions: assign(({ context, event }) => readWriting({ context, result: event.output })) },
          { target: 'failed', actions: assign(({ context, event }) => readWriting({ context, result: event.output })) },
        ],
      },
    },
    validating: {
      entry: { type: 'reportSectionProgressed', params: 'validating' },
      invoke: {
        src: 'validateSectionFields',
        input: ({ context }) => {
          const content = context.content ?? { kind: 'education', fields: [] }
          const { section, locale, purpose, candidateFacts } = context.writingInput
          return { models: context.models, input: { section, locale, purpose, fields: readSectionContentFields(content),
            candidateFacts: citedCandidateFacts({ content, candidateFacts }) } }
        },
        onDone: [
          { guard: ({ context, event }) => readValidation({ context, result: event.output }).failure === null,
            target: 'validated', actions: assign(({ context, event }) => readValidation({ context, result: event.output })) },
          { guard: ({ context, event }) => canRewrite({ context, step: readValidation({ context, result: event.output }) }),
            target: 'writing', actions: assign(({ context, event }) => readValidation({ context, result: event.output })) },
          { target: 'failed', actions: assign(({ context, event }) => readValidation({ context, result: event.output })) },
        ],
      },
    },
    validated: { type: 'final', entry: 'reportSectionFinished' },
    failed: { type: 'final', entry: 'reportSectionFinished' },
  },
})

export type ResumePreparationMachineInput = Readonly<{
  request: ResumeSectionsRequest
  revision: string
  /** The saved sections snapshot of an earlier attempt at the same inputs; its validated sections are not written again. */
  resumeFrom: readonly ResumeSectionSnapshot[]
  models: ResumeSectionModels
  now: () => number
  recordTelemetry: (event: PrivacySafeTelemetryEvent) => void
}>

type ResumePreparationMachineContext = ResumePreparationMachineInput & Readonly<{
  plan: readonly ResumeSectionPlanEntry[]
  sections: readonly ResumeSectionSnapshot[]
  startedKeys: readonly string[]
  results: readonly ResumeSectionResult[]
  coherence: ResumeSectionModelResult<ResumeDocumentCoherence> | null
  /** Rejected fields per section key from the coherence check; only the first rejection triggers a rewrite. */
  coherenceRejections: Readonly<Record<string, readonly ResumeRejectedField[]>> | null
  /** Text per section key and field id that the first coherence check accepted in a section it did not send back. */
  coherenceAcceptedFields: Readonly<Record<string, Readonly<Record<string, string>>>> | null
  /** The validated content per section key that the coherence check sent back to writing. */
  coherencePreviousContents: Readonly<Record<string, ResumeSectionContent>>
  startedAt: number
}>

export type ResumePreparationMachineOutput = Extract<ResumePreparationOutcome, { status: 'prepared' }> | ResumeOperationFailure

const checkDocumentCoherence = fromPromise<ResumeSectionModelResult<ResumeDocumentCoherence>, Readonly<{
  models: ResumeSectionModels; context: ResumePreparationMachineContext
}>>(({ input }) => callModel(() => input.models.checkCoherence({ document: assembleDocument(input.context).document })))

function assembleDocument(context: ResumePreparationMachineContext) {
  return assembleResumeDocumentWithOrigins({ request: context.request, contents: context.plan.flatMap(({ key }) => {
    const result = context.results.find(({ section }) => section.key === key)
    return result?.status === 'validated' ? [result.content] : []
  }) })
}

/**
 * Groups the fields a failed coherence check named by the section they came from. Unknown ids are ignored, and so
 * are dates and locations: they are copied from the Candidate's source, so no rewrite may change them, and
 * concurrent experiences at one employer are a valid chronology. An issue its own verdict contradicts is ignored too,
 * and so is a rewrite of a field the first check accepted in a section it did not send back, while it is unchanged.
 * A removal costs no rewrite, so a redundancy is removed even there, except from an experience, where an achievement
 * belongs, or from the Value Proposition, which restates the strongest of them on purpose.
 */
function readCoherenceRejections({ context, coherence }: Readonly<{
  context: ResumePreparationMachineContext; coherence: ResumeSectionModelResult<ResumeDocumentCoherence>
}>): Readonly<Record<string, readonly ResumeRejectedField[]>> {
  if (!coherence.ok || coherencePassed(coherence)) return {}
  const { origins } = assembleDocument(context)
  const rejections: Record<string, ResumeRejectedField[]> = {}
  for (const issue of coherence.value.issues) {
    if (contradictsVerdict({ issue, verdict: coherence.value })) continue
    const origin = origins.get(issue.fieldId)
    if (origin === undefined || origin.copiedFromSource) continue
    if (issue.kind === 'redundant' && restatesOnPurpose({ context, sectionKey: origin.sectionKey })) continue
    if (!isRemovable(issue.kind)
      && context.coherenceAcceptedFields?.[origin.sectionKey]?.[origin.field.id] === origin.field.text) continue
    const fields = rejections[origin.sectionKey] ?? []
    if (!fields.some(({ fieldId }) => fieldId === origin.field.id)) {
      fields.push({ fieldId: origin.field.id, text: origin.field.text, reason: issue.kind })
    }
    rejections[origin.sectionKey] = fields
  }
  return rejections
}

/**
 * A language issue in a verdict whose language matches, or a coherence issue in a verdict that is coherent, gives
 * nothing to rewrite: the model has named a field its own verdict accepts.
 */
function contradictsVerdict({ issue, verdict }: Readonly<{ issue: ResumeCoherenceIssue; verdict: ResumeDocumentCoherence }>) {
  return issue.kind === 'language' ? verdict.languageMatches : verdict.coherent
}

function restatesOnPurpose({ context, sectionKey }: Readonly<{ context: ResumePreparationMachineContext; sectionKey: string }>) {
  return context.plan.some(({ key, kind }) => key === sectionKey && (kind === 'experience' || kind === 'value-proposition'))
}

function hasCoherenceRejections(rejections: Readonly<Record<string, readonly ResumeRejectedField[]>>) {
  return Object.keys(rejections).length > 0
}

type CoherenceResolution = Readonly<{
  /** Validated results with every redundant or duplicated list item removed: the check names only the copy placed worse. */
  results: readonly ResumeSectionResult[]
  /** Rejected fields per section key that only a rewrite can resolve. */
  rewrites: Readonly<Record<string, readonly ResumeRejectedField[]>>
}>

/** A redundant paraphrase or a duplicated skill is a copy: removing it can neither invent content nor lose any. */
function isRemovable(reason: ResumeRejectedField['reason']) {
  return reason === 'redundant' || reason === 'duplicated-skill'
}

/**
 * A redundant field is removed; a duplicated skill only while another copy with the same text stays, so a check
 * that names every copy, or a paraphrase, sends the section to rewriting rather than losing the skill.
 */
function selectRemovals({ content, rejected }: Readonly<{
  content: ResumeSectionContent; rejected: readonly ResumeRejectedField[]
}>): readonly ResumeRejectedField[] {
  const removed = new Set(rejected.filter(({ reason }) => isRemovable(reason)).map(({ fieldId }) => fieldId))
  const normalize = (text: string) => text.trim().replace(/\s+/gu, ' ').toLocaleLowerCase()
  const copyStays = ({ text }: ResumeRejectedField) => readSectionContentFields(content)
    .some((field) => !removed.has(field.id) && normalize(field.text) === normalize(text))
  return rejected.filter((field) => field.reason === 'redundant' || (field.reason === 'duplicated-skill' && copyStays(field)))
}

/** Removes what is merely redundant and keeps for rewriting what a removal cannot fix. */
function resolveCoherence({ context, coherence }: Readonly<{
  context: ResumePreparationMachineContext; coherence: ResumeSectionModelResult<ResumeDocumentCoherence>
}>): CoherenceResolution {
  const rejections = readCoherenceRejections({ context, coherence })
  const rewrites: Record<string, readonly ResumeRejectedField[]> = {}
  const results = context.results.map((result): ResumeSectionResult => {
    const rejected = rejections[result.section.key]
    if (rejected === undefined || result.status !== 'validated') return result
    const removals = selectRemovals({ content: result.content, rejected })
    const content = removeSectionFields({ content: result.content, fieldIds: removals.map(({ fieldId }) => fieldId) })
    const remaining = content === null ? rejected : rejected.filter((field) => !removals.includes(field))
    if (remaining.length > 0) rewrites[result.section.key] = remaining
    return content === null ? result : { ...result, content }
  })
  return { results, rewrites }
}

/**
 * A verdict is accepted once the language matches and nothing is left that needs a rewrite: redundant fields are
 * removed, and an issue naming no field of a Resume Section (the target role, the purpose) gives nothing to change.
 */
function coherenceAccepted({ context, coherence }: Readonly<{
  context: ResumePreparationMachineContext; coherence: ResumePreparationMachineContext['coherence']
}>) {
  return coherence?.ok === true && coherence.value.languageMatches
    && !hasCoherenceRejections(resolveCoherence({ context, coherence }).rewrites)
}

/** Sends the rejected sections back to writing: their results and snapshots return to planned, the others stay. */
function readCoherenceRewrite({ context, coherence }: Readonly<{
  context: ResumePreparationMachineContext; coherence: ResumeSectionModelResult<ResumeDocumentCoherence>
}>): Partial<ResumePreparationMachineContext> {
  const { results, rewrites: coherenceRejections } = resolveCoherence({ context, coherence })
  const rejected = (key: string) => key in coherenceRejections
  return { coherence: null, coherenceRejections,
    coherenceAcceptedFields: readAcceptedFields({ context, rewrittenKeys: Object.keys(coherenceRejections),
      namedFieldIds: coherence.ok ? coherence.value.issues.map(({ fieldId }) => fieldId) : [] }),
    coherencePreviousContents: Object.fromEntries(results.flatMap((result) =>
      rejected(result.section.key) && result.status === 'validated' ? [[result.section.key, result.content]] : [])),
    results: results.filter(({ section }) => !rejected(section.key)),
    startedKeys: context.startedKeys.filter((key) => !rejected(key)),
    sections: context.sections.map((section): ResumeSectionSnapshot => rejected(section.key)
      ? { key: section.key, kind: section.kind, status: 'planned', attempt: 0 } : section) }
}

/**
 * The fields the verdict did not name, by section key and the section's own field id, outside the rewritten
 * sections: a rewrite can make an unchanged field of its own section incoherent, such as a kept category label.
 */
function readAcceptedFields({ context, namedFieldIds, rewrittenKeys }: Readonly<{
  context: ResumePreparationMachineContext; namedFieldIds: readonly string[]; rewrittenKeys: readonly string[]
}>): Readonly<Record<string, Readonly<Record<string, string>>>> {
  const named = new Set(namedFieldIds)
  const accepted: Record<string, Record<string, string>> = {}
  for (const [id, { sectionKey, field }] of assembleDocument(context).origins) {
    if (named.has(id) || rewrittenKeys.includes(sectionKey)) continue
    accepted[sectionKey] = { ...accepted[sectionKey], [field.id]: field.text }
  }
  return accepted
}

/** A section still rejected after its rewrite is saved as failed, so a retry writes it again and keeps the others. */
function readCoherenceFailure({ context, coherence }: Readonly<{
  context: ResumePreparationMachineContext; coherence: ResumeSectionModelResult<ResumeDocumentCoherence>
}>): Partial<ResumePreparationMachineContext> {
  const { results, rewrites } = resolveCoherence({ context, coherence })
  return { coherence, results, sections: context.sections.map((section): ResumeSectionSnapshot => section.key in rewrites
    ? { key: section.key, kind: section.kind, status: 'failed', attempt: section.attempt } : section) }
}

function everySectionFinished(context: ResumePreparationMachineContext) {
  return context.plan.length > 0 && context.results.length === context.plan.length
}

function everySectionValidated(context: ResumePreparationMachineContext) {
  return everySectionFinished(context) && context.results.every(({ status }) => status === 'validated')
}

function coherencePassed(coherence: ResumePreparationMachineContext['coherence']) {
  return coherence?.ok === true && coherence.value.coherent && coherence.value.languageMatches
}

function readPreparationOutput(context: ResumePreparationMachineContext): ResumePreparationMachineOutput {
  if (everySectionValidated(context) && coherenceAccepted({ context, coherence: context.coherence })) {
    return { status: 'prepared', revision: context.revision, document: assembleDocument(context).document }
  }
  return readPreparationFailure(readPreparationFailures(context))
}

function readPreparationFailures(context: ResumePreparationMachineContext): readonly PreparationStepFailure[] {
  const { coherence } = context
  if (coherence === null) return context.results.flatMap((result) => result.status === 'failed' ? [result.failure] : [])
  if (!coherence.ok) return [coherence.error]
  // A language mismatch naming no field gives nothing to rewrite; checking again may name one.
  return [hasCoherenceRejections(resolveCoherence({ context, coherence }).rewrites) ? { type: 'incoherent' }
    : { type: 'invalid-provider-response' }]
}

type PreparationStepFailure = ResumeSectionFailure | Readonly<{ type: 'incoherent' }>

/**
 * Several sections can fail differently in one preparation (for example one timed out, another is unsupported),
 * but the Candidate sees a single failure with a single recovery action.
 */
function readPreparationFailure(failures: readonly PreparationStepFailure[]): ResumeOperationFailure {
  // Without consent no call can succeed, and a failure a retry cannot fix needs its own Recovery first. A retry
  // rewrites only the sections that failed, including those the coherence check still rejected, so unsupported or
  // incoherent wording is worth retrying.
  const has = (type: PreparationStepFailure['type']) => failures.some((failure) => failure.type === type)
  if (has('consent-required')) return { status: 'failed', reason: 'processing-consent-required', recovery: 'renew-consent' }
  const explained = failures.flatMap((failure) => isModelCallFailure(failure) ? [explainFailure(failure)] : [])
  const unretryable = explained.find(({ cause }) => !isRetryable(cause))
  if (unretryable !== undefined) return unavailableFailure(unretryable)
  if (has('incoherent')) return { status: 'failed', reason: 'incoherent-content', recovery: 'retry' }
  if (has('unsupported')) return { status: 'failed', reason: 'unsupported-content', recovery: 'retry' }
  return unavailableFailure(explained[0] ?? explainFailure(undefined))
}

function isModelCallFailure(failure: PreparationStepFailure): failure is ResumeSectionFailure & ReadApiFailure {
  return failure.type !== 'incoherent' && failure.type !== 'unsupported' && failure.type !== 'consent-required'
}

function unavailableFailure({ cause, recovery }: ExplainedFailure): ResumeOperationFailure {
  return { status: 'failed', reason: 'unavailable', cause, recovery }
}

type ResumePreparationEvent =
  | Readonly<{ type: 'SECTION_PROGRESSED'; key: string; status: SectionProgressStatus; attempt: number }>
  | Readonly<{ type: 'SECTION_FINISHED'; result: ResumeSectionResult }>

function readPlannedSections({ plan, restored }: Readonly<{
  plan: readonly ResumeSectionPlanEntry[]; restored: readonly ResumeSectionResult[]
}>): readonly ResumeSectionSnapshot[] {
  return plan.map(({ key, kind }) => {
    const result = restored.find(({ section }) => section.key === key)
    return result === undefined ? { key, kind, status: 'planned', attempt: 0 } : readSectionSnapshot(result)
  })
}

/**
 * A validated section is kept when its key is still planned and it still passes the deterministic structure checks,
 * which include citing only attested Candidate Facts. It is not validated by a model again.
 */
function restoreValidatedSections({ context, plan }: Readonly<{
  context: ResumePreparationMachineContext; plan: readonly ResumeSectionPlanEntry[]
}>): readonly ResumeSectionResult[] {
  return plan.flatMap((section) => {
    const saved = context.resumeFrom.find(({ key, kind }) => key === section.key && kind === section.kind)
    const restored = saved === undefined ? null : readRestoredSection({ section, saved })
    return restored !== null && hasSupportedSectionStructure({ content: restored.content,
      input: createSectionWritingInput({ request: context.request, section }) }) ? [restored] : []
  })
}

function readRestoredSection({ section, saved }: Readonly<{
  section: ResumeSectionPlanEntry; saved: ResumeSectionSnapshot
}>): Extract<ResumeSectionResult, { status: 'validated' }> | null {
  return saved.status === 'validated' ? { section, status: 'validated', content: saved.content, attempt: saved.attempt,
    durationMilliseconds: 0, usage: noUsage } : null
}

function readSectionSnapshot(result: ResumeSectionResult): ResumeSectionSnapshot {
  const { key, kind } = result.section
  return result.status === 'validated' ? { key, kind, attempt: result.attempt, status: 'validated', content: result.content }
    : { key, kind, attempt: result.attempt, status: 'failed' }
}

function readProgressedSections({ context, event }: Readonly<{
  context: ResumePreparationMachineContext; event: ResumePreparationEvent
}>): readonly ResumeSectionSnapshot[] {
  const key = event.type === 'SECTION_PROGRESSED' ? event.key : event.result.section.key
  return context.sections.map((section): ResumeSectionSnapshot => {
    if (section.key !== key) return section
    if (event.type === 'SECTION_PROGRESSED') return { key, kind: section.kind, status: event.status, attempt: event.attempt }
    return readSectionSnapshot(event.result)
  })
}

function recordSectionResult({ context, result }: Readonly<{ context: ResumePreparationMachineContext; result: ResumeSectionResult }>) {
  context.recordTelemetry({ name: 'resume-section-prepared', sectionKind: result.section.kind,
    outcome: result.status === 'validated' ? 'validated' : result.failure.type, attemptCount: result.attempt,
    durationMilliseconds: result.durationMilliseconds, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens })
}

function recordPreparationCompleted({ context, outcome }: Readonly<{
  context: ResumePreparationMachineContext; outcome: 'prepared' | 'failed'
}>) {
  context.recordTelemetry({ name: 'resume-preparation-completed', outcome, sectionCount: context.plan.length,
    durationMilliseconds: Math.max(0, context.now() - context.startedAt) })
}

/**
 * Writes the deterministic section plan with at most four section actors at a time, then checks the assembled
 * document once for coherence and language. `prepared` is reachable only when both have passed.
 */
export const resumePreparationMachine = setup({
  types: {} as {
    context: ResumePreparationMachineContext
    input: ResumePreparationMachineInput
    output: ResumePreparationMachineOutput
    events: ResumePreparationEvent
  },
  actors: { resumeSectionMachine, checkDocumentCoherence },
  actions: {
    // Model qualification runs the machine without a Candidate Journey parent; only the Journey saves the snapshot.
    reportSectionsProgressed: enqueueActions(({ context, self, enqueue }) => {
      if (self._parent === undefined) return
      enqueue.sendParent({ type: 'RESUME_SECTIONS_PROGRESSED', sections: context.sections })
    }),
    spawnQueuedSections: enqueueActions(({ context, enqueue }) => {
      const running = context.startedKeys.length - context.results.length
      const queued = context.plan.filter(({ key }) => !context.startedKeys.includes(key))
        .slice(0, Math.max(0, maximumConcurrentSections - running))
      for (const section of queued) {
        enqueue.spawnChild('resumeSectionMachine', { id: `resume-section:${section.key}`, input: {
          models: context.models, now: context.now,
          writingInput: { ...createSectionWritingInput({ request: context.request, section }),
            rejectedFields: context.coherenceRejections?.[section.key] ?? [],
            previousContent: context.coherencePreviousContents[section.key] ?? null } } })
      }
      if (queued.length > 0) enqueue.assign({ startedKeys: [...context.startedKeys, ...queued.map(({ key }) => key)] })
    }),
  },
}).createMachine({
  id: 'resume-preparation',
  context: ({ input }) => ({ ...input, plan: [], sections: [], startedKeys: [], results: [], coherence: null,
    coherenceRejections: null, coherenceAcceptedFields: null, coherencePreviousContents: {}, startedAt: input.now() }),
  initial: 'planning',
  states: {
    planning: {
      entry: [assign(({ context }) => {
        const plan = planResumeSections(context.request)
        const restored = restoreValidatedSections({ context, plan })
        return { plan, results: restored, startedKeys: restored.map(({ section }) => section.key),
          sections: readPlannedSections({ plan, restored }) }
      }), 'reportSectionsProgressed'],
      always: { target: 'writingSections' },
    },
    writingSections: {
      entry: 'spawnQueuedSections',
      on: {
        SECTION_PROGRESSED: { actions: [assign({ sections: readProgressedSections }), 'reportSectionsProgressed'] },
        SECTION_FINISHED: { actions: [
          assign({ results: ({ context, event }) => [...context.results, event.result], sections: readProgressedSections }),
          ({ context, event }) => { recordSectionResult({ context, result: event.result }) },
          'reportSectionsProgressed',
          'spawnQueuedSections',
        ] },
      },
      always: [
        { guard: ({ context }) => everySectionValidated(context), target: 'checkingCoherence' },
        { guard: ({ context }) => everySectionFinished(context), target: 'failed' },
      ],
    },
    checkingCoherence: {
      invoke: {
        src: 'checkDocumentCoherence',
        input: ({ context }) => ({ models: context.models, context }),
        onDone: [
          { guard: ({ context, event }) => everySectionValidated(context) && coherenceAccepted({ context, coherence: event.output }),
            target: 'prepared', actions: assign(({ context, event }) => ({ coherence: event.output,
              results: resolveCoherence({ context, coherence: event.output }).results })) },
          { guard: ({ context, event }) => context.coherenceRejections === null
            && hasCoherenceRejections(resolveCoherence({ context, coherence: event.output }).rewrites),
          target: 'writingSections', actions: [assign(({ context, event }) => readCoherenceRewrite({ context, coherence: event.output })),
            'reportSectionsProgressed'] },
          { target: 'failed', actions: [assign(({ context, event }) => readCoherenceFailure({ context, coherence: event.output })),
            'reportSectionsProgressed'] },
        ],
      },
    },
    prepared: { type: 'final', entry: ({ context }) => { recordPreparationCompleted({ context, outcome: 'prepared' }) } },
    failed: { type: 'final', entry: ({ context }) => { recordPreparationCompleted({ context, outcome: 'failed' }) } },
  },
  output: ({ context }) => readPreparationOutput(context),
})
