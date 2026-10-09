import {
  Button,
  FileInput,
  Group,
  List,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { useId, useState } from 'react'

import type { SourceIntake } from '@resume-tailoring/application/source-intake'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { FailureExplanation, RecoveryAction } from './failure-recovery'

type CandidateJourneyController = ReturnType<typeof useCandidateJourney>
type SourceMethod = 'paste' | 'upload'

export function SourceIntakeWorkspace({
  candidateJourney,
  localization,
}: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
}>) {
  const sourceForm = useSourceDocumentForm({ candidateJourney })
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const { sourceIntake } = view.preparationInputs
  return <Paper aria-busy={view.operation === 'processing-source-document' || view.operation === 'resolving-critical-ambiguity'}
    aria-labelledby="source-intake-title" component="section" className="candidate-journey-workspace"
    p={{ base: 'md', sm: 'xl' }} shadow="xs" withBorder>
    <Stack gap="lg">
      <SourceIntakeHeader localization={localization} />
      {sourceIntake === null
        ? <SourceDocumentForm {...{ candidateJourney, localization, sourceForm }} />
        : <SourceIntakeResult {...{
            candidateJourney, localization, sourceIntake,
          }} />}
      <SourceIntakeFailure {...{
        failure: sourceForm.localFailure ?? view.sourceIntakeFailure, localization,
        explained: sourceForm.localFailure === null ? view.sourceIntakeExplainedFailure : null,
        busy: view.operation !== null,
        onRetry: () => { void sourceForm.submitSourceDocument() },
      }} />
    </Stack>
  </Paper>
}

function useSourceDocumentForm({ candidateJourney }: Readonly<{
  candidateJourney: CandidateJourneyController
}>) {
  const [method, setMethod] = useState<SourceMethod>('paste')
  const [professionalText, setProfessionalText] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [localFailure, setLocalFailure] = useState<'empty-document' | null>(null)
  const submitSourceDocument = async () => {
    const document = await readSelectedSourceDocument({ method, professionalText, sourceFile })
    if (document === null) {
      setLocalFailure('empty-document')
      return
    }
    setLocalFailure(null)
    candidateJourney.submitSourceDocument(document)
  }
  return {
    localFailure, method, professionalText, setMethod, setProfessionalText, setSourceFile,
    sourceFile, submitSourceDocument,
  }
}

type SourceDocumentFormController = ReturnType<typeof useSourceDocumentForm>

function SourceIntakeHeader({ localization }: Readonly<{ localization: Localization }>) {
  return <div>
    <Title id="source-intake-title" order={2} size="h3">{localization.translate('sourceIntake.title')}</Title>
    <Text c="dimmed" mt="xs">{localization.translate('sourceIntake.description')}</Text>
  </div>
}

function SourceDocumentForm({ candidateJourney, localization, sourceForm }: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
  sourceForm: SourceDocumentFormController
}>) {
  if (candidateJourney.view.status !== 'candidate-session-open') return null
  return <>
    <SourceMethodPicker {...{ localization, sourceForm }} />
    <SourceMethodInput {...{ localization, sourceForm }} />
    <Button disabled={candidateJourney.view.processingConsentStatus !== 'granted'}
      loading={candidateJourney.view.operation === 'processing-source-document'}
      onClick={() => { void sourceForm.submitSourceDocument() }}>
      {localization.translate('sourceIntake.submit')}
    </Button>
  </>
}

function SourceMethodPicker({ localization, sourceForm }: Readonly<{
  localization: Localization
  sourceForm: SourceDocumentFormController
}>) {
  return <SegmentedControl data={[
    { label: localization.translate('sourceIntake.pasteMethod'), value: 'paste' },
    { label: localization.translate('sourceIntake.uploadMethod'), value: 'upload' },
  ]} onChange={(value) => { sourceForm.setMethod(value === 'upload' ? 'upload' : 'paste') }}
  value={sourceForm.method} />
}

