import type { CandidateSession } from '@resume-tailoring/domain/candidate-session'
import type { ResumeEditingState, TailoredResume, TailoredResumeExperience, TailoredResumeField } from './tailored-resume'
import { readExperienceMonths } from './experience-chronology'
import { readResumeFields, removeResumeField } from './resume-field-editing'
import type { ResumeFieldReference } from './resume-field-editing'
import { assessResumeExport, unavailableResumeRender } from './resume-export'
import type { ResumeRenderRequest, ResumeRenderResult } from './resume-export'
import type { ResumeDraft } from './structured-resume-contract'
import { changedResumeSession, readResumeEditing } from './resume-editing'
import type { ResumeEditingAccess } from './resume-editing'
import { proposeResumeCondensation } from './resume-condensation'
import { validateResumeRendering } from './resume-rendering-state'
import type { ReadApiFailure } from './api-failure'
import type { ResumeDocumentRenderer } from './ports'
import type { FittedResumeRendering } from './resume-rendering-state'

/** A Tailored Resume with the editing state that holds its Hidden Content. */
type ReducibleResume = Readonly<{ resume: TailoredResume; editing: ResumeEditingState }>

/** Content Overflow Reduction hid, tagged with its origin so the Candidate can restore it. */
type ReductionHiddenField = ResumeEditingState['hiddenFields'][number]

/**
 * What fitting a Tailored Resume to its Page Budget reads besides the resume: the content the Candidate restored, the
 * facts the Match Analysis found relevant, and today for ongoing roles. Content travels as in a render, and only for it.
 */
export type PageBudgetFitRequest = Readonly<{
  draft: ResumeDraft
  restoredFieldIds: readonly string[]
  relevantFactIds: readonly string[]
  today: number
  photoDataUrl?: string
  /** The Candidate asked to shorten: when only restored content is left to hide, reduction may hide it again. */
  releasesRestoredContent: boolean
}>

/**
 * The resume fitted to its Page Budget, the fields Overflow Reduction hid to get there, and its render at the request's
 * revision: the page assessment with the final PDF. `renderCount` is the number of layouts the fitting measured.
 */
export type PageBudgetFit = Readonly<{
  document: TailoredResume
  hiddenFields: readonly ReductionHiddenField[]
  render: ResumeRenderResult
  renderCount: number
}>

/** One real layout of a resume: its page count, with whatever else the measuring renderer keeps of it. */
export type PageMeasurement = Readonly<{ pageCount: number }>

/** Lays a draft out as the export would; null when it cannot be rendered. */
type MeasureLayout<TMeasurement extends PageMeasurement> = (draft: ResumeDraft) => Promise<TMeasurement | null>

type MeasuredReduction<TMeasurement extends PageMeasurement> = Readonly<{
  reduction: ReducibleResume; measurement: TMeasurement | null
}>

/** What a step may read besides the resume: which facts the Match Analysis found relevant, and today for ongoing roles. */
type ReductionContext = Readonly<{ relevantFactIds: ReadonlySet<string>; today: number }>

/** One step names the fields it hides; an empty list means it has nothing left to hide. */
type ReductionStep = Readonly<{
  repeats: boolean
  select: (request: Readonly<{ reduction: ReducibleResume; context: ReductionContext }>) => readonly ResumeFieldReference[]
}>

const relevantExperienceAchievementFloor = 2

/**
 * The one-click way back within the Page Budget: Overflow Reduction of the current draft in one renderer operation,
 * saved as the Candidate's own removal with the page assessment it measured. When no reduction reaches two pages, it
 * proposes shorter wording instead.
 */
