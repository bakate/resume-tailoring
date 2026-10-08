import type { ResumeEditingState, TailoredResume, TailoredResumeExperience, TailoredResumeField } from './tailored-resume'
import { readExperienceMonths } from './experience-chronology'
import { readResumeFields, removeResumeField } from './resume-field-editing'
import type { ResumeFieldReference } from './resume-field-editing'
import type { ResumeRenderRequest } from './resume-export'
import type { ResumeLayoutOutcome } from './structured-resume-contract'
import { changedResumeSession, readResumeEditing } from './resume-editing'
import type { ResumeEditingAccess } from './resume-editing'
import { assessResumeLayout, proposeResumeCondensation } from './resume-condensation'

/** A Tailored Resume with the editing state that holds its Hidden Content. */
type ReducibleResume = Readonly<{ resume: TailoredResume; editing: ResumeEditingState }>

/** Lays a resume out as the export would; a failure to lay it out may throw or answer unavailable. */
export type AssessLayout = (request: ResumeRenderRequest) => Promise<Readonly<{ layout: ResumeLayoutOutcome }>>

type ReductionRequest = Readonly<{
  reduction: ReducibleResume
  relevantFactIds: readonly string[]
  today: number
  assessLayout: AssessLayout
  photoDataUrl?: string
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
 * The one-click way back within the Page Budget: Overflow Reduction of the current draft, saved as the Candidate's own
 * removal. When no reduction reaches two pages, it proposes shorter wording instead.
 */
export async function shortenResume({ access, today, photoDataUrl }: Readonly<{
  access: ResumeEditingAccess; today: number; photoDataUrl?: string
}>) {
  const review = access.readReview()
  const session = access.readSession()
  const assessLayout = access.ports.assessLayout
  if (review === null || session?.tailoredResume == null || review.operation !== null || assessLayout === undefined) return
  const baseRevision = review.draft.revision
  access.report({ baseRevision, review: { ...review, proposal: null, failure: null, operation: 'shortening' } })
  const shortened = await shortenToPageBudget({ assessLayout, today, photoDataUrl,
    reduction: { resume: session.tailoredResume, editing: readResumeEditing({ session }) },
    relevantFactIds: session.jobMatch?.analysis.relevantFactIds ?? [] })
  const current = access.readReview()
  if (current?.draft.revision !== baseRevision) return
  access.report({ baseRevision, review: { ...current, operation: null } })
  if (shortened === null) { await proposeResumeCondensation({ access, photoDataUrl }); return }
  access.save({ baseRevision, correctionKind: 'resume-claim-removal', session: changedResumeSession({ session,
    document: shortened.resume, editing: shortened.editing, revision: access.createIdentifier() }) })
  await assessResumeLayout({ access, photoDataUrl })
}

/**
 * Overflow Reduction: hides content one step at a time, re-rendering after each, and keeps the first result that fits
 * on one page. Without one, it keeps the two-page result with the least Hidden Content; beyond two pages after every
 * step, or when the resume cannot be rendered, it leaves the resume unchanged for the existing overflow outcome. It
 * never calls a language model, never removes an experience, and never hides content the Candidate restored.
 */
export async function reduceToPageBudget(request: ReductionRequest): Promise<ReducibleResume> {
  return (await reduce(request)).reduction
}

/**
 * The Candidate's request to bring a resume back within its Page Budget: Overflow Reduction first, keeping what the
 * Candidate restored; when only restored content is left to hide, the request itself lets reduction hide it again.
 * Null when even that cannot reach two pages.
 */
export async function shortenToPageBudget(request: ReductionRequest): Promise<ReducibleResume | null> {
  const kept = await reduce(request)
  if (withinPageBudget(kept.pages)) return kept.reduction
  const restoredFieldIds = request.reduction.editing.restoredFieldIds ?? []
  if (restoredFieldIds.length === 0) return null
  const released = await reduce({ ...request, reduction: { ...request.reduction,
    editing: { ...request.reduction.editing, restoredFieldIds: [] } } })
  if (!withinPageBudget(released.pages)) return null
  const hiddenIds = new Set(released.reduction.editing.hiddenFields.map(({ field }) => field.id))
  return { ...released.reduction, editing: { ...released.reduction.editing,
    restoredFieldIds: restoredFieldIds.filter((id) => !hiddenIds.has(id)) } }
}

function withinPageBudget(pages: number | null) {
  return pages === 1 || pages === 2
}

/** The reduced resume with its measured page count, or null pages when it could not be rendered. */
async function reduce({ reduction, relevantFactIds, today, assessLayout, photoDataUrl }: ReductionRequest): Promise<Readonly<{
  reduction: ReducibleResume; pages: number | null
}>> {
  const measure = (current: ReducibleResume) => measurePages({ assessLayout, photoDataUrl, reduction: current })
  const context = { relevantFactIds: new Set(relevantFactIds), today }
  const initialPages = await measure(reduction)
  if (initialPages === null || initialPages === 1) return { reduction, pages: initialPages }
  // Each step only adds Hidden Content, so the first two-page result is the one with the least.
  let twoPageResult = initialPages === 2 ? reduction : null
  let current = reduction
  const settled = () => twoPageResult === null ? { reduction, pages: initialPages } : { reduction: twoPageResult, pages: 2 }
  for (const step of reductionSteps) {
    for (;;) {
      const hidden = step.select({ reduction: current, context })
      if (hidden.length === 0) break
      current = hideFields({ reduction: current, references: hidden })
      const pages = await measure(current)
      if (pages === null) return settled()
      if (pages === 1) return { reduction: current, pages }
      if (pages === 2) twoPageResult ??= current
      if (!step.repeats) break
    }
  }
  return settled()
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

/** The page count of the real render, or null when the resume cannot be rendered. */
async function measurePages({ assessLayout, photoDataUrl, reduction }: Readonly<{
  assessLayout: AssessLayout; photoDataUrl?: string; reduction: ReducibleResume
}>) {
  const request = { draft: { document: reduction.resume, revision: reduction.editing.revision }, unsupportedFieldIds: [],
    ...(photoDataUrl === undefined ? {} : { photoDataUrl }) }
  try {
    const { layout } = await assessLayout(request)
    return layout.status === 'unavailable' ? null : layout.pageCount
  } catch {
    return null
  }
}
