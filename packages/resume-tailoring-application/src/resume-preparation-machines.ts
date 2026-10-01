import { assign, enqueueActions, fromPromise, sendParent, setup } from 'xstate'
import type { ResumeSectionSnapshot } from '@resume-tailoring/domain/candidate-session'
import type { PrivacySafeTelemetryEvent, resumeSectionOutcomes } from './resume-tailoring-workflow-ports'
import type { ResumeOperationFailure, ResumePreparationOutcome } from './structured-resume-contract'
import { assembleResumeDocument, citedCandidateFacts, createSectionWritingInput, hasSupportedSectionStructure,
  isSectionFullyValidated, normalizeSectionContent, planResumeSections, readSectionContentFields } from './resume-sections'
import type { ResumeDocumentCoherence, ResumeFieldValidation, ResumeFieldValidationInput, ResumeModelUsage,
  ResumeSectionContent, ResumeSectionModelResult, ResumeSectionModels, ResumeSectionPlanEntry, ResumeSectionsRequest,
  ResumeSectionWritingInput } from './resume-sections'

type ResumeSectionFailure = Exclude<typeof resumeSectionOutcomes[number], 'validated'>

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
  failure: ResumeSectionFailure | null
  startedAt: number
  usage: ResumeModelUsage
}>

const noUsage: ResumeModelUsage = { inputTokens: 0, outputTokens: 0 }
const rewritableFailures: ReadonlySet<ResumeSectionFailure> = new Set(['transient', 'permanent', 'unsupported'])
const maximumSectionAttempts = 2
const maximumConcurrentSections = 4

async function callModel<TValue>(call: () => Promise<ResumeSectionModelResult<TValue>>): Promise<ResumeSectionModelResult<TValue>> {
  try { return await call() } catch { return { ok: false, error: { type: 'permanent' } } }
}

const writeSection = fromPromise<ResumeSectionModelResult<ResumeSectionContent>, ResumeSectionMachineInput>(
  ({ input }) => callModel(() => input.models.writeSection(input.writingInput)))

const validateSectionFields = fromPromise<ResumeSectionModelResult<ResumeFieldValidation>, Readonly<{
  models: ResumeSectionModels; input: ResumeFieldValidationInput
}>>(({ input }) => callModel(() => input.models.validateFields(input.input)))

type SectionStep = Pick<ResumeSectionMachineContext, 'content' | 'failure' | 'usage'>

function readWriting({ context, result }: Readonly<{
  context: ResumeSectionMachineContext; result: ResumeSectionModelResult<ResumeSectionContent>
}>): SectionStep {
  const usage = addUsage(context.usage, result.usage)
  if (!result.ok) return { content: null, failure: result.error.type, usage }
  const { section, purpose } = context.writingInput
  const content = normalizeSectionContent({ content: result.value, purpose, section })
  return hasSupportedSectionStructure({ content, input: context.writingInput })
    ? { content, failure: null, usage } : { content: null, failure: 'unsupported', usage }
}

function readValidation({ context, result }: Readonly<{
  context: ResumeSectionMachineContext; result: ResumeSectionModelResult<ResumeFieldValidation>
}>): SectionStep {
  const usage = addUsage(context.usage, result.usage)
  if (!result.ok) return { content: context.content, failure: result.error.type, usage }
  return context.content !== null && isSectionFullyValidated({ content: context.content, validation: result.value })
    ? { content: context.content, failure: null, usage } : { content: context.content, failure: 'unsupported', usage }
}

function canRewrite({ context, step }: Readonly<{ context: ResumeSectionMachineContext; step: SectionStep }>) {
  return context.attempt < maximumSectionAttempts && step.failure !== null && rewritableFailures.has(step.failure)
}

function addUsage(total: ResumeModelUsage, usage: ResumeModelUsage | undefined): ResumeModelUsage {
  return usage === undefined ? total
    : { inputTokens: total.inputTokens + usage.inputTokens, outputTokens: total.outputTokens + usage.outputTokens }
}

function readSectionResult(context: ResumeSectionMachineContext): ResumeSectionResult {
  const measured = { section: context.writingInput.section, attempt: context.attempt, usage: context.usage,
    durationMilliseconds: Math.max(0, context.now() - context.startedAt) }
  return context.failure === null && context.content !== null
    ? { ...measured, status: 'validated', content: context.content }
    : { ...measured, status: 'failed', failure: context.failure ?? 'permanent' }
}

