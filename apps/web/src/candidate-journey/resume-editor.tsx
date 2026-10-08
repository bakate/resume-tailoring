import { Button, Group, Paper, Stack, Tabs, Text, Textarea, TextInput, Title } from '@mantine/core'
import { useState } from 'react'
import type { ResumeSectionName, TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import { readResumeFields } from './tailored-resume-editing'
import type { ResumeFieldReference } from './tailored-resume-editing'
import type { ResumeReviewController, RetryableOperations } from './tailored-resume-workspace'
import { ResumeOperationFailureAlert } from './failure-recovery'
import type { ResumeReviewCopy } from './resume-review-copy'

type EditorProps = Readonly<{
  candidateJourney: ResumeReviewController; localization: Localization; resume: TailoredResume; copy: ResumeReviewCopy
  operations: RetryableOperations
}>
export type EditorTab = 'contacts' | 'recovery'
type EditorContext = EditorProps & Readonly<{ announce: (message: string) => void }>

export function ResumeEditor({ initialTab, ...props }: EditorProps & Readonly<{ initialTab: EditorTab }>) {
  const [announcement, announce] = useState('')
  const { copy, resume } = props
  const sections = readSections({ resume })
  return <Stack><EditorStatus {...props} /><Tabs defaultValue={initialTab} keepMounted={false}>
    <Tabs.List aria-label={copy.edit}>
      <Tabs.Tab value="contacts">{copy.contacts}</Tabs.Tab>
      {sections.map((section) => <Tabs.Tab key={section} value={section}>{copy[section]}</Tabs.Tab>)}
      <Tabs.Tab value="recovery">{copy.recovery}</Tabs.Tab><Tabs.Tab value="order">{copy.order}</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="contacts" pt="md"><ContactEditor {...props} /></Tabs.Panel>
    {sections.map((section) => <Tabs.Panel key={section} value={section} pt="md">
      <SectionEditor {...props} {...{ section, announce }} /></Tabs.Panel>)}
    <Tabs.Panel value="recovery" pt="md"><ContentRecovery {...props} announce={announce} /></Tabs.Panel>
    <Tabs.Panel value="order" pt="md"><SectionOrder {...props} announce={announce} /></Tabs.Panel>
  </Tabs><Text role="status" aria-live="polite" aria-atomic="true">{announcement}</Text></Stack>
}

function EditorStatus({ candidateJourney, copy, localization, operations }: EditorProps) {
  const { view } = candidateJourney
  const review = view.status === 'candidate-session-open' ? view.resumeReview : null
  if (review === null) return null
  return <>
    {review.operation === 'validating-section' ? <Text role="status" aria-live="polite">{copy.validating}</Text> : null}
    {review.failure === null ? null
      : <ResumeOperationFailureAlert failure={review.failure} localization={localization} onRetry={operations.retry} />}
  </>
}

function readSections({ resume }: Readonly<{ resume: TailoredResume }>): readonly ResumeSectionName[] {
  const defaultOrder: readonly ResumeSectionName[] = ['value-proposition', 'experiences',
    ...resume.sections.map(({ section }) => section)]
  return [...new Set([...(resume.sectionOrder ?? []), ...defaultOrder])]
}

function ContactEditor({ candidateJourney, copy, localization, resume }: EditorProps) {
  const updateContact = ({ kind, value }: Readonly<{ kind: 'personal-information' | 'email' | 'phone'; value: string }>) => {
    const detail = value.trim().length === 0 ? null : { kind, value }
    if (kind === 'personal-information') {
      candidateJourney.updateResumeContacts({ identity: detail, contactDetails: resume.contactDetails }); return
    }
    const remaining = resume.contactDetails.filter((contact) => contact.kind !== kind)
    candidateJourney.updateResumeContacts({ identity: resume.identity, contactDetails: detail === null ? remaining : [...remaining, detail] })
  }
  return <Stack gap="sm"><Text size="sm">{copy.localContacts}</Text>
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
    <Group justify="space-between" mb="sm"><Title order={3}>{experience.role?.text ?? props.copy.experiences}</Title>
      <Button variant="subtle" onClick={() => {
        props.candidateJourney.hideResumeEntry({ experienceId: experience.id }); props.announce(props.copy.hiddenNotice)
      }}>{props.copy.hideEntry}</Button></Group>
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

function FieldActions({ announce, candidateJourney, copy, localization, operations, reference, resume, text, unsupported, busy }:
FieldEditorProps & Readonly<{ text: string; unsupported: boolean; busy: boolean }>) {
  const save = async () => {
    await candidateJourney.editResumeField({ fieldId: reference.key, text })
    announce(copy.saved)
  }
  return <Group><Button size="compact-sm" disabled={busy || text.trim().length === 0}
    onClick={() => { operations.attempt(() => { void save() }) }}>
    {localization.translate('tailoredResume.saveField')}</Button>
    {unsupported ? <Button size="compact-sm" disabled={text !== reference.field.text}
      onClick={() => { candidateJourney.attestResumeField({ fieldId: reference.key }); announce(copy.saved) }}>
      {localization.translate('tailoredResume.attestField')}</Button> : null}
    <Button size="compact-sm" variant="subtle" onClick={() => {
      candidateJourney.hideResumeField({ fieldId: reference.key }); announce(copy.hiddenNotice)
    }}>{localization.translate('tailoredResume.hideField')}</Button>
    <FieldOrdering {...{ announce, candidateJourney, copy, localization, reference, resume }} />
  </Group>
}

function FieldOrdering({ announce, candidateJourney, copy, localization, reference, resume }: Omit<EditorContext, 'operations'> & Readonly<{ reference: ResumeFieldReference }>) {
  const isMovable = reference.location.kind === 'value-proposition' || reference.location.kind === 'section'
    || (reference.location.kind === 'experience' && reference.location.fieldName === 'achievements')
    || (reference.location.kind === 'skill-group' && reference.location.fieldName === 'items')
  if (!isMovable) return null
  const name = `${copy[sectionOf(reference)]}: ${readEntryName({ reference, resume })}`
  return <>{(['up', 'down'] as const).map((direction) => <Button key={direction} size="compact-sm" variant="subtle"
    onClick={() => { candidateJourney.moveResumeField({ fieldId: reference.key, direction }); announce(copy.ordered) }}>
    {readMoveLabel({ direction, localization, name })}</Button>)}</>
}

/** Names what a field belongs to, so its Move buttons say what they move: its experience, skill group or own wording. */
function readEntryName({ reference, resume }: Readonly<{ reference: ResumeFieldReference; resume: TailoredResume }>) {
  const { location } = reference
  if (location.kind === 'experience') {
    const experience = resume.experiences.find(({ id }) => id === location.experienceId)
    const entry = experience?.organization?.text ?? experience?.role?.text
    if (entry !== undefined) return entry
  }
  if (location.kind === 'skill-group') {
    const skills = resume.sections.find((section) => section.section === 'skills')
    const category = skills?.section === 'skills' ? skills.groups.find(({ id }) => id === location.groupId)?.category?.text : undefined
    if (category !== undefined) return category
  }
  return excerpt(reference.field.text)
}

function excerpt(text: string) {
  const words = text.trim().split(/\s+/u)
  return words.length <= entryNameWords ? words.join(' ') : `${words.slice(0, entryNameWords).join(' ')}…`
}

const entryNameWords = 6

function readMoveLabel({ direction, localization, name }: Readonly<{
  direction: 'up' | 'down'; localization: Localization; name: string
}>) {
  return localization.translate(direction === 'up' ? 'tailoredResume.moveUp' : 'tailoredResume.moveDown').replace('{name}', name)
}

type Recovery = NonNullable<Extract<ResumeReviewController['view'], { status: 'candidate-session-open' }>['resumeReview']>['recovery']
type RecoveryProps = EditorContext & Readonly<{ recovery: Recovery }>

function ContentRecovery(props: EditorContext) {
  const { view } = props.candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  const { recovery } = view.resumeReview
  const empty = recovery.hiddenFields.length === 0 && recovery.hiddenExperiences.length === 0 && recovery.omittedFacts.length === 0
  return <Stack><Title order={3}>{props.copy.hidden}</Title>
    <HiddenExperienceRecovery {...props} recovery={recovery} />
    <HiddenFieldRecovery {...props} recovery={recovery} />
    <OmittedFactRecovery {...props} recovery={recovery} />
    {empty ? <Text>{props.copy.emptyRecovery}</Text> : null}
  </Stack>
}

function HiddenExperienceRecovery({ announce, candidateJourney, copy, recovery }: RecoveryProps) {
  return <>{recovery.hiddenExperiences.map((experience) => <Group key={experience.id} justify="space-between">
    <Text>{[experience.role?.text, experience.organization?.text].filter(Boolean).join(' · ')}</Text>
    <Button variant="subtle" onClick={() => {
      candidateJourney.restoreResumeEntry({ experienceId: experience.id }); announce(copy.restored)
    }}>{copy.restoreEntry}</Button></Group>)}</>
}

function HiddenFieldRecovery({ announce, candidateJourney, copy, localization, recovery }: RecoveryProps) {
  return <>{recovery.hiddenFields.map(({ field, origin }) => <Group key={field.id} justify="space-between"><Stack gap={0}>
    <Text>{field.text}</Text>{origin === 'overflow-reduction' ? <Text size="sm" c="dimmed">{copy.hiddenByReduction}</Text> : null}</Stack>
    <Button variant="subtle" onClick={() => { candidateJourney.restoreResumeField({ fieldId: field.id }); announce(copy.restored) }}>
      {localization.translate('tailoredResume.restoreField')}</Button></Group>)}</>
}

function OmittedFactRecovery({ announce, candidateJourney, copy, recovery }: RecoveryProps) {
  return <><Title order={3}>{copy.omitted}</Title>
    {recovery.omittedFacts.map((fact) => <Group key={fact.id} justify="space-between"><Text>{fact.value}</Text>
      <Button variant="subtle" onClick={() => { candidateJourney.restoreSourceFact({ factId: fact.id }); announce(copy.restored) }}>
        {copy.restore}</Button></Group>)}</>
}

function SectionOrder({ announce, candidateJourney, copy, localization, resume }: EditorContext) {
  const sections = readSections({ resume })
  const move = ({ index, direction }: Readonly<{ index: number; direction: 'up' | 'down' }>) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const selected = sections[index]
    const target = sections[targetIndex]
    if (selected === undefined || target === undefined) return
    const sectionOrder = sections.map((section, sectionIndex) => sectionIndex === index ? target : sectionIndex === targetIndex ? selected : section)
    candidateJourney.reorderResumeSections({ sectionOrder }); announce(copy.ordered)
  }
  return <Stack>{sections.map((section, index) => <Group key={section} justify="space-between">
    <Text>{copy[section]}</Text><Group>{(['up', 'down'] as const).map((direction) =>
      <Button key={direction} variant="subtle" disabled={direction === 'up' ? index === 0 : index === sections.length - 1}
        onClick={() => { move({ index, direction }) }}>
        {readMoveLabel({ direction, localization, name: copy[section] })}</Button>)}</Group>
  </Group>)}</Stack>
}
