import { Button, Group, Paper, Stack, Tabs, Text, Textarea, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import type { ResumeSectionName, TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import { readResumeFields } from './tailored-resume-editing'
import type { ResumeFieldReference } from './tailored-resume-editing'
import type { ResumeReviewController, RetryableOperations } from './tailored-resume-workspace'
import { ResumeOperationFailureAlert } from './failure-recovery'

type EditorProps = Readonly<{
  candidateJourney: ResumeReviewController; localization: Localization; resume: TailoredResume
  operations: RetryableOperations
}>
export type EditorTab = 'contacts' | 'recovery'
type EditorContext = EditorProps & Readonly<{ announce: (message: string) => void }>

export function ResumeEditor({ initialTab, ...props }: EditorProps & Readonly<{ initialTab: EditorTab }>) {
  const [announcement, announce] = useState('')
  const { localization, resume } = props
  const sections = readSections({ resume })
  return <Stack><EditorStatus {...props} /><Tabs defaultValue={initialTab} keepMounted={false}>
    <Tabs.List aria-label={localization.translate('resumeReview.edit')}>
      <Tabs.Tab value="contacts">{localization.translate('resumeReview.contacts')}</Tabs.Tab>
      {sections.map((section) => <Tabs.Tab key={section} value={section}>{localization.translate(`resumeReview.section.${section}`)}</Tabs.Tab>)}
      <Tabs.Tab value="recovery">{localization.translate('resumeReview.recovery')}</Tabs.Tab><Tabs.Tab value="order">{localization.translate('resumeReview.order')}</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="contacts" pt="md"><ContactEditor {...props} /></Tabs.Panel>
    {sections.map((section) => <Tabs.Panel key={section} value={section} pt="md">
      <SectionEditor {...props} {...{ section, announce }} /></Tabs.Panel>)}
    <Tabs.Panel value="recovery" pt="md"><ContentRecovery {...props} announce={announce} /></Tabs.Panel>
    <Tabs.Panel value="order" pt="md"><SectionOrder {...props} announce={announce} /></Tabs.Panel>
  </Tabs><Text role="status" aria-live="polite" aria-atomic="true">{announcement}</Text></Stack>
}

function EditorStatus({ candidateJourney, localization, operations }: EditorProps) {
  const { view } = candidateJourney
  const review = view.status === 'candidate-session-open' ? view.resumeReview : null
  if (review === null) return null
  return <>
    {review.operation === 'validating-section' ? <Text role="status" aria-live="polite">{localization.translate('resumeReview.validating')}</Text> : null}
    {review.failure === null ? null
      : <ResumeOperationFailureAlert failure={review.failure} localization={localization} onRetry={operations.retry} />}
  </>
}

function readSections({ resume }: Readonly<{ resume: TailoredResume }>): readonly ResumeSectionName[] {
  const defaultOrder: readonly ResumeSectionName[] = ['value-proposition', 'experiences',
    ...resume.sections.map(({ section }) => section)]
  return [...new Set([...(resume.sectionOrder ?? []), ...defaultOrder])]
}

function ContactEditor({ candidateJourney, localization, resume }: EditorProps) {
  const updateContact = ({ kind, value }: Readonly<{ kind: 'personal-information' | 'email' | 'phone'; value: string }>) => {
    const detail = value.trim().length === 0 ? null : { kind, value }
    if (kind === 'personal-information') {
      candidateJourney.updateResumeContacts({ identity: detail, contactDetails: resume.contactDetails }); return
    }
    const remaining = resume.contactDetails.filter((contact) => contact.kind !== kind)
    candidateJourney.updateResumeContacts({ identity: resume.identity, contactDetails: detail === null ? remaining : [...remaining, detail] })
  }
  return <Stack gap="sm"><Text size="sm">{localization.translate('resumeReview.localContacts')}</Text>
    <TextInput label={localization.translate('tailoredResume.name')} value={resume.identity?.value ?? ''}
      onChange={(event) => { updateContact({ kind: 'personal-information', value: event.currentTarget.value }) }} />
    {(['email', 'phone'] as const).map((kind) => <TextInput key={kind}
      label={localization.translate(kind === 'email' ? 'tailoredResume.email' : 'tailoredResume.phone')}
      value={resume.contactDetails.find((contact) => contact.kind === kind)?.value ?? ''}
      onChange={(event) => { updateContact({ kind, value: event.currentTarget.value }) }} />)}
  </Stack>
}

function SectionEditor(props: EditorContext & Readonly<{ section: ResumeSectionName }>) {
  if (props.section === 'experiences') return <ExperienceEditor {...props} />
  const references = readResumeFields({ resume: props.resume }).filter((reference) => sectionOf(reference) === props.section)
  return <Stack gap="md">{references.map((reference) => <FieldEditor key={`${reference.key}:${reference.field.text}`}
    {...props} reference={reference} />)}</Stack>
}

function ExperienceEditor(props: EditorContext) {
  const references = readResumeFields({ resume: props.resume })
  return <Stack>{props.resume.experiences.map((experience) => <section key={experience.id}>
    <Group justify="space-between" mb="sm"><Title order={3}>{experience.role?.text ?? props.localization.translate('resumeReview.section.experiences')}</Title>
      <Button variant="subtle" onClick={() => {
        props.candidateJourney.hideResumeEntry({ experienceId: experience.id }); props.announce(props.localization.translate('resumeReview.hiddenNotice'))
      }}>{props.localization.translate('resumeReview.hideEntry')}</Button></Group>
    <Stack>{references.filter(({ location }) => location.kind === 'experience' && location.experienceId === experience.id)
      .map((reference) => <FieldEditor key={`${reference.key}:${reference.field.text}`} {...props} reference={reference} />)}</Stack>
  </section>)}</Stack>
}

function sectionOf({ location }: ResumeFieldReference): ResumeSectionName {
  if (location.kind === 'value-proposition') return 'value-proposition'
  if (location.kind === 'experience') return 'experiences'
  if (location.kind === 'skill-group') return 'skills'
  return location.section
}

type FieldEditorProps = EditorContext & Readonly<{ reference: ResumeFieldReference }>

function FieldEditor(props: FieldEditorProps) {
  const { candidateJourney, localization, reference } = props
  const [text, setText] = useState(reference.field.text)
  const { view } = candidateJourney
  const review = view.status === 'candidate-session-open' ? view.resumeReview : null
  const unsupported = review?.unsupportedFieldIds.includes(reference.key) ?? false
  return <Paper p="sm" withBorder><Stack gap="xs">
    <Textarea label={localization.translate('tailoredResume.fieldLabel')} autosize minRows={2} value={text}
      onChange={(event) => { setText(event.currentTarget.value) }} />
    {unsupported ? <Text c="danger.8" role="alert">{localization.translate('tailoredResume.unsupportedField')}</Text> : null}
    <FieldActions {...props} {...{ text, unsupported, busy: review?.operation !== null }} />
  </Stack></Paper>
}

function FieldActions({ announce, candidateJourney, localization, operations, reference, text, unsupported, busy }:
FieldEditorProps & Readonly<{ text: string; unsupported: boolean; busy: boolean }>) {
  const save = async () => {
    await candidateJourney.editResumeField({ fieldId: reference.key, text })
    announce(localization.translate('resumeReview.saved'))
  }
  return <Group><Button size="compact-sm" disabled={busy || text.trim().length === 0}
    onClick={() => { operations.attempt(() => { void save() }) }}>
    {localization.translate('tailoredResume.saveField')}</Button>
    {unsupported ? <Button size="compact-sm" disabled={text !== reference.field.text}
      onClick={() => { candidateJourney.attestResumeField({ fieldId: reference.key }); announce(localization.translate('resumeReview.saved')) }}>
      {localization.translate('tailoredResume.attestField')}</Button> : null}
    <Button size="compact-sm" variant="subtle" onClick={() => {
      candidateJourney.hideResumeField({ fieldId: reference.key }); announce(localization.translate('resumeReview.hiddenNotice'))
    }}>{localization.translate('tailoredResume.hideField')}</Button>
    <FieldOrdering {...{ announce, candidateJourney, localization, reference }} />
  </Group>
}

function FieldOrdering({ announce, candidateJourney, localization, reference }: Omit<EditorContext, 'resume' | 'operations'> & Readonly<{ reference: ResumeFieldReference }>) {
  const isMovable = reference.location.kind === 'value-proposition' || reference.location.kind === 'section'
    || (reference.location.kind === 'experience' && reference.location.fieldName === 'achievements')
    || (reference.location.kind === 'skill-group' && reference.location.fieldName === 'items')
  if (!isMovable) return null
  return <>{(['up', 'down'] as const).map((direction) => <Button key={direction} size="compact-sm" variant="subtle"
    onClick={() => { candidateJourney.moveResumeField({ fieldId: reference.key, direction }); announce(localization.translate('resumeReview.ordered')) }}>
    {localization.translate(direction === 'up' ? 'tailoredResume.moveUp' : 'tailoredResume.moveDown')}</Button>)}</>
}

type Recovery = NonNullable<Extract<ResumeReviewController['view'], { status: 'candidate-session-open' }>['resumeReview']>['recovery']
type RecoveryProps = EditorContext & Readonly<{ recovery: Recovery }>

function ContentRecovery(props: EditorContext) {
  const { view } = props.candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  const { recovery } = view.resumeReview
  const empty = recovery.hiddenFields.length === 0 && recovery.hiddenExperiences.length === 0 && recovery.omittedFacts.length === 0
  return <Stack><Title order={3}>{props.localization.translate('resumeReview.hidden')}</Title>
    <HiddenExperienceRecovery {...props} recovery={recovery} />
    <HiddenFieldRecovery {...props} recovery={recovery} />
    <OmittedFactRecovery {...props} recovery={recovery} />
    {empty ? <Text>{props.localization.translate('resumeReview.emptyRecovery')}</Text> : null}
  </Stack>
}

function HiddenExperienceRecovery({ announce, candidateJourney, localization, recovery }: RecoveryProps) {
  return <>{recovery.hiddenExperiences.map((experience) => <Group key={experience.id} justify="space-between">
    <Text>{[experience.role?.text, experience.organization?.text].filter(Boolean).join(' · ')}</Text>
    <Button variant="subtle" onClick={() => {
      candidateJourney.restoreResumeEntry({ experienceId: experience.id }); announce(localization.translate('resumeReview.restored'))
    }}>{localization.translate('resumeReview.restoreEntry')}</Button></Group>)}</>
}

function HiddenFieldRecovery({ announce, candidateJourney, localization, recovery }: RecoveryProps) {
  return <>{recovery.hiddenFields.map(({ field, origin }) => <Group key={field.id} justify="space-between"><Stack gap={0}>
    <Text>{field.text}</Text>{origin === 'overflow-reduction' ? <Text size="sm" c="dimmed">{localization.translate('resumeReview.hiddenByReduction')}</Text> : null}</Stack>
    <Button variant="subtle" onClick={() => { candidateJourney.restoreResumeField({ fieldId: field.id }); announce(localization.translate('resumeReview.restored')) }}>
      {localization.translate('tailoredResume.restoreField')}</Button></Group>)}</>
}

function OmittedFactRecovery({ announce, candidateJourney, localization, recovery }: RecoveryProps) {
  return <><Title order={3}>{localization.translate('resumeReview.omitted')}</Title>
    {recovery.omittedFacts.map((fact) => <Group key={fact.id} justify="space-between"><Text>{fact.value}</Text>
      <Button variant="subtle" onClick={() => { candidateJourney.restoreSourceFact({ factId: fact.id }); announce(localization.translate('resumeReview.restored')) }}>
        {localization.translate('resumeReview.restore')}</Button></Group>)}</>
}

function SectionOrder({ announce, candidateJourney, localization, resume }: EditorContext) {
  const sections = readSections({ resume })
  const move = ({ index, direction }: Readonly<{ index: number; direction: 'up' | 'down' }>) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const selected = sections[index]
    const target = sections[targetIndex]
    if (selected === undefined || target === undefined) return
    const sectionOrder = sections.map((section, sectionIndex) => sectionIndex === index ? target : sectionIndex === targetIndex ? selected : section)
    candidateJourney.reorderResumeSections({ sectionOrder }); announce(localization.translate('resumeReview.ordered'))
  }
  return <Stack>{sections.map((section, index) => <Group key={section} justify="space-between">
    <Text>{localization.translate(`resumeReview.section.${section}`)}</Text><Group>{(['up', 'down'] as const).map((direction) =>
      <Button key={direction} variant="subtle" disabled={direction === 'up' ? index === 0 : index === sections.length - 1}
        onClick={() => { move({ index, direction }) }}>
        {localization.translate(direction === 'up' ? 'tailoredResume.moveUp' : 'tailoredResume.moveDown')}</Button>)}</Group>
  </Group>)}</Stack>
}
