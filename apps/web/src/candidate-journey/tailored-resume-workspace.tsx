import { Badge, Button, Group, Paper, Stack, Text, Textarea, TextInput, Title } from '@mantine/core'
import { useState } from 'react'

import type { CandidateFact } from '@resume-tailoring/application/source-intake'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import {
  hasValidTailoredResumeExport,
  hasValidTailoredResumeProvenance,
  renderTailoredResumeDocument,
} from './tailored-resume-document'
import {
  isSupportedResumeFieldText,
  moveResumeField,
  readResumeFields,
  removeResumeField,
  restoreResumeField,
  updateResumeField,
} from './tailored-resume-editing'
import type { HiddenResumeField, ResumeFieldLocation } from './tailored-resume-editing'

type LocalContactDetail = TailoredResume['contactDetails'][number]

type CandidateJourneyController = ReturnType<typeof useCandidateJourney>

export function TailoredResumeWorkspace({ candidateJourney, localization }: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open'
    || view.session.phase !== 'tailored-resume-preparation'
    || view.session.tailoredResume === null) return null
  const candidateFacts = view.session.sourceIntake?.candidateFacts ?? []
  if (!hasValidTailoredResumeProvenance({
    candidateFacts,
    tailoredResume: view.session.tailoredResume,
  })) {
    return <Paper aria-labelledby="tailored-resume-title" component="section"
      className="candidate-journey-workspace" p={{ base: 'md', sm: 'xl' }} withBorder>
      <Title id="tailored-resume-title" order={2} size="h3">
        {localization.translate('tailoredResume.fallbackRole')}
      </Title>
      <Text c="danger.8" mt="md" role="alert">
        {localization.translate('candidateJourney.provenancePending')}
      </Text>
    </Paper>
  }
  return <EditableTailoredResume {...{ localization, tailoredResume: view.session.tailoredResume,
    candidateFacts }} />
}

function EditableTailoredResume({ candidateFacts, localization, tailoredResume }: Readonly<{
  candidateFacts: readonly CandidateFact[]
  localization: Localization
  tailoredResume: TailoredResume
}>) {
  const [resume, setResume] = useState(tailoredResume)
  const [facts, setFacts] = useState(candidateFacts)
  const [hiddenFields, setHiddenFields] = useState<readonly HiddenResumeField[]>([])
  const [unsupportedKeys, setUnsupportedKeys] = useState<readonly string[]>([])
  const [identity, setIdentity] = useState(tailoredResume.identity)
  const [contactDetails, setContactDetails] = useState(tailoredResume.contactDetails)
  const unsupportedFieldCount = unsupportedKeys.length
  const updateField = (location: ResumeFieldLocation, field: TailoredResume['valueProposition'][number]) => {
    setResume((currentResume) => updateResumeField({ field, location, resume: currentResume }))
  }
  const changeField = (reference: ReturnType<typeof readResumeFields>[number], text: string) => {
    const field = { ...reference.field, text }
    updateField(reference.location, field)
    setUnsupportedKeys((keys) => isSupportedResumeFieldText({ candidateFacts: facts,
      field: reference.field, text }) ? keys.filter((key) => key !== reference.key)
      : keys.includes(reference.key) ? keys : [...keys, reference.key])
  }
  const attestField = (reference: ReturnType<typeof readResumeFields>[number]) => {
    const factId = `source-fact-tailored-${String(facts.length + 1)}` as CandidateFact['id']
    const fact = { id: factId, path: `tailored-resume.${reference.key}`, status: 'attested', value: reference.field.text } as const
    setFacts((currentFacts) => [...currentFacts, fact])
    updateField(reference.location, { ...reference.field, factIds: [factId] })
    setUnsupportedKeys((keys) => keys.filter((key) => key !== reference.key))
  }
  const hideField = (reference: ReturnType<typeof readResumeFields>[number]) => {
    setHiddenFields((fields) => [...fields, { field: reference.field, location: reference.location }])
    setResume((currentResume) => removeResumeField({ location: reference.location, resume: currentResume }))
    setUnsupportedKeys((keys) => keys.filter((key) => key !== reference.key))
  }
  const restoreField = (hiddenField: HiddenResumeField) => {
    setResume((currentResume) => restoreResumeField({ hiddenField, resume: currentResume }))
    setHiddenFields((fields) => fields.filter((field) => field !== hiddenField))
  }
  const moveField = (reference: ReturnType<typeof readResumeFields>[number], direction: 'up' | 'down') => {
    setResume((currentResume) => moveResumeField({ direction, location: reference.location, resume: currentResume }))
  }
  const editedResume = { ...resume, identity, contactDetails }
  const exportIsValid = unsupportedFieldCount === 0 && hasValidTailoredResumeExport({
    candidateFacts: facts, tailoredResume: editedResume,
  })
  return <Paper aria-labelledby="tailored-resume-title" component="section"
    className="candidate-journey-workspace" p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg"><TailoredResumeHeader {...{ localization, tailoredResume: editedResume }} />
      <ContactEditor {...{ contactDetails, identity, localization, setContactDetails, setIdentity }} />
      <ResumeFieldsEditor {...{ candidateFacts: facts, localization, resume, unsupportedKeys,
        changeField, attestField, hideField, moveField }} />
      <HiddenFields {...{ hiddenFields, localization, restoreField }} />
      {unsupportedFieldCount === 0 ? null : <Text c="danger.8" role="alert">
        {localization.translate('tailoredResume.unsupportedFields')}
      </Text>}
      <TailoredResumePreview source={{ candidateFacts: facts, tailoredResume: editedResume }}
        canExportOverride={exportIsValid} localization={localization} />
    </Stack>
  </Paper>
}

