import { Badge, Button, List, Paper, Stack, Text, Title } from '@mantine/core'

import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import {
  hasValidTailoredResumeExport,
  renderTailoredResumeDocument,
} from './tailored-resume-document'

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
      <TailoredResumePreview source={{
        candidateFacts: view.session.sourceIntake?.candidateFacts ?? [],
        tailoredResume: view.session.tailoredResume,
      }} />
    </Stack>
  </Paper>
}

function TailoredResumePreview({ source }: Readonly<{
  source: Readonly<{
    candidateFacts: readonly Readonly<{ id: `source-fact-${string}`; path: string; status: 'attested' | 'excluded-critical-ambiguity'; value: string }>[]
    tailoredResume: TailoredResume
  }>
}>) {
  const canExport = hasValidTailoredResumeExport(source)
  const html = renderTailoredResumeDocument({ tailoredResume: source.tailoredResume })
  return <section aria-labelledby="tailored-resume-preview-title">
    <Title id="tailored-resume-preview-title" order={3}>Preview and export</Title>
    <Text c="dimmed" mt="xs">Preview the exact semantic document used for your PDF.</Text>
    <iframe sandbox="" srcDoc={html} style={{ border: 0, height: '72rem', marginTop: '1rem', width: '100%' }}
      title="Tailored Resume preview" />
    {canExport ? <Button mt="md" onClick={() => { printTailoredResume({ html }) }}>
      Download PDF
    </Button> : <Text c="red" mt="md" role="alert">
      Add your full name and an email address or phone number before exporting.
    </Text>}
  </section>
}

function printTailoredResume({ html }: Readonly<{ html: string }>) {
  const documentUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const printWindow = window.open(documentUrl, '_blank', 'noopener,noreferrer')
  if (printWindow === null) return
  printWindow.addEventListener('load', () => {
    printWindow.print()
    URL.revokeObjectURL(documentUrl)
  }, { once: true })
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
