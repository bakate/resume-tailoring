import { Alert, Button, Fieldset, FileInput, Group, Modal, Paper, SegmentedControl, Select, Stack, Text, Textarea, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { inferTailoredResumeLocale } from '@resume-tailoring/application/tailored-resume'
import type { CandidateSession, ResumePreparationFailure, StoredIntakeDocument } from '@resume-tailoring/application/candidate-journey'
import type { SourceDocument } from '@resume-tailoring/application/source-intake'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'
import { CriticalAmbiguityQuestions, sourceIntakeFailureKeys } from './source-intake-workspace'
import { jobMatchFailureKeys } from './job-match-workspace'

type IntakeProps = Readonly<{ candidateJourney: ReturnType<typeof useCandidateJourney>; localization: Localization }>
type OpenIntakeProps = IntakeProps & Readonly<{ session: CandidateSession }>
type DocumentChoice = Readonly<{ method: 'paste' | 'upload'; text: string; file: File | null }>
type ResumePurpose = 'tailored' | 'normalized'
type IntakeState = Readonly<{
  sourceChoice: DocumentChoice; postingChoice: DocumentChoice; locale: string | null;
  failure: ResumePreparationFailure | null; confirmation: boolean; purpose: ResumePurpose
}>
type IntakeControls = ReturnType<typeof useIntakeForm>
type IntakeActionsInput = OpenIntakeProps & Readonly<{ state: IntakeState; setState: Dispatch<SetStateAction<IntakeState>> }>

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
    <Fieldset disabled={view.operation !== null} p={0} variant="unstyled">
      <Stack><IntakeFields {...props} controls={controls} /></Stack>
    </Fieldset>
    <Button disabled={view.processingConsentStatus !== 'granted' || view.operation !== null} loading={view.operation !== null}
      onClick={() => { controls.requestGeneration({ purpose: 'tailored' }) }}>{localization.translate('combinedIntake.generate')}</Button>
    <PreparationFeedback {...{ candidateJourney, localization, localFailure: controls.state.failure }}
      onRetry={() => { controls.requestGeneration({ purpose: session.preparation?.purpose ?? 'tailored' }) }}
      onNormalized={() => { controls.requestGeneration({ purpose: 'normalized' }) }} />
    <RegenerationConfirmation {...{ controls, localization }} />
  </Stack></Paper>
}

function useIntakeForm(props: OpenIntakeProps) {
  const [state, setState] = useState<IntakeState>(() => ({ sourceChoice: initialSource(props.candidateJourney),
    postingChoice: initialPosting(props.candidateJourney), locale: props.session.preparation?.locale ?? 'automatic',
    failure: null, confirmation: false, purpose: 'tailored' }))
  const extractedSource = props.session.preparation === undefined ? props.session.sourceIntake : props.session.preparation.sourceIntake
  useEffect(() => {
    if (extractedSource !== null) setState((current) => ({ ...current, sourceChoice: { method: 'paste', text: '', file: null } }))
  }, [extractedSource])
  const updateInputs = (change: Partial<Pick<IntakeState, 'sourceChoice' | 'postingChoice' | 'locale'>>) => {
    setState((current) => ({ ...current, ...change, failure: null }))
    props.candidateJourney.invalidateResumeInputs()
  }
  return { state, updateInputs, ...createIntakeActions({ ...props, state, setState }) }
}