function SourceMethodInput({ localization, sourceForm }: Readonly<{
  localization: Localization
  sourceForm: SourceDocumentFormController
}>) {
  return sourceForm.method === 'paste'
    ? <Textarea id={professionalTextId} label={localization.translate('sourceIntake.professionalText')}
        minRows={8} onChange={(event) => {
          sourceForm.setProfessionalText(event.currentTarget.value)
        }} placeholder={localization.translate('sourceIntake.professionalTextPlaceholder')}
        value={sourceForm.professionalText} />
    : <FileInput accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        label={localization.translate('sourceIntake.sourceFile')}
        onChange={sourceForm.setSourceFile}
        placeholder={localization.translate('sourceIntake.sourceFileHint')}
        value={sourceForm.sourceFile} />
}

async function readSelectedSourceDocument({
  method,
  professionalText,
  sourceFile,
}: Readonly<{
  method: SourceMethod
  professionalText: string
  sourceFile: File | null
}>) {
  if (method === 'paste') {
    return professionalText.trim().length === 0 ? null : {
      bytes: new TextEncoder().encode(professionalText),
      mediaType: 'text/plain',
      name: 'pasted-professional-text.txt',
    }
  }
  if (sourceFile === null) return null
  try {
    return {
      bytes: new Uint8Array(await sourceFile.arrayBuffer()),
      mediaType: sourceFile.type,
      name: sourceFile.name,
    }
  } catch {
    return null
  }
}

function SourceIntakeResult({
  candidateJourney,
  localization,
  sourceIntake,
}: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
  sourceIntake: SourceIntake
}>) {
  const [showDetails, setShowDetails] = useState(false)
  const detailsId = useId()
  return <Stack gap="md">
    {sourceIntake.criticalAmbiguities.length === 0
      ? <Text c="forest.8" fw={700} role="status">
          {localization.translate('sourceIntake.ready')}
        </Text>
      : <CriticalAmbiguityQuestions {...{ candidateJourney, localization, sourceIntake }} />}
    <Button aria-controls={detailsId} aria-expanded={showDetails}
      onClick={() => { setShowDetails((currentValue) => !currentValue) }} variant="default">
      {localization.translate(showDetails ? 'sourceIntake.hideProfile' : 'sourceIntake.inspectProfile')}
    </Button>
    {showDetails ? <DetailedSourceProfile id={detailsId} {...{ localization, sourceIntake }} /> : null}
  </Stack>
}

export function CriticalAmbiguityQuestions({
  candidateJourney,
  localization,
  sourceIntake,
}: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
  sourceIntake: SourceIntake
}>) {
  return <Stack aria-label={localization.translate('sourceIntake.ambiguities')} role="region">
    <Title order={3} size="h4">{localization.translate('sourceIntake.ambiguities')}</Title>
    {sourceIntake.criticalAmbiguities.map((ambiguity) => (
      <CriticalAmbiguityQuestion {...{ ambiguity, candidateJourney, localization }}
        key={ambiguity.id} />
    ))}
  </Stack>
}

function CriticalAmbiguityQuestion({
  ambiguity,
  candidateJourney,
  localization,
}: Readonly<{
  ambiguity: SourceIntake['criticalAmbiguities'][number]
  candidateJourney: CandidateJourneyController
  localization: Localization
}>) {
  const [answer, setAnswer] = useState('')
  return <Paper p="md" withBorder>
    <Stack>
      <Text fw={700}>{ambiguity.question}</Text>
      <TextInput aria-label={ambiguity.question} onChange={(event) => {
        setAnswer(event.currentTarget.value)
      }} value={answer} />
      <Button disabled={answer.trim().length === 0}
        loading={candidateJourney.view.status === 'candidate-session-open'
          && candidateJourney.view.operation === 'resolving-critical-ambiguity'}
        onClick={() => { candidateJourney.resolveCriticalAmbiguity({
          ambiguityId: ambiguity.id,
          answer,
        }) }}>
        {localization.translate('sourceIntake.answerAmbiguity')}
      </Button>
    </Stack>
  </Paper>
}

