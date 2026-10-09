import { ActionIcon, Button, Group, Paper, Stack, Tabs, Text, Textarea, TextInput, Title, VisuallyHidden } from '@mantine/core'
import { IconArrowDown, IconArrowUp, IconEye, IconEyeOff } from '@tabler/icons-react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ResumeSectionName, TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { ResumeFieldReference } from './tailored-resume-editing'
import { readEditorEntries, readEditorSections } from './resume-editor-entries'
import type { EditorEntry, ResumeFieldLabel } from './resume-editor-entries'
import type { ResumeReviewController, RetryableOperations } from './tailored-resume-workspace'
import { ResumeOperationFailureAlert } from './failure-recovery'
import { PrivacyNote } from './processing-policy-notice'

type EditorProps = Readonly<{
  candidateJourney: ResumeReviewController; localization: Localization; resume: TailoredResume
  operations: RetryableOperations
}>
/** Where the editor opens: on the contact details, or on the Hidden Content listed at the end of the content. */
export type EditorTab = 'contacts' | 'hidden'
type EditorContext = EditorProps & Readonly<{ announce: (message: string) => void }>

/**
 * Three tabs: the contact details, the content with its Hidden Content, and the layout. `onUnsavedChange` says whether
 * an entry holds edits not saved yet, which keep the current PDF from being downloaded.
 */