export async function shortenResume({ access, today, photoDataUrl }: Readonly<{
  access: ResumeEditingAccess; today: number; photoDataUrl?: string
}>) {
  const review = access.readReview()
  const session = access.readSession()
  if (review === null || session?.tailoredResume == null || review.operation !== null) return
  const baseRevision = review.draft.revision
  access.report({ baseRevision, review: { ...review, proposal: null, failure: null, operation: 'shortening' } })
  const fitted = await fitSessionResume({ fitToPageBudget: access.fitToPageBudget, session,
    document: session.tailoredResume, today, photoDataUrl, releasesRestoredContent: true })
  const current = access.readReview()
  if (current?.draft.revision !== baseRevision) return
  access.report({ baseRevision, review: { ...current, operation: null } })
  const { layout } = fitted.rendering.result.assessment
  if (layout.status !== 'fits') { await proposeResumeCondensation({ access, photoDataUrl }); return }
  const revision = access.createIdentifier()
  access.save({ baseRevision, correctionKind: 'resume-claim-removal', fittedRendering: fitted.rendering,
    session: changedResumeSession({ session, revision, ...fitted.reduction ?? { document: session.tailoredResume } }) })
  const saved = access.readReview()
  if (saved?.draft.revision !== revision) return
  access.report({ baseRevision: revision, review: { ...saved, assessment: assessResumeExport({ draft: saved.draft,
    unsupportedFieldIds: saved.unsupportedFieldIds, layout: { ...layout, revision } }) } })
}

/**
 * Fits the session's Tailored Resume to its Page Budget with the renderer's one operation. The reduction is null when
 * nothing was hidden; the rendering is the fitted document's render, unavailable when it could not be measured.
 */
export async function fitSessionResume({ fitToPageBudget, session, document, today, photoDataUrl,
  releasesRestoredContent }: Readonly<{
  fitToPageBudget: ResumeDocumentRenderer['fitToPageBudget'] | undefined
  session: CandidateSession
  /** The session's Tailored Resume, passed apart so the caller's check that it exists carries over. */
  document: TailoredResume
  today: number
  photoDataUrl?: string
  releasesRestoredContent: boolean
}>): Promise<Readonly<{
  reduction: Readonly<{ document: TailoredResume; editing: ResumeEditingState }> | null
  rendering: FittedResumeRendering
  renderCount: number
}>> {
  const editing = readResumeEditing({ session })
  const request = { draft: { document, revision: editing.revision },
    restoredFieldIds: editing.restoredFieldIds ?? [], relevantFactIds: session.jobMatch?.analysis.relevantFactIds ?? [],
    today, releasesRestoredContent, ...(photoDataUrl === undefined ? {} : { photoDataUrl }) }
  const fit = await requestPageBudgetFit({ fitToPageBudget, request })
  const renderRequest = { draft: { document: fit.document, revision: editing.revision }, unsupportedFieldIds: [], photoDataUrl }
  const rendering = { document: fit.document, photoDataUrl,
    result: validateResumeRendering({ request: renderRequest, result: fit.render }) }
  if (fit.hiddenFields.length === 0) return { reduction: null, rendering, renderCount: fit.renderCount }
  const hiddenIds = new Set(fit.hiddenFields.map(({ field }) => field.id))
  return { rendering, renderCount: fit.renderCount, reduction: { document: fit.document, editing: { ...editing,
    hiddenFields: [...editing.hiddenFields, ...fit.hiddenFields],
    ...(editing.restoredFieldIds === undefined ? {} : {
      restoredFieldIds: editing.restoredFieldIds.filter((id) => !hiddenIds.has(id)) }) } } }
}

async function requestPageBudgetFit({ fitToPageBudget, request }: Readonly<{
  fitToPageBudget: ResumeDocumentRenderer['fitToPageBudget'] | undefined; request: PageBudgetFitRequest
}>): Promise<PageBudgetFit> {
  try {
    return await fitToPageBudget?.(request) ?? unfittedPageBudget({ request })
  } catch {
    return unfittedPageBudget({ request })
  }
}

/**
 * A fitting that could not run: the resume unchanged, nothing hidden, and its render unavailable for this API Failure,
 * so the preview renders it as any other.
 */