function DetailedSourceProfile({
  id,
  localization,
  sourceIntake,
}: Readonly<{ id: string; localization: Localization; sourceIntake: SourceIntake }>) {
  const profile = sourceIntake.sourceProfile
  return <Stack aria-label={localization.translate('sourceIntake.detailedProfile')} id={id} role="region">
    <List>{sourceIntake.candidateFacts.map((fact) => <List.Item key={fact.id}>
      <Text>{fact.value}</Text><Text size="xs" c="dimmed">{fact.path}</Text>
    </List.Item>)}</List>
    <ProfileSection title={localization.translate('sourceIntake.experiences')}
      values={profile.experiences.map((experience) => (
        formatProfileSummary({ values: [experience.role, experience.organization] })
      ))} />
    <ProfileSection title={localization.translate('sourceIntake.projects')}
      values={profile.projects.map((project) => project.name)} />
    <ProfileSection title={localization.translate('sourceIntake.skills')}
      values={profile.skills.map((skill) => skill.name)} />
    <ProfileSection title={localization.translate('sourceIntake.education')}
      values={profile.education.map((education) => (
        formatProfileSummary({ values: [education.qualification, education.institution, education.dates ?? null] })
      ))} />
    <ProfileSection title={localization.translate('sourceIntake.languages')}
      values={profile.languages.map((language) => language.name)} />
    <ProfileSection title={localization.translate('sourceIntake.certifications')}
      values={profile.certifications.map((certification) => certification.name)} />
  </Stack>
}

function formatProfileSummary({ values }: Readonly<{
  values: readonly (string | null)[]
}>) {
  return values.filter((value): value is string => value !== null).join(' – ')
}

function ProfileSection({ title, values }: Readonly<{
  title: string
  values: readonly string[]
}>) {
  return <div><Text fw={700}>{title}</Text>
    {values.length === 0 ? <Text c="dimmed">–</Text> : <List>{values.map((value, valueIndex) => (
      <List.Item key={`${String(valueIndex)}:${value}`}>{value}</List.Item>
    ))}</List>}
  </div>
}

type OpenView = Extract<CandidateJourneyController['view'], Readonly<{ status: 'candidate-session-open' }>>

/** A failed model call explains its Failure Cause and offers its Recovery; any other failure says what to fix. */
export function SourceIntakeFailure({
  busy,
  explained,
  failure,
  localization,
  onRetry,
}: Readonly<{
  busy: boolean
  explained: OpenView['sourceIntakeExplainedFailure']
  failure: OpenView['sourceIntakeFailure']
  localization: Localization
  onRetry: () => void
}>) {
  if (failure === null) return null
  return <Stack c="danger.8" gap="xs" role="alert">
    <Text>{localization.translate(sourceIntakeFailureKeys[failure])}</Text>
    {explained === null ? null : <>
      <FailureExplanation cause={explained.cause} localization={localization} />
      <Group><RecoveryAction {...explained} {...{ busy, localization, onRetry }} onShortenInput={showProfessionalText} /></Group>
    </>}
  </Stack>
}

const professionalTextId = 'source-intake-professional-text'

function showProfessionalText() {
  document.getElementById(professionalTextId)?.focus()
}

export const sourceIntakeFailureKeys = {
  'ambiguity-unavailable': 'sourceIntake.failure.ambiguity',
  'candidate-session-storage-unavailable': 'sourceIntake.failure.storage',
  'encrypted-document': 'sourceIntake.failure.encrypted',
  'empty-document': 'sourceIntake.failure.empty',
  'invalid-document': 'sourceIntake.failure.invalid',
  'oversized-document': 'sourceIntake.failure.oversized',
  'processing-consent-required': 'sourceIntake.failure.consent',
  'scanned-document': 'sourceIntake.failure.scanned',
  'source-profile-extraction-unavailable': 'sourceIntake.failure.extraction',
  'unreadable-document': 'sourceIntake.failure.unreadable',
  'unsupported-document': 'sourceIntake.failure.unsupported',
} as const