export function ResumeEditor({ initialTab, onUnsavedChange, ...props }: EditorProps & Readonly<{
  initialTab: EditorTab; onUnsavedChange: (unsaved: boolean) => void
}>) {
  const [announcement, announce] = useState('')
  const [unsavedEntries, setUnsavedEntries] = useState<ReadonlySet<string>>(new Set())
  const unsaved = unsavedEntries.size > 0
  useEffect(() => { onUnsavedChange(unsaved) }, [onUnsavedChange, unsaved])
  useEffect(() => () => { onUnsavedChange(false) }, [onUnsavedChange])
  const reportUnsaved = useCallback((entryId: string, entryUnsaved: boolean) => { setUnsavedEntries((current) => {
    if (current.has(entryId) === entryUnsaved) return current
    const next = new Set(current)
    if (entryUnsaved) next.add(entryId); else next.delete(entryId)
    return next
  }) }, [])
  const { localization } = props
  return <Stack><EditorStatus {...props} />{/* Every tab stays mounted, so switching tabs keeps the drafts typed in the content. */}
    <Tabs defaultValue={initialTab === 'contacts' ? 'contacts' : 'content'}>
    <Tabs.List aria-label={localization.translate('resumeReview.edit')}>
      <Tabs.Tab value="contacts">{localization.translate('resumeReview.contacts')}</Tabs.Tab>
      <Tabs.Tab value="content">{localization.translate('resumeReview.content')}</Tabs.Tab>
      <Tabs.Tab value="layout">{localization.translate('resumeReview.layout')}</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="contacts" pt="md"><ContactEditor {...props} /></Tabs.Panel>
    <Tabs.Panel value="content" pt="md"><Stack gap="xl">
      <ContentEditor {...props} {...{ announce, reportUnsaved }} />
      <ContentRecovery {...props} announce={announce} focused={initialTab === 'hidden'} />
    </Stack></Tabs.Panel>
    <Tabs.Panel value="layout" pt="md"><SectionOrder {...props} announce={announce} /></Tabs.Panel>
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

function ContactEditor({ candidateJourney, localization, resume }: EditorProps) {
  const updateContact = ({ kind, value }: Readonly<{ kind: 'personal-information' | 'email' | 'phone'; value: string }>) => {
    const detail = value.trim().length === 0 ? null : { kind, value }
    if (kind === 'personal-information') {
      candidateJourney.updateResumeContacts({ identity: detail, contactDetails: resume.contactDetails }); return
    }
    const remaining = resume.contactDetails.filter((contact) => contact.kind !== kind)
    candidateJourney.updateResumeContacts({ identity: resume.identity, contactDetails: detail === null ? remaining : [...remaining, detail] })
  }
  return <Stack gap="sm"><PrivacyNote>{localization.translate('resumeReview.localContacts')}</PrivacyNote>
    <TextInput label={localization.translate('tailoredResume.name')} value={resume.identity?.value ?? ''}
      onChange={(event) => { updateContact({ kind: 'personal-information', value: event.currentTarget.value }) }} />
    {(['email', 'phone'] as const).map((kind) => <TextInput key={kind}
      label={localization.translate(kind === 'email' ? 'tailoredResume.email' : 'tailoredResume.phone')}
      value={resume.contactDetails.find((contact) => contact.kind === kind)?.value ?? ''}
      onChange={(event) => { updateContact({ kind, value: event.currentTarget.value }) }} />)}
  </Stack>
}

type ContentProps = EditorContext & Readonly<{ reportUnsaved: (entryId: string, unsaved: boolean) => void }>

/** Each section under its heading, then its entries: the summary, each experience, each skill group, each other section. */
function ContentEditor(props: ContentProps) {
  const entries = readEditorEntries({ resume: props.resume })
  return <>{readEditorSections({ resume: props.resume }).map((section) => {
    const sectionEntries = entries.filter((entry) => entry.section === section)
    if (sectionEntries.length === 0) return null
    return <Stack key={section} component="section" gap="md" aria-labelledby={`resume-editor-${section}`}>
      <Title id={`resume-editor-${section}`} order={3}>{props.localization.translate(`resumeReview.section.${section}`)}</Title>
      {sectionEntries.map((entry) => <EntryEditor key={entry.id} {...props} entry={entry} />)}
    </Stack>
  })}</>
}

/**
 * The fields of one entry, saved together by its one Save button. Drafts are kept by field, so hiding or moving one
 * field keeps what the Candidate typed in the others.
 */
function EntryEditor(props: ContentProps & Readonly<{ entry: EditorEntry }>) {
  const { announce, candidateJourney, entry, localization, operations, reportUnsaved } = props
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
  const edits = entry.fields.flatMap(({ reference }) => {
    const text = drafts[reference.key]
    return text === undefined || text === reference.field.text ? [] : [{ fieldId: reference.key, text }]
  })
  const unsaved = edits.length > 0
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  const blocked = !unsaved || review?.operation !== null || edits.some(({ text }) => text.trim().length === 0)
  useEffect(() => { reportUnsaved(entry.id, unsaved) }, [entry.id, reportUnsaved, unsaved])
  useEffect(() => () => { reportUnsaved(entry.id, false) }, [entry.id, reportUnsaved])
  const save = async () => {
    await candidateJourney.editResumeFields({ edits })
    setDrafts({})
    announce(localization.translate('resumeReview.saved'))
  }
  const entryName = entry.name ?? localization.translate(`resumeReview.section.${entry.section}`)
  return <Paper p="sm" withBorder><Stack gap="sm">
    {entry.name === null ? null : <Group justify="space-between" align="flex-start" gap="xs">
      <Title order={4}>{entry.name}</Title>
      {entry.section === 'experiences' ? <HideExperience {...props} /> : null}
    </Group>}
    {entry.fields.map(({ reference, label }) => <FieldEditor key={reference.key} {...props} {...{ reference }}
      label={readFieldLabel({ entry, label, localization })} text={drafts[reference.key] ?? reference.field.text}
      onChange={(text) => { setDrafts((current) => ({ ...current, [reference.key]: text })) }} />)}
    {/* Saving leaves nothing to save: an inert button that keeps its focus, rather than a disabled one that drops it. */}
    <Group><Button size="compact-sm" data-disabled={blocked || undefined} aria-disabled={blocked}
      onClick={() => { if (!blocked) operations.attempt(() => { void save() }) }}>
      {localization.translate('tailoredResume.saveField')}<VisuallyHidden> {entryName}</VisuallyHidden></Button></Group>
  </Stack></Paper>
}

function HideExperience({ announce, candidateJourney, entry, localization }: ContentProps & Readonly<{ entry: EditorEntry }>) {
  const experienceId = entry.id.replace(/^experience:/u, '')
  return <Button variant="subtle" size="compact-sm" leftSection={hideIcon} onClick={() => {
    candidateJourney.hideResumeEntry({ experienceId }); announce(localization.translate('resumeReview.hiddenNotice'))
  }}>{localization.translate('resumeReview.hideEntry')}<VisuallyHidden> {entry.name}</VisuallyHidden></Button>
}

/** A field's visible label names its kind; the entry it belongs to completes its accessible name when others share it. */
function readFieldLabel({ entry, label, localization }: Readonly<{ entry: EditorEntry; label: ResumeFieldLabel; localization: Localization }>) {
  const kind = label.kind === 'item' ? localization.translate(`resumeReview.section.${entry.section}`)
    : localization.translate(`resumeEditor.field.${label.kind}`)
  return { visible: label.position === null ? kind : `${kind} ${String(label.position)}`,
    context: entry.name === null ? null : ` – ${entry.name}` }
}

type FieldEditorProps = ContentProps & Readonly<{
  entry: EditorEntry; reference: ResumeFieldReference; label: ReturnType<typeof readFieldLabel>; text: string
  onChange: (text: string) => void
}>

/** The label row carries the field's own actions, moving and hiding it, so each field takes one row plus its text. */
function FieldEditor(props: FieldEditorProps) {
  const { announce, candidateJourney, label, localization, reference, text } = props
  const id = useId()
  const review = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.resumeReview : null
  const unsupported = review?.unsupportedFieldIds.includes(reference.key) ?? false
  const name = `${label.visible}${label.context ?? ''}`
  return <Stack gap={4}>
    <Group justify="space-between" wrap="nowrap" gap="xs">
      <Text component="label" htmlFor={id} fw={500} size="sm">
        {label.visible}{label.context === null ? null : <VisuallyHidden>{label.context}</VisuallyHidden>}</Text>
      <Group gap={2} wrap="nowrap">
        <FieldOrdering {...props} />
        <Button size="compact-sm" variant="subtle" leftSection={hideIcon} onClick={() => {
          candidateJourney.hideResumeField({ fieldId: reference.key }); announce(localization.translate('resumeReview.hiddenNotice'))
        }}>{localization.translate('tailoredResume.hideField')}<VisuallyHidden> {name}</VisuallyHidden></Button>
      </Group>
    </Group>
    <Textarea id={id} autosize minRows={1} value={text} onChange={(event) => { props.onChange(event.currentTarget.value) }} />
    {unsupported ? <Group gap="xs" justify="space-between">
      <Text c="danger.8" size="sm" role="alert">{localization.translate('tailoredResume.unsupportedField')}</Text>
      <Button size="compact-sm" disabled={text !== reference.field.text}
        onClick={() => { candidateJourney.attestResumeField({ fieldId: reference.key }); announce(localization.translate('resumeReview.saved')) }}>
        {localization.translate('tailoredResume.attestField')}<VisuallyHidden> {name}</VisuallyHidden></Button>
    </Group> : null}
  </Stack>
}

function FieldOrdering({ announce, candidateJourney, localization, reference, resume }: FieldEditorProps) {
  const isMovable = reference.location.kind === 'value-proposition' || reference.location.kind === 'section'
    || (reference.location.kind === 'experience' && reference.location.fieldName === 'achievements')
    || (reference.location.kind === 'skill-group' && reference.location.fieldName === 'items')
  if (!isMovable) return null
  const name = localization.translate('tailoredResume.entryName').replace('{section}', localization.translate(`resumeReview.section.${sectionOf(reference)}`))
    .replace('{entry}', readEntryName({ reference, resume }))
  return <>{(['up', 'down'] as const).map((direction) => <MoveButton key={direction} {...{ direction, localization, name }}
    onClick={() => { candidateJourney.moveResumeField({ fieldId: reference.key, direction }); announce(localization.translate('resumeReview.ordered')) }} />)}</>
}

/** An arrow alone moves a field or a section; its accessible name and tooltip say what it moves and where. */
function MoveButton({ direction, disabled = false, localization, name, onClick }: Readonly<{
  direction: 'up' | 'down'; disabled?: boolean; localization: Localization; name: string; onClick: () => void
}>) {
  const moveLabel = readMoveLabel({ direction, localization, name })
  return <ActionIcon variant="subtle" aria-label={moveLabel} title={moveLabel} disabled={disabled} onClick={onClick}>
    {direction === 'up' ? <IconArrowUp aria-hidden size={16} /> : <IconArrowDown aria-hidden size={16} />}</ActionIcon>
}

function sectionOf({ location }: ResumeFieldReference): ResumeSectionName {
  if (location.kind === 'value-proposition') return 'value-proposition'
  if (location.kind === 'experience') return 'experiences'
  if (location.kind === 'skill-group') return 'skills'
  return location.section
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

/** Hidden Content, under the content it was hidden from; opened from the Page Budget status, it comes into view. */
function ContentRecovery({ focused, ...props }: EditorContext & Readonly<{ focused: boolean }>) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (!focused) return
    heading.current?.scrollIntoView({ block: 'start' })
    heading.current?.focus()
  }, [focused])
  const { view } = props.candidateJourney
  if (view.status !== 'candidate-session-open' || view.resumeReview === null) return null
  const { recovery } = view.resumeReview
  const empty = recovery.hiddenFields.length === 0 && recovery.hiddenExperiences.length === 0 && recovery.omittedFacts.length === 0
  return <Stack component="section" aria-labelledby="resume-editor-hidden">
    <Title id="resume-editor-hidden" ref={heading} tabIndex={-1} order={3}>{props.localization.translate('resumeReview.recovery')}</Title>
    <HiddenExperienceRecovery {...props} recovery={recovery} />
    <HiddenFieldRecovery {...props} recovery={recovery} />
    {recovery.omittedFacts.length === 0 ? null : <OmittedFactRecovery {...props} recovery={recovery} />}
    {empty ? <Text>{props.localization.translate('resumeReview.emptyRecovery')}</Text> : null}
  </Stack>
}

