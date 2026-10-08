import { Alert, Button, CloseButton, Divider, Fieldset, Group, Modal, Paper, Select, SimpleGrid, Stack, Text, Textarea, Title } from '@mantine/core'
import { Dropzone } from '@mantine/dropzone'
import { useMediaQuery } from '@mantine/hooks'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { inferTailoredResumeLocale } from '@resume-tailoring/application/tailored-resume'
import { readRecovery } from '@resume-tailoring/application/candidate-journey'
import type { CandidateSession, FailureCause, ResumePreparationFailure, StoredIntakeDocument } from '@resume-tailoring/application/candidate-journey'
import type { SourceDocument } from '@resume-tailoring/application/source-intake'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { CriticalAmbiguityQuestions, sourceIntakeFailureKeys } from './source-intake-workspace'
import { jobMatchFailureKeys } from './job-match-workspace'
import { ProcessingPolicyNotice, processingPolicyNoticeId } from './processing-policy-notice'
import { FailureExplanation, RecoveryAction } from './failure-recovery'

type IntakeProps = Readonly<{ candidateJourney: ReturnType<typeof useCandidateJourney>; localization: Localization }>
type OpenIntakeProps = IntakeProps & Readonly<{ session: CandidateSession }>
type DocumentChoice = Readonly<{ method: 'paste' | 'upload'; text: string; file: File | null }>
type DocumentKind = 'source' | 'posting'
type ResumePurpose = 'tailored' | 'normalized'
type IntakeState = Readonly<{
  sourceChoice: DocumentChoice; postingChoice: DocumentChoice; locale: string | null;
  missingDocuments: readonly DocumentKind[]; confirmation: boolean; purpose: ResumePurpose
}>
type IntakeControls = ReturnType<typeof useIntakeForm>
type IntakeActionsInput = OpenIntakeProps & Readonly<{
  state: IntakeState; setState: Dispatch<SetStateAction<IntakeState>>; onStarted: () => void
}>

export function CombinedIntakeWorkspace(props: IntakeProps) {
  const { view } = props.candidateJourney
  if (view.status !== 'candidate-session-open') return null
  return <CombinedIntakeForm {...props} session={view.session} key={view.session.sessionId} />
}

function CombinedIntakeForm(props: OpenIntakeProps) {
  const controls = useIntakeForm(props)
  const { candidateJourney, localization, session } = props
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  return <Paper component="section" aria-labelledby="combined-intake-title" p={{ base: 'md', sm: 'xl' }} withBorder><Stack>
    <Title id="combined-intake-title" order={2}>{localization.translate('combinedIntake.title')}</Title>
    <Text c="dimmed">{localization.translate('combinedIntake.description')}</Text>
    <Fieldset disabled={view.operation !== null} m={0} p={0} variant="unstyled">
      <Stack><IntakeFields {...props} busy={view.operation !== null} controls={controls} /></Stack>
    </Fieldset>
    {/* A failed preparation offers its own Recovery below, so the form shows one action at a time. */}
    {readFailedPreparation(session)?.recoverable === true ? null
      : <Button aria-describedby={processingPolicyNoticeId} disabled={view.operation !== null} loading={view.operation !== null}
        onClick={() => { controls.requestGeneration({ purpose: 'tailored' }) }} size="lg">
        {localization.translate(session.tailoredResume === null ? 'combinedIntake.generate' : 'combinedIntake.regenerate')}</Button>}
    <ProcessingPolicyNotice {...{ candidateJourney, localization }} />
    <PreparationFeedback {...{ candidateJourney, localization }}
      onRetry={() => { controls.requestGeneration({ purpose: session.preparation?.purpose ?? 'tailored' }) }}
      onNormalized={() => { controls.requestGeneration({ purpose: 'normalized' }) }} />
    <RegenerationConfirmation {...{ controls, localization }} />
  </Stack></Paper>
}

function useIntakeForm(props: OpenIntakeProps) {
  const navigate = useNavigate()
  const [state, setState] = useState<IntakeState>(() => ({ sourceChoice: initialSource(props.candidateJourney),
    postingChoice: initialPosting(props.candidateJourney), locale: props.session.preparation?.locale ?? 'automatic',
    missingDocuments: [], confirmation: false, purpose: 'tailored' }))
  const extractedSource = props.session.preparation === undefined ? props.session.sourceIntake : props.session.preparation.sourceIntake
  useEffect(() => {
    if (extractedSource !== null) setState((current) => ({ ...current, sourceChoice: { method: 'paste', text: '', file: null } }))
  }, [extractedSource])
  const updateInputs = (change: Partial<Pick<IntakeState, 'sourceChoice' | 'postingChoice' | 'locale'>>) => {
    setState((current) => ({ ...current, ...change, missingDocuments: [] }))
    props.candidateJourney.invalidateResumeInputs()
  }
  return { state, updateInputs, ...createIntakeActions({ ...props, state, setState,
    onStarted: () => { void navigate({ to: '/resume' }) } }) }
}

