import { Anchor, Badge, Group, List, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import type { CandidateSession, ResumeSectionSnapshot } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionContent, ResumeSectionKind } from '@resume-tailoring/application/candidate-journey'
import { isCopiedFromSource } from '@resume-tailoring/application/candidate-journey'
import { inferTailoredResumeLocale } from '@resume-tailoring/application/tailored-resume'
import type { ResumeSectionName } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { CopiedNotice } from './copied-notice'
import { readResumeHeading } from './tailored-resume-document'
import type { ResumeHeadingKey } from './tailored-resume-document'

type ResumeSectionsPreviewProps = Readonly<{
  candidateJourney: ReturnType<typeof useCandidateJourney>; localization: Localization
}>
type ResumePreparation = NonNullable<CandidateSession['preparation']>
/** What names an experience whose section has no text yet. */
type SectionNaming = Pick<ResumePreparation, 'sourceIntake'>

/**
 * While a preparation runs, reveals each Resume Section once validated, with a placeholder for the others; after a
 * failure or an interruption, only the validated sections it kept. Export waits for the full preview.
 */
export function ResumeSectionsPreview({ candidateJourney, localization }: ResumeSectionsPreviewProps) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const { preparationProgress, session, session: { preparation } } = view
  if (preparation === undefined) return null
  const panel = { localization, naming: preparation, resumeLocale: readResumeLocale({ preparation, session }) }
  if (preparationProgress !== null) return preparationProgress.sections.length === 0 ? null
    : <ResumeSectionsPanel {...panel} sections={preparationProgress.sections} state="preparing" />
  const kept = readKeptSections(preparation)
  return kept.length === 0 ? null : <ResumeSectionsPanel {...panel} sections={kept} state="kept" />
}

/**
 * Validated sections are read-only. While preparing they are marked as not final: coherence may still send one back
 * for rewriting and the layout may still hide content. Placeholders hold each section's place, so arrivals stay in order.
 */
export function ResumeSectionsPanel({ localization, naming, resumeLocale, sections, state }: Readonly<{
  localization: Localization; naming: SectionNaming; resumeLocale: 'en' | 'fr'
  sections: readonly ResumeSectionSnapshot[]; state: 'preparing' | 'kept'
}>) {
  const preparing = state === 'preparing'
  return <Paper aria-busy={preparing} aria-labelledby="resume-sections-preview-title" component="section"
    aria-describedby={preparing ? 'resume-sections-preview-not-final' : undefined}
    p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg">
      <div><Group gap="sm" wrap="wrap"><Title id="resume-sections-preview-title" order={2}>
        {localization.translate(preparing ? 'resumeSections.title' : 'resumeSections.keptTitle')}</Title>
        {preparing ? <Badge color="informative" variant="light">
          {localization.translate('resumeSections.notFinal')}</Badge> : null}</Group>
        <Text c="dimmed">{localization.translate(preparing ? 'resumeSections.description' : 'resumeSections.keptDescription')}</Text>
        {preparing ? <Text c="dimmed" id="resume-sections-preview-not-final" size="sm">
          {localization.translate('resumeSections.notFinalDescription')}</Text> : null}</div>
      <Stack className="resume-sections-preview-list" component="ol" gap="lg">
        {groupSections(sections).map((group) => <li key={group[0].key}>
          <ResumeSectionGroupPreview {...{ localization, group, naming, resumeLocale }} /></li>)}
      </Stack>
    </Stack>
  </Paper>
}

/** Names each Resume Section the failed preparation left unwritten, as a link to its placeholder among the kept sections. */
export function FailedSectionsSummary({ candidateJourney, localization }: ResumeSectionsPreviewProps) {
  const { view } = candidateJourney
  const preparation = view.status === 'candidate-session-open' ? view.session.preparation : undefined
  if (preparation === undefined) return null
  const failed = readKeptSections(preparation).filter(({ status }) => status === 'failed')
  if (failed.length === 0) return null
  return <Stack gap={4}>
    <Text size="sm">{localization.translate('resumeSections.failedSummary')}</Text>
    <List size="sm">{failed.map((section) => <List.Item key={section.key}>
      <Anchor href={`#${readSectionAnchor(section)}`} onClick={(event) => { event.preventDefault(); focusSection(section) }}>
        {readSectionName({ localization, naming: preparation, section })}</Anchor></List.Item>)}</List>
  </Stack>
}

function focusSection(section: ResumeSectionSnapshot) {
  const target = document.getElementById(readSectionAnchor(section))
  target?.scrollIntoView({ block: 'center' })
  target?.focus({ preventScroll: true })
}

function readSectionAnchor({ key }: ResumeSectionSnapshot) {
  return `resume-section-${key.replaceAll('.', '-')}`
}

/** An experience is named by its role and organization from the Source Profile, since a failed section has no text. */
function readSectionName({ localization, naming, section }: Readonly<{
  localization: Localization; naming: SectionNaming; section: ResumeSectionSnapshot
}>) {
  const label = localization.translate(`resumeReview.section.${sectionLabelKeys[section.kind]}`)
  const index = /^experiences\.(\d+)$/u.exec(section.key)?.[1]
  const experience = index === undefined ? undefined : naming.sourceIntake?.sourceProfile.experiences[Number(index)]
  const name = [experience?.role, experience?.organization].filter(Boolean).join(' – ')
  return name.length === 0 ? label
    : localization.translate('resumeSections.namedSection').replace('{section}', label).replace('{name}', name)
}