function HiddenExperienceRecovery({ announce, candidateJourney, localization, recovery }: RecoveryProps) {
  return <>{recovery.hiddenExperiences.map((experience) => {
    const name = [experience.role?.text, experience.organization?.text].filter(Boolean).join(' · ')
    return <Group key={experience.id} justify="space-between" wrap="nowrap"><Text>{name}</Text>
      <Button variant="subtle" leftSection={restoreIcon} onClick={() => {
        candidateJourney.restoreResumeEntry({ experienceId: experience.id }); announce(localization.translate('resumeReview.restored'))
      }}>{localization.translate('resumeReview.restoreEntry')}<VisuallyHidden> {name}</VisuallyHidden></Button></Group>
  })}</>
}

function HiddenFieldRecovery({ announce, candidateJourney, localization, recovery }: RecoveryProps) {
  return <>{recovery.hiddenFields.map(({ field, origin }) => <Group key={field.id} justify="space-between" wrap="nowrap"><Stack gap={0}>
    <Text>{field.text}</Text>{origin === 'overflow-reduction' ? <Text size="sm" c="dimmed">{localization.translate('resumeReview.hiddenByReduction')}</Text> : null}</Stack>
    <Button variant="subtle" leftSection={restoreIcon} onClick={() => { candidateJourney.restoreResumeField({ fieldId: field.id }); announce(localization.translate('resumeReview.restored')) }}>
      {localization.translate('tailoredResume.restoreField')}<VisuallyHidden> {excerpt(field.text)}</VisuallyHidden></Button></Group>)}</>
}

