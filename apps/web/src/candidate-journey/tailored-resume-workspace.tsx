import { Badge, List, Paper, Stack, Text, Title } from '@mantine/core'

import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'

type CandidateJourneyController = ReturnType<typeof useCandidateJourney>

export function TailoredResumeWorkspace({ candidateJourney, localization }: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open'
    || view.session.phase !== 'tailored-resume-preparation'
    || view.session.tailoredResume === null) return null
  return <Paper component="section" p="xl" shadow="xs" withBorder>
    <Stack gap="lg"><TailoredResumeHeader localization={localization}
      tailoredResume={view.session.tailoredResume} />
      <ValueProposition localization={localization} tailoredResume={view.session.tailoredResume} />
      <ExperienceList localization={localization} tailoredResume={view.session.tailoredResume} />
      {view.session.tailoredResume.sections.map((section) => <ResumeSection key={section.section}
        localization={localization} section={section} />)}
    </Stack>
  </Paper>
}

function TailoredResumeHeader({ localization, tailoredResume }: Readonly<{
  localization: Localization
  tailoredResume: TailoredResume
}>) {
  return <div><Badge color="forest" variant="light">
    {localization.translate('tailoredResume.ready')}
  </Badge><Title mt="xs" order={2} size="h3">
    {tailoredResume.identity?.value ?? localization.translate('tailoredResume.fallbackRole')}
  </Title><Text c="dimmed" mt="xs">
    {tailoredResume.targetRole?.value ?? localization.translate('tailoredResume.fallbackRole')}
  </Text>{tailoredResume.contactDetails.length === 0 ? null : <Text c="dimmed" mt="xs">
    {tailoredResume.contactDetails.map(({ value }) => value).join(' · ')}
  </Text>}</div>
}

function ValueProposition({ localization, tailoredResume }: Readonly<{
  localization: Localization
  tailoredResume: TailoredResume
}>) {
  if (tailoredResume.valueProposition.length === 0) return null
  return <ResumeFieldList fields={tailoredResume.valueProposition}
    title={localization.translate('tailoredResume.valueProposition')} />
}

function ExperienceList({ localization, tailoredResume }: Readonly<{
  localization: Localization
  tailoredResume: TailoredResume
}>) {
  if (tailoredResume.experiences.length === 0) return null
  return <section><Title order={3}>{localization.translate('tailoredResume.experiences')}</Title>
    {tailoredResume.experiences.map((experience, experienceIndex) => <div
      key={`experience-${String(experienceIndex)}`}><Text c="dimmed" mt="sm" size="sm">
        {localization.translate(`tailoredResume.chronology.${experience.chronology}`)}
      </Text><List>{experience.fields.map((field) => <List.Item key={field.factIds.join('-')}>
        {field.text}
      </List.Item>)}</List></div>)}
  </section>
}

function ResumeSection({ localization, section }: Readonly<{
  localization: Localization
  section: TailoredResume['sections'][number]
}>) {
  if (section.fields.length === 0) return null
  return <ResumeFieldList fields={section.fields}
    title={localization.translate(`tailoredResume.section.${section.section}`)} />
}

function ResumeFieldList({ fields, title }: Readonly<{
  fields: readonly Readonly<{ text: string }>[]
  title: string
}>) {
  return <section><Title order={3}>{title}</Title><List mt="xs">{fields.map((field) => (
    <List.Item key={field.text}>{field.text}</List.Item>
  ))}</List></section>
}