function createIntakeActions(input: IntakeActionsInput) {
  const generate = async ({ purpose }: Readonly<{ purpose: ResumePurpose }>) => {
    input.setState((current) => ({ ...current, confirmation: false }))
    const request = await readIntakeRequest({ ...input, purpose })
    if (!request.ok) { input.setState((current) => ({ ...current, failure: request.error })); return }
    input.setState((current) => ({ ...current, failure: null }))
    input.candidateJourney.startTailoredResumePreparation(request.value)
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
  if (sourceDocument === null && source === null) return { ok: false, error: 'empty-document' } as const
  if (jobPosting === null) return { ok: false, error: 'empty-job-posting' } as const
  return { ok: true, value: { ...(sourceDocument === null ? {} : { sourceDocument }), jobPosting,
    locale: state.locale === 'en' || state.locale === 'fr' ? state.locale : null, purpose } } as const
}

function IntakeFields({ session, localization, controls }: OpenIntakeProps & Readonly<{ controls: IntakeControls }>) {
  const { state, updateInputs } = controls
  const sourcePicker = <DocumentPicker choice={state.sourceChoice} kind="source" localization={localization}
    onChange={(sourceChoice) => { updateInputs({ sourceChoice }) }} />
  return <>
    {(session.preparation?.sourceIntake ?? session.sourceIntake) === null ? sourcePicker
      : <details><summary>{localization.translate('combinedIntake.replaceSource')}</summary>{sourcePicker}</details>}
    <DocumentPicker choice={state.postingChoice} kind="posting" localization={localization}
      onChange={(postingChoice) => { updateInputs({ postingChoice }) }} />
    <Select label={localization.translate('tailoredResume.language')} value={state.locale}
      onChange={(locale) => { updateInputs({ locale }) }} data={[
        { value: 'automatic', label: proposedLanguage({ postingChoice: state.postingChoice, localization }) },
        { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' },
      ]} />
  </>
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

function DocumentPicker({ choice, kind, localization, onChange }: Readonly<{
  choice: DocumentChoice; kind: 'source' | 'posting'; localization: Localization; onChange: (choice: DocumentChoice) => void
}>) {
  const source = kind === 'source'
  return <Stack component="fieldset" gap="sm" className="combined-intake-document">
    <Text component="legend" fw={700}>{localization.translate(source ? 'sourceIntake.title' : 'jobMatch.title')}</Text>
    <SegmentedControl aria-label={localization.translate(source ? 'sourceIntake.sourceFile' : 'jobMatch.fileLabel')}
      value={choice.method} onChange={(method) => { onChange({ ...choice, method: method === 'upload' ? 'upload' : 'paste' }) }}
      data={[{ value: 'paste', label: localization.translate('sourceIntake.pasteMethod') },
        { value: 'upload', label: localization.translate(source ? 'sourceIntake.uploadMethod' : 'jobMatch.uploadMethod') }]} />
    {choice.method === 'paste' ? <Textarea minRows={5} label={localization.translate(source ? 'sourceIntake.professionalText' : 'jobMatch.textLabel')}
      value={choice.text} onChange={(event) => { onChange({ ...choice, text: event.currentTarget.value }) }} />
      : <FileInput label={localization.translate(source ? 'sourceIntake.sourceFile' : 'jobMatch.fileLabel')}
        accept={source ? '.pdf,.docx' : '.pdf,.txt'} value={choice.file}
        onChange={(file) => { onChange({ ...choice, file }) }} />}
  </Stack>
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
  const preparation = view.session.preparation
  if (preparation?.jobPosting !== null && preparation?.jobPosting !== undefined) return restoreChoice(preparation.jobPosting)
  const posting = preparation?.jobMatch?.jobPosting ?? view.session.jobMatch?.jobPosting
  return { method: 'paste', text: posting?.originalContent ?? '', file: null }
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

function PreparationFeedback({ candidateJourney, localization, localFailure, onRetry, onNormalized }: IntakeProps & Readonly<{
  localFailure: ResumePreparationFailure | null; onRetry: () => void; onNormalized: () => void
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const preparation = view.session.preparation
  const failure = localFailure ?? preparation?.failure ?? null
  return <>
    <InputFailure {...{ failure, localization }} />
    {preparation?.status === 'awaiting-correction' && preparation.sourceIntake !== null
      ? <CriticalAmbiguityQuestions {...{ candidateJourney, localization, sourceIntake: preparation.sourceIntake }} /> : null}
    {preparation?.status === 'no-relevant-evidence' ? <Alert color="forest" title={localization.translate('jobMatch.generation.denied')}>
      <Text>{localization.translate('jobMatch.generation.normalizedNotice')}</Text>
      <Button mt="sm" disabled={view.operation !== null} onClick={onNormalized}>
        {localization.translate('combinedIntake.normalized')}</Button>
    </Alert> : null}
    {preparation?.status === 'failed' || preparation?.status === 'interrupted' ? <Alert color="forest">
      <Text>{localization.translate(preparation.status === 'interrupted' ? 'combinedIntake.interrupted' : 'combinedIntake.failed')}</Text>
      <Button mt="sm" disabled={view.operation !== null || view.processingConsentStatus !== 'granted'}
        onClick={onRetry}>{localization.translate('combinedIntake.retry')}</Button>
    </Alert> : null}
    {preparation?.status === 'prepared' && preparation.sourceIntake !== null && preparation.sourceIntake.criticalAmbiguities.length > 0
      ? <Alert color="forest">{localization.translate('combinedIntake.omittedAmbiguities')}</Alert> : null}
    {preparation?.jobMatch?.analysis.matchBand === 'ambitious' && preparation.status === 'prepared'
      ? <Alert color="forest">{localization.translate('jobMatch.generation.lowScoreWarning')}</Alert> : null}
  </>
}

const preparationFailureKeys = {
  ...sourceIntakeFailureKeys, ...jobMatchFailureKeys,
  'candidate-session-storage-unavailable': 'candidateJourney.storageUnavailable',
  'unavailable': 'combinedIntake.failed', 'unsupported-content': 'combinedIntake.unsafe',
  'stale-result': 'combinedIntake.outdated',
} as const satisfies Record<ResumePreparationFailure, Parameters<Localization['translate']>[0]>

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