export function unfittedPageBudget({ request, apiFailure }: Readonly<{
  request: PageBudgetFitRequest; apiFailure?: ReadApiFailure
}>): PageBudgetFit {
  return { document: request.draft.document, hiddenFields: [], renderCount: 0, render: unavailableResumeRender({
    draft: request.draft, unsupportedFieldIds: [], photoDataUrl: request.photoDataUrl }, apiFailure) }
}

/**
 * Overflow Reduction: hides content one step at a time, measuring the real layout after each, and keeps the first
 * result that fits on one page. Without one, it keeps the two-page result with the least Hidden Content; beyond two
 * pages after every step, or when the resume cannot be rendered, it leaves the resume unchanged for the existing
 * overflow outcome. It never calls a language model, never removes an experience, and never hides content the Candidate
 * restored, unless the request releases it because nothing else brings the resume back within two pages.
 *
 * Every renderer runs these same steps; only how it measures a layout differs. The measurement of the kept result comes
 * back with it, so the renderer never lays the fitted resume out again.
 */
export async function fitToPageBudget<TMeasurement extends PageMeasurement>({ request, measure }: Readonly<{
  request: PageBudgetFitRequest; measure: MeasureLayout<TMeasurement>
}>): Promise<Readonly<{
  document: TailoredResume; hiddenFields: readonly ReductionHiddenField[]; measurement: TMeasurement | null
  measurementCount: number
}>> {
  let measurementCount = 0
  const counted: MeasureLayout<TMeasurement> = (draft) => { measurementCount += 1; return measure(draft) }
  const reduction = { resume: request.draft.document, editing: { revision: request.draft.revision, unsupportedFieldIds: [],
    manuallyEdited: false, hiddenFields: [], restoredFieldIds: request.restoredFieldIds } }
  const context = { relevantFactIds: new Set(request.relevantFactIds), today: request.today }
  const kept = await reduce({ reduction, context, measure: counted })
  const released = request.releasesRestoredContent && !withinPageBudget(kept.measurement)
    && request.restoredFieldIds.length > 0
    ? await reduce({ reduction: { ...reduction, editing: { ...reduction.editing, restoredFieldIds: [] } }, context, measure: counted })
    : null
  const fitted = released !== null && withinPageBudget(released.measurement) ? released : kept
  return { document: fitted.reduction.resume, hiddenFields: fitted.reduction.editing.hiddenFields,
    measurement: fitted.measurement, measurementCount }
}

/**
 * Fits by complete renders, for a renderer that can only render: each measurement is a render, and the kept one is
 * the fitted render.
 */
export async function fitToPageBudgetByRendering({ request, render }: Readonly<{
  request: PageBudgetFitRequest; render: (request: ResumeRenderRequest) => Promise<ResumeRenderResult>
}>): Promise<PageBudgetFit> {
  const options = { unsupportedFieldIds: [], ...(request.photoDataUrl === undefined ? {} : { photoDataUrl: request.photoDataUrl }) }
  const fitted = await fitToPageBudget({ request, measure: async (draft) => {
    try {
      const result = await render({ draft, ...options })
      const { layout } = result.assessment
      return layout.status === 'unavailable' ? null : { pageCount: layout.pageCount, result }
    } catch {
      return null
    }
  } })
  return { document: fitted.document, hiddenFields: fitted.hiddenFields, renderCount: fitted.measurementCount,
    render: fitted.measurement?.result ?? unavailableResumeRender({ draft: request.draft, ...options }) }
}

function withinPageBudget(measurement: PageMeasurement | null) {
  return measurement?.pageCount === 1 || measurement?.pageCount === 2
}

/**
 * The reduced resume with its measurement, or a null measurement when it could not be rendered. Hiding content never
 * lengthens the layout, so the resume with every step applied bounds what any step can reach: when even it does not
 * fit on one page, the loop runs no step that cannot reach one, and settles for the first two-page result, if any.
 */