// After a failure or an interruption only validated text is worth keeping on screen.
function readKeptSections({ sections = [], status }: ResumePreparation) {
  const kept = (status === 'failed' || status === 'interrupted') && sections.some((section) => section.status === 'validated')
  return kept ? sections : []
}

type ResumeSectionGroup = readonly [ResumeSectionSnapshot, ...ResumeSectionSnapshot[]]

/** Consecutive experiences form one resume section, as in the final document; every other Resume Section stands alone. */
function groupSections(sections: readonly ResumeSectionSnapshot[]): readonly ResumeSectionGroup[] {
  return sections.reduce<ResumeSectionGroup[]>((groups, section) => {
    const previous = groups.at(-1)
    if (previous?.[0].kind === 'experience' && section.kind === 'experience') {
      return [...groups.slice(0, -1), [...previous, section]]
    }
    return [...groups, [section]]
  }, [])
}

/**
 * Headings follow the resume language like the final document; status messages follow the interface language. Once
 * published, the preparation no longer keeps its Job Match: the session's is the same one.
 */
function readResumeLocale({ preparation, session }: Readonly<{ preparation: ResumePreparation; session: CandidateSession }>) {
  const jobMatch = preparation.jobMatch ?? session.jobMatch
  return preparation.locale ?? inferTailoredResumeLocale({ content: jobMatch?.jobPosting.originalContent ?? '' })
}

function ResumeSectionGroupPreview({ group, localization, naming, resumeLocale }: Readonly<{
  group: ResumeSectionGroup; localization: Localization; naming: SectionNaming; resumeLocale: 'en' | 'fr'
}>) {
  const heading = readResumeHeading({ key: sectionHeadingKeys[group[0].kind], locale: resumeLocale })
  return <Stack aria-label={heading} component="section" gap="xs">
    <Title order={3} size="h4">{heading}</Title>
    {group.map((section) => <ResumeSectionPreview key={section.key} {...{ localization, naming, section }} />)}
  </Stack>
}

function ResumeSectionPreview({ localization, naming, section }: Readonly<{
  localization: Localization; naming: SectionNaming; section: ResumeSectionSnapshot
}>) {
  if (section.status === 'validated') return <Stack gap={4}>
    <ValidatedSectionContent content={section.content} />
    {isCopiedFromSource(section.content) ? <CopiedNotice localization={localization} /> : null}
  </Stack>
  if (section.status === 'failed') {
    const name = readSectionName({ localization, naming, section })
    // Focusable so the failure summary's link can lead the Candidate here.
    return <Stack aria-label={name} id={readSectionAnchor(section)} role="group" tabIndex={-1}>
      <Text c="caution.8" fw={600}>{localization.translate('resumeSections.failed').replace('{section}', name)}</Text>
    </Stack>
  }
  const label = localization.translate(`resumeReview.section.${sectionLabelKeys[section.kind]}`)
  return <Stack gap="xs">
    <Text c="dimmed" role="status">{localization.translate('resumeSections.writing').replace('{section}', label)}</Text>
    <Skeleton aria-hidden="true" height={10} radius="xl" width="88%" />
    <Skeleton aria-hidden="true" height={10} radius="xl" width="64%" />
  </Stack>
}

function ValidatedSectionContent({ content }: Readonly<{ content: ResumeSectionContent }>) {
  if (content.kind === 'value-proposition') return <>{content.paragraphs.map((field) => <Text key={field.id}>{field.text}</Text>)}</>
  if (content.kind === 'skills') return <List>{content.groups.map((group) => <List.Item key={group.id}>
    {[group.category?.text, group.items.map(({ text }) => text).join(', ')].filter(Boolean).join(' : ')}</List.Item>)}</List>
  if (content.kind !== 'experience') return <List>{content.fields.map((field) => <List.Item key={field.id}>{field.text}</List.Item>)}</List>
  const { role, organization, startDate, endDate, location, context, achievements } = content.experience
  const period = [startDate?.text, endDate?.text].filter(Boolean).join(' – ')
  return <Stack gap={4}>
    <Text fw={700}>{[role?.text, organization?.text].filter(Boolean).join(' – ')}</Text>
    {period.length === 0 && !location ? null : <Group justify="space-between" gap="sm">
      <Text c="dimmed" size="sm">{period}</Text>{location ? <Text c="dimmed" size="sm">{location.text}</Text> : null}</Group>}
    {context === null ? null : <Text size="sm">{context.text}</Text>}
    <List>{achievements.map((field) => <List.Item key={field.id}>{field.text}</List.Item>)}</List>
  </Stack>
}

const sectionHeadingKeys = {
  'value-proposition': 'summary', experience: 'experiences', skills: 'skills', education: 'education',
  languages: 'languages', projects: 'projects', certifications: 'certifications',
} as const satisfies Record<ResumeSectionKind, ResumeHeadingKey>

const sectionLabelKeys = {
  'value-proposition': 'value-proposition', experience: 'experiences', skills: 'skills', education: 'education',
  languages: 'languages', projects: 'projects', certifications: 'certifications',
} as const satisfies Record<ResumeSectionKind, ResumeSectionName>
