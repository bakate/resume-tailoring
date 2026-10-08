import { Group, List, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import type { CandidateSession, ResumeSectionSnapshot } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionContent, ResumeSectionKind } from '@resume-tailoring/application/candidate-journey'
import { isCopiedFromSource } from '@resume-tailoring/application/candidate-journey'
import { inferTailoredResumeLocale } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { CopiedNotice } from './copied-notice'
import { resumeReviewCopy } from './resume-review-copy'
import { readResumeHeading } from './tailored-resume-document'
import type { ResumeHeadingKey } from './tailored-resume-document'

type ResumeSectionsPreviewProps = Readonly<{
  candidateJourney: ReturnType<typeof useCandidateJourney>; localization: Localization
}>
type ResumePreparation = NonNullable<CandidateSession['preparation']>

/** Reveals each Resume Section once validated, with a placeholder for the others; export waits for the full preview. */
export function ResumeSectionsPreview({ candidateJourney, localization }: ResumeSectionsPreviewProps) {
  const { view } = candidateJourney
  const preparation = view.status === 'candidate-session-open' ? view.session.preparation : undefined
  if (preparation === undefined || !shouldRevealPreparingSections(preparation)) return null
  const pending = preparation.status === 'pending'
  return <Paper aria-busy={pending} aria-labelledby="resume-sections-preview-title" component="section"
    p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg">
      <div><Title id="resume-sections-preview-title" order={2}>
        {localization.translate(pending ? 'resumeSections.title' : 'resumeSections.keptTitle')}</Title>
        <Text c="dimmed">{localization.translate(pending ? 'resumeSections.description' : 'resumeSections.keptDescription')}</Text></div>
      <Stack className="resume-sections-preview-list" component="ol" gap="lg">
        {groupSections(preparation.sections ?? []).map((group) => <li key={group[0].key}>
          <ResumeSectionGroupPreview {...{ localization, group }} resumeLocale={readResumeLocale(preparation)} /></li>)}
      </Stack>
    </Stack>
  </Paper>
}

// Placeholders alone are useful while writing; after a failure or interruption only validated text is worth keeping on screen.
function shouldRevealPreparingSections({ sections = [], status }: ResumePreparation) {
  if (status === 'pending') return sections.length > 0
  return (status === 'failed' || status === 'interrupted') && sections.some((section) => section.status === 'validated')
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

// Headings follow the resume language like the final document; status messages follow the interface language.
function readResumeLocale(preparation: ResumePreparation) {
  return preparation.locale ?? inferTailoredResumeLocale({ content: preparation.jobMatch?.jobPosting.originalContent ?? '' })
}

function ResumeSectionGroupPreview({ group, localization, resumeLocale }: Readonly<{
  group: ResumeSectionGroup; localization: Localization; resumeLocale: 'en' | 'fr'
}>) {
  const heading = readResumeHeading({ key: sectionHeadingKeys[group[0].kind], locale: resumeLocale })
  return <Stack aria-label={heading} component="section" gap="xs">
    <Title order={3} size="h4">{heading}</Title>
    {group.map((section) => <ResumeSectionPreview key={section.key} {...{ localization, section }} />)}
  </Stack>
}

function ResumeSectionPreview({ localization, section }: Readonly<{ localization: Localization; section: ResumeSectionSnapshot }>) {
  if (section.status === 'validated') return <Stack gap={4}>
    <ValidatedSectionContent content={section.content} />
    {isCopiedFromSource(section.content) ? <CopiedNotice localization={localization} /> : null}
  </Stack>
  const label = resumeReviewCopy[localization.locale][sectionLabelKeys[section.kind]]
  const message = localization.translate(section.status === 'failed' ? 'resumeSections.failed' : 'resumeSections.writing')
    .replace('{section}', label)
  return <Stack gap="xs">
    <Text c="dimmed" role="status">{message}</Text>
    {section.status === 'failed' ? null : <>
      <Skeleton aria-hidden="true" height={10} radius="xl" width="88%" />
      <Skeleton aria-hidden="true" height={10} radius="xl" width="64%" /></>}
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
} as const satisfies Record<ResumeSectionKind, keyof typeof resumeReviewCopy['en']>