async function reduce<TMeasurement extends PageMeasurement>({ reduction, context, measure }: Readonly<{
  reduction: ReducibleResume; context: ReductionContext; measure: MeasureLayout<TMeasurement>
}>): Promise<MeasuredReduction<TMeasurement>> {
  const measureReduction = (current: ReducibleResume) =>
    measure({ document: current.resume, revision: current.editing.revision })
  const unchanged = { reduction, measurement: await measureReduction(reduction) }
  if (unchanged.measurement === null || unchanged.measurement.pageCount === 1) return unchanged
  const reductions = readSuccessiveReductions({ reduction, context })
  const fullest = reductions.at(-1)
  if (fullest === undefined) return unchanged
  const fullestMeasurement = await measureReduction(fullest)
  // A fullest reduction that cannot be rendered says nothing of the others: every step is measured in turn.
  const reachablePages = fullestMeasurement?.pageCount ?? 1
  if (reachablePages > 2 || (reachablePages === 2 && unchanged.measurement.pageCount === 2)) return unchanged
  // Each step only adds Hidden Content, so the first two-page result is the one with the least.
  let twoPageResult = unchanged.measurement.pageCount === 2 ? unchanged : null
  for (const current of reductions) {
    const measurement = current === fullest ? fullestMeasurement : await measureReduction(current)
    if (measurement === null) break
    if (measurement.pageCount === 1) return { reduction: current, measurement }
    if (measurement.pageCount === 2) {
      twoPageResult ??= { reduction: current, measurement }
      if (reachablePages === 2) break
    }
  }
  return twoPageResult ?? unchanged
}

/** The resume after each step in turn, a repeating step once per field it hides, until no step has anything left. */
function readSuccessiveReductions({ reduction, context }: Readonly<{
  reduction: ReducibleResume; context: ReductionContext
}>): readonly ReducibleResume[] {
  const reductions: ReducibleResume[] = []
  let current = reduction
  for (const step of reductionSteps) {
    for (;;) {
      const hidden = step.select({ reduction: current, context })
      if (hidden.length === 0) break
      current = hideFields({ reduction: current, references: hidden })
      reductions.push(current)
      if (!step.repeats) break
    }
  }
  return reductions
}

const reductionSteps: readonly ReductionStep[] = [
  // Context Experiences go down to one achievement.
  { repeats: false, select: ({ reduction }) => readContextExperiences(reduction).flatMap((experience) =>
    hideableAchievementsBeyond({ reduction, experience, floor: 1 })) },
  // Context Experiences go down to one line: role, organization and dates.
  { repeats: false, select: ({ reduction }) => readContextExperiences(reduction).flatMap((experience) =>
    readHideable({ reduction, references: readExperienceReferences({ resume: reduction.resume, experience,
      fieldNames: ['achievements', 'context', 'location'] }) })) },
  // Projects, then Skills, go down to those citing a fact the Match Analysis found relevant.
  { repeats: false, select: ({ reduction, context }) => readHideable({ reduction, references: readResumeFields({ resume: reduction.resume })
    .filter(({ field, location }) => location.kind === 'section' && location.section === 'projects'
      && !citesRelevantFact({ field, context })) }) },
  { repeats: false, select: ({ reduction, context }) => readIrrelevantSkills({ reduction, context }) },
  // One achievement at a time from the Relevant Experience with the most visible achievements per year.
  { repeats: true, select: ({ reduction, context }) => readDensestAchievement({ reduction, context }) },
]

function readContextExperiences({ resume }: ReducibleResume) {
  return resume.experiences.filter(({ chronology }) => chronology === 'context')
}

/** The last achievements an experience may lose while it keeps at least `floor` visible, restored ones never counted out. */
function hideableAchievementsBeyond({ reduction, experience, floor }: Readonly<{
  reduction: ReducibleResume; experience: TailoredResumeExperience; floor: number
}>) {
  const hideable = readHideable({ reduction, references: readExperienceReferences({ resume: reduction.resume, experience,
    fieldNames: ['achievements'] }) })
  return hideable.reverse().slice(0, Math.max(0, experience.achievements.length - floor))
}