function createIntakeActions(input: IntakeActionsInput) {
  const generate = async ({ purpose }: Readonly<{ purpose: ResumePurpose }>) => {
    input.setState((current) => ({ ...current, confirmation: false }))
    const request = await readIntakeRequest({ ...input, purpose })
    if (!request.ok) {
      input.setState((current) => ({ ...current, missingDocuments: request.missingDocuments }))
      const [firstMissing] = request.missingDocuments
      if (firstMissing !== undefined) document.getElementById(intakeTextIds[firstMissing])?.focus()
      return
    }
    input.setState((current) => ({ ...current, missingDocuments: [] }))
    const { view } = input.candidateJourney
    const consentRequired = view.status === 'candidate-session-open' && view.processingConsentStatus !== 'granted'
    input.candidateJourney.startTailoredResumePreparation(consentRequired
      ? { ...request.value, grantProcessingConsent: true } : request.value)
    input.onStarted()
  }
  const requestGeneration = ({ purpose }: Readonly<{ purpose: ResumePurpose }>) => {
    if (input.session.tailoredResume === null) { void generate({ purpose }); return }
    input.setState((current) => ({ ...current, purpose, confirmation: true }))
  }
  return { requestGeneration, confirmGeneration: () => { void generate({ purpose: input.state.purpose }) },
    cancelGeneration: () => { input.setState((current) => ({ ...current, confirmation: false })) } }
}

async function readIntakeRequest({ state, session, purpose }: Readonly<{
  state: IntakeState; session: CandidateSession; purpose: ResumePurpose
}>) {
  const [sourceDocument, jobPosting] = await Promise.all([
    selectedDocument({ choice: state.sourceChoice }), selectedDocument({ choice: state.postingChoice }),
  ])
  const source = session.preparation?.sourceIntake ?? session.sourceIntake
  const missingDocuments = [...(sourceDocument === null && source === null ? ['source' as const] : []),
    ...(jobPosting === null ? ['posting' as const] : [])]
  if (jobPosting === null || missingDocuments.length > 0) return { ok: false, missingDocuments } as const
  return { ok: true, value: { ...(sourceDocument === null ? {} : { sourceDocument }), jobPosting,
    locale: state.locale === 'en' || state.locale === 'fr' ? state.locale : null, purpose } } as const
}