function ContactEditor({ contactDetails, identity, localization, setContactDetails, setIdentity }: Readonly<{
  contactDetails: readonly LocalContactDetail[]
  identity: LocalContactDetail | null
  localization: Localization
  setContactDetails: (details: readonly LocalContactDetail[]) => void
  setIdentity: (identity: LocalContactDetail | null) => void
}>) {
  const email = contactDetails.find(({ kind }) => kind === 'email')?.value ?? ''
  const phone = contactDetails.find(({ kind }) => kind === 'phone')?.value ?? ''
  const updateContact = (kind: LocalContactDetail['kind'], value: string) => {
    if (kind === 'personal-information') { setIdentity(value.trim().length === 0 ? null : { kind, value }); return }
    const remaining = contactDetails.filter((detail) => detail.kind !== kind)
    setContactDetails(value.trim().length === 0 ? remaining : [...remaining, { kind, value }])
  }
  return <section aria-label={localization.translate('tailoredResume.contactDetails')}>
    <Title order={3}>{localization.translate('tailoredResume.contactDetails')}</Title>
    <Stack gap="xs"><TextInput label={localization.translate('tailoredResume.name')}
      value={identity?.value ?? ''} onChange={(event) => { updateContact('personal-information', event.currentTarget.value) }} />
      <TextInput label={localization.translate('tailoredResume.email')} value={email}
        onChange={(event) => { updateContact('email', event.currentTarget.value) }} />
      <TextInput label={localization.translate('tailoredResume.phone')} value={phone}
        onChange={(event) => { updateContact('phone', event.currentTarget.value) }} /></Stack>
  </section>
}

function ResumeFieldsEditor({ attestField, candidateFacts, changeField, hideField, localization, moveField,
  resume, unsupportedKeys }: Readonly<{
  attestField: (reference: ReturnType<typeof readResumeFields>[number]) => void
  candidateFacts: readonly CandidateFact[]
  changeField: (reference: ReturnType<typeof readResumeFields>[number], text: string) => void
  hideField: (reference: ReturnType<typeof readResumeFields>[number]) => void
  localization: Localization
  moveField: (reference: ReturnType<typeof readResumeFields>[number], direction: 'up' | 'down') => void
  resume: TailoredResume
  unsupportedKeys: readonly string[]
}>) {
  const references = readResumeFields({ resume })
  return <section aria-label={localization.translate('tailoredResume.editFields')}>
    <Title order={3}>{localization.translate('tailoredResume.editFields')}</Title>
    <Stack gap="md">{references.map((reference) => <EditableField key={reference.key}
      {...{ attestField, candidateFacts, changeField, hideField, localization, moveField, reference,
        unsupported: unsupportedKeys.includes(reference.key) }} />)}</Stack>
  </section>
}

