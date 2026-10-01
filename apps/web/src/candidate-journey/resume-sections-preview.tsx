import { List, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import type { CandidateSession, ResumeSectionSnapshot } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionContent, ResumeSectionKind } from '@resume-tailoring/application/candidate-journey'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { resumeReviewCopy } from './resume-review-copy'

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
      <div><Title id="resume-sections-preview-title" order={2}>{localization.translate('resumeSections.title')}</Title>
        <Text c="dimmed">{localization.translate('resumeSections.description')}</Text></div>
      <Stack className="resume-sections-preview-list" component="ol" gap="lg">
        {(preparation.sections ?? []).map((section) => <li key={section.key}>
          <ResumeSectionPreview {...{ localization, section }} /></li>)}
      </Stack>
    </Stack>
  </Paper>
}

// Placeholders alone are useful while writing; after a failure or interruption only validated text is worth keeping on screen.
function shouldRevealPreparingSections({ sections = [], status }: ResumePreparation) {
  if (status === 'pending') return sections.length > 0
  return (status === 'failed' || status === 'interrupted') && sections.some((section) => section.status === 'validated')
}

function ResumeSectionPreview({ localization, section }: Readonly<{ localization: Localization; section: ResumeSectionSnapshot }>) {
  const label = resumeReviewCopy[localization.locale][sectionLabelKeys[section.kind]]
  if (section.status === 'validated') return <section aria-label={label}>
    <Title order={3} size="h4">{label}</Title><ValidatedSectionContent content={section.content} /></section>
  const message = localization.translate(section.status === 'failed' ? 'resumeSections.failed' : 'resumeSections.writing')
    .replace('{section}', label)
  return <Stack aria-label={label} component="section" gap="xs">
    <Title order={3} size="h4">{label}</Title>
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
  const { role, organization, startDate, endDate, context, achievements } = content.experience
  const period = [startDate?.text, endDate?.text].filter(Boolean).join(' – ')
  return <Stack gap={4}>
    <Text fw={700}>{[role?.text, organization?.text].filter(Boolean).join(' — ')}</Text>
    {period.length === 0 ? null : <Text c="dimmed" size="sm">{period}</Text>}
    {context === null ? null : <Text size="sm">{context.text}</Text>}
    <List>{achievements.map((field) => <List.Item key={field.id}>{field.text}</List.Item>)}</List>
  </Stack>
}

const sectionLabelKeys = {
  'value-proposition': 'value-proposition', experience: 'experiences', skills: 'skills', education: 'education',
  languages: 'languages', projects: 'projects', certifications: 'certifications',
} as const satisfies Record<ResumeSectionKind, keyof typeof resumeReviewCopy['en']>