function IntakeFields({ session, localization, controls, busy }: OpenIntakeProps & Readonly<{ controls: IntakeControls; busy: boolean }>) {
  const { state, updateInputs } = controls
  const hasSource = (session.preparation?.sourceIntake ?? session.sourceIntake) !== null
  return <>
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <SourceDocumentCard {...{ busy, hasSource, localization }} choice={state.sourceChoice}
        missing={state.missingDocuments.includes('source')} onChange={(sourceChoice) => { updateInputs({ sourceChoice }) }} />
      <DocumentCard {...{ busy, localization }} choice={state.postingChoice} kind="posting"
        missing={state.missingDocuments.includes('posting')}
        onChange={(postingChoice) => { updateInputs({ postingChoice }) }} />
    </SimpleGrid>
    <Select label={localization.translate('tailoredResume.language')} maw={{ sm: 320 }} value={state.locale}
      onChange={(locale) => { updateInputs({ locale }) }} data={[
        { value: 'automatic', label: proposedLanguage({ postingChoice: state.postingChoice, localization }) },
        { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' },
      ]} />
  </>
}

type DocumentCardProps = Readonly<{
  busy: boolean; choice: DocumentChoice; localization: Localization; missing: boolean; onChange: (choice: DocumentChoice) => void
}>

function SourceDocumentCard({ hasSource, ...props }: Omit<DocumentCardProps, 'kind'> & Readonly<{ hasSource: boolean }>) {
  const [replacing, setReplacing] = useState(false)
  useEffect(() => { setReplacing(false) }, [hasSource])
  const { localization } = props
  if (!hasSource || replacing) return <DocumentCard {...props} kind="source" footer={hasSource
    ? <Button onClick={() => { setReplacing(false); props.onChange(emptyChoice) }} size="compact-sm" variant="subtle">
        {localization.translate('combinedIntake.keepSourceAction')}</Button> : null} />
  return <Paper className="intake-document" p={{ base: 0, sm: 'lg' }} radius="md" withBorder>
    <Stack gap="sm">
      <Text className="intake-document-title" fw={700} size="lg">{localization.translate('combinedIntake.sourceTitle')}</Text>
      <Text c="forest.8" fw={600} role="status">{localization.translate('combinedIntake.sourceReady')}</Text>
      <Group><Button onClick={() => { setReplacing(true) }} variant="default">
        {localization.translate('combinedIntake.replaceSourceAction')}</Button></Group>
    </Stack>
  </Paper>
}

const emptyChoice: DocumentChoice = { method: 'paste', text: '', file: null }

const intakeTextIds = { source: 'intake-source-text', posting: 'intake-posting-text' } as const satisfies Record<DocumentKind, string>

const acceptedMediaTypes = {
  source: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  posting: ['application/pdf', 'text/plain'],
} as const

function DocumentCard({ busy, choice, footer = null, kind, localization, missing, onChange }: DocumentCardProps & Readonly<{
  footer?: ReactNode; kind: DocumentKind
}>) {
  const [rejected, setRejected] = useState(false)
  // A finger cannot drag a file onto the page, so a touch screen only offers to choose one.
  const touch = useMediaQuery('(pointer: coarse)')
  const source = kind === 'source'
  const title = localization.translate(source ? 'combinedIntake.sourceTitle' : 'combinedIntake.postingTitle')
  return <Paper className="intake-document" component="fieldset" p={{ base: 0, sm: 'lg' }} radius="md" withBorder>
    <Stack gap="sm">
      <Text className="intake-document-title" component="legend" fw={700} size="lg">{title}</Text>
      {choice.method === 'upload' && choice.file !== null
        ? <SelectedFile file={choice.file} localization={localization} onRemove={() => { onChange(emptyChoice) }} />
        : <>
          <Dropzone accept={[...acceptedMediaTypes[kind]]} className="intake-dropzone" disabled={busy} maxFiles={1} multiple={false}
            aria-label={localization.translate(source ? 'sourceIntake.sourceFile' : 'jobMatch.fileLabel')}
            onDrop={([file]) => { setRejected(false); if (file !== undefined) onChange({ method: 'upload', text: '', file }) }}
            onReject={() => { setRejected(true) }}>
            <Stack align="center" gap={4} py="md">
              <Text fw={600} ta="center">{localization.translate(touch ? 'combinedIntake.chooseFile' : 'combinedIntake.dropFile')}</Text>
              <Text c="dimmed" size="sm">{localization.translate(source ? 'combinedIntake.sourceHint' : 'combinedIntake.postingHint')}</Text>
            </Stack>
          </Dropzone>
          {rejected ? <Text c="danger.8" role="alert" size="sm">{localization.translate('combinedIntake.rejectedFile')}</Text> : null}
          <Divider label={localization.translate('combinedIntake.orPaste')} labelPosition="center" />
          <Textarea aria-label={localization.translate(source ? 'sourceIntake.professionalText' : 'jobMatch.textLabel')}
            autosize error={missing ? localization.translate(source ? 'sourceIntake.failure.empty' : 'jobMatch.failure.empty') : undefined}
            id={intakeTextIds[kind]} maxRows={16} minRows={8}
            placeholder={localization.translate(source ? 'combinedIntake.sourcePlaceholder' : 'combinedIntake.postingPlaceholder')}
            value={choice.text} onChange={(event) => { onChange({ method: 'paste', text: event.currentTarget.value, file: null }) }} />
        </>}
      {footer}
    </Stack>
  </Paper>
}

function SelectedFile({ file, localization, onRemove }: Readonly<{ file: File; localization: Localization; onRemove: () => void }>) {
  return <Group className="intake-selected-file" justify="space-between" wrap="nowrap">
    <Stack gap={0} miw={0}>
      <Text fw={600} truncate="end">{file.name}</Text>
      <Text c="dimmed" size="xs">{formatFileSize({ bytes: file.size, locale: localization.locale })}</Text>
    </Stack>
    <CloseButton aria-label={`${localization.translate('combinedIntake.removeFile')} ${file.name}`} onClick={onRemove} />
  </Group>
}

function formatFileSize({ bytes, locale }: Readonly<{ bytes: number; locale: Localization['locale'] }>) {
  const [kilobyte, megabyte] = locale === 'fr' ? ['Ko', 'Mo'] : ['KB', 'MB']
  return bytes < 1024 * 1024 ? `${String(Math.max(1, Math.round(bytes / 1024)))} ${kilobyte}`
    : `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} ${megabyte}`
}

function RegenerationConfirmation({ controls, localization }: Readonly<{ controls: IntakeControls; localization: Localization }>) {
  return <Modal opened={controls.state.confirmation} onClose={controls.cancelGeneration}
    title={localization.translate('combinedIntake.replaceTitle')}>
    <Text>{localization.translate('combinedIntake.replaceWarning')}</Text><Group mt="md">
      <Button variant="default" onClick={controls.cancelGeneration}>{localization.translate('candidateJourney.deleteCancel')}</Button>
      <Button onClick={controls.confirmGeneration}>{localization.translate('combinedIntake.confirmRegenerate')}</Button>
    </Group>
  </Modal>
}

async function selectedDocument({ choice }: Readonly<{ choice: DocumentChoice }>): Promise<SourceDocument | null> {
  if (choice.method === 'paste') return choice.text.trim().length === 0 ? null
    : { bytes: new TextEncoder().encode(choice.text), mediaType: 'text/plain', name: 'pasted.txt' }
  if (choice.file === null) return null
  try { return { bytes: new Uint8Array(await choice.file.arrayBuffer()), mediaType: choice.file.type, name: choice.file.name } }
  catch { return null }
}

function initialSource(candidateJourney: IntakeProps['candidateJourney']): DocumentChoice {
  const { view } = candidateJourney
  const preparation = view.status === 'candidate-session-open' ? view.session.preparation : undefined
  return restoreChoice(preparation?.sourceIntake === null ? preparation.sourceDocument : undefined)
}

function initialPosting(candidateJourney: IntakeProps['candidateJourney']): DocumentChoice {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return restoreChoice()
  // A preparation stores the posting it was given; none means "Change job posting" cleared it.
  return restoreChoice(view.session.preparation?.jobPosting)
}

function restoreChoice(document?: StoredIntakeDocument | null): DocumentChoice {
  if (document === undefined || document === null) return { method: 'paste', text: '', file: null }
  try {
    const bytes = Uint8Array.from(atob(document.data), (character) => character.charCodeAt(0))
    return document.mediaType === 'text/plain'
      ? { method: 'paste', text: new TextDecoder().decode(bytes), file: null }
      : { method: 'upload', text: '', file: new File([bytes], document.name, { type: document.mediaType }) }
  } catch { return { method: 'paste', text: '', file: null } }
}

/** The outcome of a preparation without a usable result; `onBack` leads from `/resume` to the documents on `/`. */
export function PreparationFeedback({ candidateJourney, localization, onBack, onRetry, onNormalized }: IntakeProps & Readonly<{
  onBack?: () => void; onRetry: () => void; onNormalized: () => void
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const preparation = view.session.preparation
  const failedPreparation = readFailedPreparation(view.session)
  return <>
    {failedPreparation === null ? <InputFailure {...{ failure: preparation?.failure ?? null, localization }} />
      : <PreparationFailureAlert {...{ ...failedPreparation, localization, onBack, onRetry }} busy={view.operation !== null}
        hasStableResume={view.session.tailoredResume !== null} />}
    {preparation?.status === 'awaiting-correction' && preparation.sourceIntake !== null
      ? <CriticalAmbiguityQuestions {...{ candidateJourney, localization, sourceIntake: preparation.sourceIntake }} /> : null}
    {preparation?.status === 'no-relevant-evidence' ? <Alert color="caution" title={localization.translate('jobMatch.generation.denied')}>
      <Text>{localization.translate('jobMatch.generation.normalizedNotice')}</Text>
      <Group mt="sm"><Button disabled={view.operation !== null} onClick={onNormalized}>
        {localization.translate('combinedIntake.normalized')}</Button>
        <BackToDocuments {...{ localization, onBack }} /></Group>
    </Alert> : null}
    {preparation?.status === 'prepared' && preparation.sourceIntake !== null && preparation.sourceIntake.criticalAmbiguities.length > 0
      ? <Alert color="informative">{localization.translate('combinedIntake.omittedAmbiguities')}</Alert> : null}
    {preparation?.jobMatch?.analysis.matchBand === 'ambitious' && preparation.status === 'prepared'
      ? <Alert color="caution">{localization.translate('jobMatch.generation.lowScoreWarning')}</Alert> : null}
  </>
}

const preparationFailureKeys = {
  ...sourceIntakeFailureKeys, ...jobMatchFailureKeys,
  'candidate-session-storage-unavailable': 'candidateJourney.storageUnavailable',
  'unavailable': 'combinedIntake.cause.unavailable', 'unsupported-content': 'combinedIntake.unsafe',
  'incoherent-content': 'combinedIntake.incoherent',
  'stale-result': 'combinedIntake.outdated',
} as const satisfies Record<ResumePreparationFailure, Parameters<Localization['translate']>[0]>

const retryableFailureCauses = {
  'source-profile-extraction-unavailable': 'combinedIntake.cause.source',
  'job-posting-extraction-unavailable': 'combinedIntake.cause.posting',
  'match-evidence-unavailable': 'combinedIntake.cause.evidence',
  'unavailable': 'combinedIntake.cause.unavailable',
} as const satisfies Partial<Record<ResumePreparationFailure, Parameters<Localization['translate']>[0]>>

const inputFailures = new Set<ResumePreparationFailure>([
  'encrypted-document', 'empty-document', 'invalid-document', 'oversized-document', 'scanned-document',
  'unsupported-document', 'unreadable-document', 'empty-job-posting', 'invalid-job-posting',
  'oversized-job-posting', 'scanned-job-posting', 'unsupported-job-posting', 'unreadable-job-posting',
])

function BackToDocuments({ localization, onBack }: Readonly<{ localization: Localization; onBack: (() => void) | undefined }>) {
  return onBack === undefined ? null
    : <Button onClick={onBack} variant="default">{localization.translate('resumeResult.backToDocuments')}</Button>
}

type FailedPreparation = Readonly<{
  failure: ResumePreparationFailure | null; cause: FailureCause | undefined; interrupted: boolean
  /** Whether the alert offers an action of its own: a Recovery, or a retry when another attempt can succeed. */
  recoverable: boolean
}>

function readFailedPreparation(session: CandidateSession): FailedPreparation | null {
  const { preparation } = session
  if (preparation?.status !== 'failed' && preparation?.status !== 'interrupted') return null
  const failure = preparation.failure ?? null
  const cause = preparation.status === 'failed' ? preparation.failureCause : undefined
  const interrupted = preparation.status === 'interrupted'
  return { failure, cause, interrupted,
    recoverable: cause !== undefined || interrupted || failure === null || !inputFailures.has(failure) }
}

/**
 * The context title says which step failed; a Failure Cause adds why, and its Recovery replaces the plain retry. Without
 * a cause, an unavailable service keeps its generic wording.
 */
function PreparationFailureAlert({ busy, cause, failure, hasStableResume, interrupted, localization, onBack, onRetry, recoverable }:
FailedPreparation & Readonly<{
  busy: boolean; hasStableResume: boolean; localization: Localization; onBack: (() => void) | undefined; onRetry: () => void
}>) {
  const step = interrupted || failure === null || (cause !== undefined && failure === 'unavailable') ? null
    : localization.translate(failure in retryableFailureCauses
      ? retryableFailureCauses[failure as keyof typeof retryableFailureCauses] : preparationFailureKeys[failure])
  return <Alert color={interrupted ? 'caution' : 'danger'} role="alert"
    title={localization.translate(interrupted ? 'combinedIntake.interruptedTitle' : 'combinedIntake.failedTitle')}>
    <Stack gap="sm">
      {step === null ? null : <Text size="sm">{step}</Text>}
      {cause === undefined ? null : <FailureExplanation {...{ cause, localization }} />}
      <Text c="dimmed" size="sm">{localization.translate(hasStableResume ? 'combinedIntake.inputsAndResumeKept' : 'combinedIntake.inputsKept')}</Text>
      <Group>{cause !== undefined ? <RecoveryAction {...{ busy, cause, localization, onRetry }} recovery={readRecovery(cause)}
        onShortenInput={onBack ?? showIntake} />
        : recoverable ? <Button disabled={busy} onClick={onRetry} variant="default">
          {localization.translate('combinedIntake.retry')}</Button> : null}
        <BackToDocuments {...{ localization, onBack }} /></Group>
    </Stack>
  </Alert>
}

/** On the intake page, the texts to shorten are right below its title. */
function showIntake() {
  document.getElementById('combined-intake-title')?.scrollIntoView({ block: 'start' })
}

function InputFailure({ failure, localization }: Readonly<{ failure: ResumePreparationFailure | null; localization: Localization }>) {
  if (failure === null || failure === 'unavailable') return null
  return <Text c="danger.8" role="alert">{localization.translate(preparationFailureKeys[failure])}</Text>
}

function proposedLanguage({ postingChoice, localization }: Readonly<{ postingChoice: DocumentChoice; localization: Localization }>) {
  const label = localization.translate('tailoredResume.languageAutomatic')
  if (postingChoice.method !== 'paste' || postingChoice.text.trim().length === 0) return label
  const locale = inferTailoredResumeLocale({ content: postingChoice.text })
  return `${label}: ${locale === 'fr' ? 'Français' : 'English'}`
}