function OmittedFactRecovery({ announce, candidateJourney, localization, recovery }: RecoveryProps) {
  return <><Title order={4}>{localization.translate('resumeReview.omitted')}</Title>
    {recovery.omittedFacts.map((fact) => <Group key={fact.id} justify="space-between" wrap="nowrap"><Text>{fact.value}</Text>
      <Button variant="subtle" leftSection={restoreIcon} onClick={() => { candidateJourney.restoreSourceFact({ factId: fact.id }); announce(localization.translate('resumeReview.restored')) }}>
        {localization.translate('resumeReview.restore')}</Button></Group>)}</>
}

function SectionOrder({ announce, candidateJourney, localization, resume }: EditorContext) {
  const sections = readEditorSections({ resume })
  const move = ({ index, direction }: Readonly<{ index: number; direction: 'up' | 'down' }>) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const selected = sections[index]
    const target = sections[targetIndex]
    if (selected === undefined || target === undefined) return
    const sectionOrder = sections.map((section, sectionIndex) => sectionIndex === index ? target : sectionIndex === targetIndex ? selected : section)
    candidateJourney.reorderResumeSections({ sectionOrder }); announce(localization.translate('resumeReview.ordered'))
  }
  return <Stack><Title order={3}>{localization.translate('resumeReview.order')}</Title>
    {sections.map((section, index) => <Group key={section} justify="space-between">
      <Text>{localization.translate(`resumeReview.section.${section}`)}</Text><Group gap={2} wrap="nowrap">{(['up', 'down'] as const).map((direction) =>
        <MoveButton key={direction} {...{ direction, localization }} name={localization.translate(`resumeReview.section.${section}`)}
          disabled={direction === 'up' ? index === 0 : index === sections.length - 1} onClick={() => { move({ index, direction }) }} />)}</Group>
    </Group>)}</Stack>
}

// Hiding and restoring read as one pair everywhere: an eye shut on what leaves the resume, open on what comes back.
const hideIcon = <IconEyeOff aria-hidden size={16} />
const restoreIcon = <IconEye aria-hidden size={16} />