/** Writes and validates one Resume Section; a rewritable failure rewrites once, a timeout never. */
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
  context: ({ input }) => ({ ...input, attempt: 0, content: null, failure: null, startedAt: input.now(), usage: noUsage }),
  initial: 'planned',
  states: {
    planned: { always: { target: 'writing' } },
    writing: {
      entry: [assign({ attempt: ({ context }) => context.attempt + 1, content: null, failure: null }),
        { type: 'reportSectionProgressed', params: 'writing' }],
      invoke: {
        src: 'writeSection',
        input: ({ context }) => context,
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
  startedAt: number
}>

export type ResumePreparationMachineOutput = Extract<ResumePreparationOutcome, { status: 'prepared' }> | ResumeOperationFailure

const checkDocumentCoherence = fromPromise<ResumeSectionModelResult<ResumeDocumentCoherence>, Readonly<{
  models: ResumeSectionModels; context: ResumePreparationMachineContext
}>>(({ input }) => callModel(() => input.models.checkCoherence({ document: assembleDocument(input.context) })))

function assembleDocument(context: ResumePreparationMachineContext) {
  return assembleResumeDocument({ request: context.request, contents: context.plan.flatMap(({ key }) => {
    const result = context.results.find(({ section }) => section.key === key)
    return result?.status === 'validated' ? [result.content] : []
  }) })
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
  if (everySectionValidated(context) && coherencePassed(context.coherence)) {
    return { status: 'prepared', revision: context.revision, document: assembleDocument(context) }
  }
  const failures = context.coherence === null
    ? context.results.flatMap((result) => result.status === 'failed' ? [result.failure] : [])
    : [context.coherence.ok ? 'unsupported' as const : context.coherence.error.type]
  return readPreparationFailure({ failures, incoherent: context.coherence?.ok === true })
}

/**
 * Several sections can fail differently in one preparation (for example one timed out, another is unsupported),
 * but the Candidate sees a single failure with a single recovery action.
 */
function readPreparationFailure({ failures, incoherent }: Readonly<{
  failures: readonly ResumeSectionFailure[]; incoherent: boolean
}>): ResumeOperationFailure {
  // Without consent no call can succeed, and an incoherent document survives a retry. A retry rewrites only the
  // sections that failed, so a section whose wording is still unsupported after its rewrite is worth retrying.
  if (failures.includes('consent-required')) return { status: 'failed', reason: 'processing-consent-required', recovery: 'renew-consent' }
  if (incoherent) return { status: 'failed', reason: 'unsupported-content', recovery: 'correct-content' }
  if (failures.includes('unsupported')) return { status: 'failed', reason: 'unsupported-content', recovery: 'retry' }
  return { status: 'failed', reason: 'unavailable', recovery: 'retry' }
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
 * which include citing only attested Candidate Facts. It is not validated by a model again (ADR-0016).
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
    outcome: result.status === 'validated' ? 'validated' : result.failure, attemptCount: result.attempt,
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
 * document once for coherence and language. `prepared` is reachable only when both have passed (ADR-0016).
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
          writingInput: createSectionWritingInput({ request: context.request, section }) } })
      }
      if (queued.length > 0) enqueue.assign({ startedKeys: [...context.startedKeys, ...queued.map(({ key }) => key)] })
    }),
  },
}).createMachine({
  id: 'resume-preparation',
  context: ({ input }) => ({ ...input, plan: [], sections: [], startedKeys: [], results: [], coherence: null, startedAt: input.now() }),
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
          { guard: ({ context, event }) => everySectionValidated(context) && coherencePassed(event.output),
            target: 'prepared', actions: assign({ coherence: ({ event }) => event.output }) },
          { target: 'failed', actions: assign({ coherence: ({ event }) => event.output }) },
        ],
      },
    },
    prepared: { type: 'final', entry: ({ context }) => { recordPreparationCompleted({ context, outcome: 'prepared' }) } },
    failed: { type: 'final', entry: ({ context }) => { recordPreparationCompleted({ context, outcome: 'failed' }) } },
  },
  output: ({ context }) => readPreparationOutput(context),
})