function EditableField({ attestField, candidateFacts, changeField, hideField, localization, moveField, reference,
  unsupported: initialUnsupported }: Readonly<{
  attestField: (reference: ReturnType<typeof readResumeFields>[number]) => void
  candidateFacts: readonly CandidateFact[]
  changeField: (reference: ReturnType<typeof readResumeFields>[number], text: string) => void
  hideField: (reference: ReturnType<typeof readResumeFields>[number]) => void
  localization: Localization
  moveField: (reference: ReturnType<typeof readResumeFields>[number], direction: 'up' | 'down') => void
  reference: ReturnType<typeof readResumeFields>[number]
  unsupported: boolean
}>) {
  const [text, setText] = useState(reference.field.text)
  const [unsupported, setUnsupported] = useState(initialUnsupported)
  const onChange = (value: string) => { setText(value); setUnsupported(!isSupportedResumeFieldText({
    candidateFacts, field: reference.field, text: value,
  })) }
  return <Paper p="sm" withBorder>
    <Textarea label={localization.translate('tailoredResume.fieldLabel')} value={text}
      onChange={(event) => { onChange(event.currentTarget.value) }} autosize />
    {unsupported ? <Text c="danger.8" role="alert">{localization.translate('tailoredResume.unsupportedField')}</Text> : null}
    <Group mt="xs"><Button size="compact-sm" onClick={() => { const isUnsupported = !isSupportedResumeFieldText({
      candidateFacts, field: reference.field, text,
    }); changeField(reference, text); setUnsupported(isUnsupported) }}>
      {localization.translate('tailoredResume.saveField')}</Button>
      {unsupported ? <Button size="compact-sm" onClick={() => { changeField(reference, text); attestField({
        ...reference, field: { ...reference.field, text },
      }); setUnsupported(false) }}>{localization.translate('tailoredResume.attestField')}</Button> : null}
      <Button size="compact-sm" variant="subtle" onClick={() => { hideField(reference) }}>
        {localization.translate('tailoredResume.hideField')}</Button>
      <Button size="compact-sm" variant="subtle" onClick={() => { moveField(reference, 'up') }}>
        {localization.translate('tailoredResume.moveUp')}</Button>
      <Button size="compact-sm" variant="subtle" onClick={() => { moveField(reference, 'down') }}>
        {localization.translate('tailoredResume.moveDown')}</Button>
    </Group>
  </Paper>
}

function HiddenFields({ hiddenFields, localization, restoreField }: Readonly<{
  hiddenFields: readonly HiddenResumeField[]
  localization: Localization
  restoreField: (field: HiddenResumeField) => void
}>) {
  return hiddenFields.length === 0 ? null : <section aria-label={localization.translate('tailoredResume.hiddenFields')}>
    <Title order={4}>{localization.translate('tailoredResume.hiddenFields')}</Title>
    {hiddenFields.map((hiddenField, fieldIndex) => <Group key={String(fieldIndex)}>
      <Text>{hiddenField.field.text}</Text><Button size="compact-sm" variant="subtle"
        onClick={() => { restoreField(hiddenField) }}>{localization.translate('tailoredResume.restoreField')}</Button>
    </Group>)}
  </section>
}

function TailoredResumePreview({ canExportOverride = true, localization, source }: Readonly<{
  canExportOverride?: boolean
  localization: Localization
  source: Readonly<{
    candidateFacts: readonly Readonly<{ id: `source-fact-${string}`; path: string; status: 'attested' | 'excluded-critical-ambiguity'; value: string }>[]
    tailoredResume: TailoredResume
  }>
}>) {
  const canExport = canExportOverride && hasValidTailoredResumeExport(source)
  const html = renderTailoredResumeDocument({ tailoredResume: source.tailoredResume })
  return <section aria-labelledby="tailored-resume-preview-title">
    <Title id="tailored-resume-preview-title" order={3}>Preview and export</Title>
    <Text c="dimmed" mt="xs">Preview the exact semantic document used for your PDF.</Text>
    <iframe className="tailored-resume-preview-frame" sandbox="" srcDoc={html}
      title="Tailored Resume preview" />
    {canExport ? <Button mt="md" onClick={() => { printTailoredResume({ html }) }}>
      Download PDF
    </Button> : <Text c="danger.8" mt="md" role="alert">
      {localization.translate('tailoredResume.exportBlocked')}
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
  </Badge><Title id="tailored-resume-title" mt="xs" order={2} size="h3">
    {tailoredResume.identity?.value ?? localization.translate('tailoredResume.fallbackRole')}
  </Title><Text c="dimmed" mt="xs">
    {tailoredResume.targetRole?.value ?? localization.translate('tailoredResume.fallbackRole')}
  </Text>{tailoredResume.contactDetails.length === 0 ? null : <Text c="dimmed" mt="xs">
    {tailoredResume.contactDetails.map(({ value }) => value).join(' · ')}
  </Text>}</div>
}