/** The fields of one experience with these names, in the order the resume shows them. */
function readExperienceReferences({ resume, experience, fieldNames }: Readonly<{
  resume: TailoredResume; experience: TailoredResumeExperience; fieldNames: readonly string[]
}>) {
  return readResumeFields({ resume: { ...resume, valueProposition: { ...resume.valueProposition, paragraphs: [] },
    experiences: [experience], sections: [] } })
    .filter(({ location }) => location.kind === 'experience' && fieldNames.includes(location.fieldName))
}

/**
 * Skill items citing no relevant fact; a group left with no visible item loses its category too, so no empty
 * heading remains.
 */
function readIrrelevantSkills({ reduction, context }: Readonly<{ reduction: ReducibleResume; context: ReductionContext }>) {
  const references = readResumeFields({ resume: reduction.resume })
  const items = readHideable({ reduction, references: references.filter(({ field, location }) => location.kind === 'skill-group'
    && location.fieldName === 'items' && !citesRelevantFact({ field, context })) })
  const hiddenIds = new Set(items.map(({ field }) => field.id))
  const groups = reduction.resume.sections.flatMap((section) => section.section === 'skills' ? section.groups : [])
  const emptiedGroupIds = new Set(groups.filter(({ items: groupItems }) => groupItems.length > 0
    && groupItems.every(({ id }) => hiddenIds.has(id))).map(({ id }) => id))
  const categories = readHideable({ reduction, references: references.filter(({ location }) => location.kind === 'skill-group'
    && location.fieldName === 'category' && emptiedGroupIds.has(location.groupId)) })
  return [...items, ...categories]
}

/**
 * The last hideable achievement of the Relevant Experience with the most visible achievements per year of duration,
 * above the floor of two. An undated experience counts as one year, as its achievement budget does; between equal
 * rates, the older experience loses first.
 */
function readDensestAchievement({ reduction, context }: Readonly<{ reduction: ReducibleResume; context: ReductionContext }>) {
  const candidates = reduction.resume.experiences.flatMap((experience) => {
    if (experience.chronology !== 'relevant') return []
    const [achievement] = hideableAchievementsBeyond({ reduction, experience, floor: relevantExperienceAchievementFloor })
    if (achievement === undefined) return []
    const months = readExperienceMonths({ today: context.today, experience: {
      startDate: experience.startDate?.text ?? null, endDate: experience.endDate?.text ?? null } }) ?? 12
    return [{ achievement, rate: experience.achievements.length / months }]
  })
  const densest = candidates.reduce<typeof candidates[number] | undefined>((best, candidate) =>
    best === undefined || candidate.rate >= best.rate ? candidate : best, undefined)
  return densest === undefined ? [] : [densest.achievement]
}

function citesRelevantFact({ field, context }: Readonly<{ field: TailoredResumeField; context: ReductionContext }>) {
  return field.factIds.some((factId) => context.relevantFactIds.has(factId))
}

/** Content the Candidate restored is never hidden again. */
function readHideable({ reduction, references }: Readonly<{ reduction: ReducibleResume; references: readonly ResumeFieldReference[] }>) {
  const restored = new Set(reduction.editing.restoredFieldIds ?? [])
  return references.filter(({ field }) => !restored.has(field.id))
}

function hideFields({ reduction, references }: Readonly<{ reduction: ReducibleResume; references: readonly ResumeFieldReference[] }>): ReducibleResume {
  return {
    resume: references.reduce((resume, { location }) => removeResumeField({ resume, location }), reduction.resume),
    editing: { ...reduction.editing, hiddenFields: [...reduction.editing.hiddenFields,
      ...references.map(({ field, location }) => ({ field, location, origin: 'overflow-reduction' as const }))] },
  }
}
