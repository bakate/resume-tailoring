import {
  AppShell,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { useState } from 'react'

import {
  LocalizationFailure,
  useLocalization,
} from '../localization/localization'
import type { Localization } from '../localization/localization'
import type { CandidateJourneyView } from '@resume-tailoring/application/candidate-journey'
import { candidateJourneyPhases } from './candidate-journey-phases'
import type { CandidateJourneyPhase } from './candidate-journey-phases'
import { useCandidateJourney } from './use-candidate-journey'
import { CombinedIntakeWorkspace } from './combined-intake-workspace'
import { SourceIntakeWorkspace } from './source-intake-workspace'
import { JobMatchWorkspace } from './job-match-workspace'
import { TailoredResumeWorkspace } from './tailored-resume-workspace'

export function CandidateJourneyShell() {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  return <LocalizedCandidateJourneyShell localization={localizationResult.value} />
}

function LocalizedCandidateJourneyShell({ localization }: LocalizationProps) {
  const candidateJourney = useCandidateJourney()
  const activePhase = candidateJourney.view.status === 'candidate-session-open'
    ? candidateJourney.view.session.phase
    : null
  return (
    <AppShell className="candidate-journey-app" header={{ height: 76 }} padding={{ base: 'sm', sm: 'xl' }}>
      <a className="skip-link" href="#main-content">
        {localization.translate('candidateJourney.skipToContent')}
      </a>
      <CandidateJourneyHeader localization={localization} />
      <AppShell.Main id="main-content"><Container size="xl"><Stack gap="xl">
        <CandidateJourneyIntroduction {...{ candidateJourney, localization }} />
        <CandidateJourneyStatusAnnouncements {...{ activePhase, candidateJourney, localization }} />
        <CandidateJourneyProgress {...{ candidateJourney, localization }} />
        <TailoredResumeWorkspace {...{ candidateJourney, localization }} />
        <CombinedIntakeWorkspace {...{ candidateJourney, localization }} />
        <ResultDisclosures {...{ candidateJourney, localization }} />
        <CandidateJourneyPhaseList {...{ activePhase, localization }} />
      </Stack></Container></AppShell.Main>
    </AppShell>
  )
}

type LocalizationProps = Readonly<{ localization: Localization }>
type CandidateJourneyController = ReturnType<typeof useCandidateJourney>

function ResultDisclosures({ candidateJourney, localization }: LocalizationProps & Readonly<{
  candidateJourney: CandidateJourneyController
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const { preparation } = view.session
  const sourceIntake = preparation?.sourceIntake ?? view.session.sourceIntake
  const jobMatch = preparation?.jobMatch ?? view.session.jobMatch
  return <>
    {sourceIntake === null || jobMatch === null ? null
      : <details><summary>{localization.translate('combinedIntake.analysis')}</summary>
        <JobMatchWorkspace {...{ candidateJourney, localization }} /></details>}
    {sourceIntake === null ? null
      : <details><summary>{localization.translate('combinedIntake.inspection')}</summary>
        <SourceIntakeWorkspace {...{ candidateJourney, localization }} /></details>}
  </>
}

function CandidateJourneyHeader({ localization }: LocalizationProps) {
  return (
    <AppShell.Header><Container h="100%" size="xl"><Group className="candidate-journey-header" h="100%" justify="space-between" wrap="wrap">
      <Text fw={700} size="lg">{localization.translate('brand.name')}</Text>
      <Group gap="sm" wrap="wrap">
        <Badge color="forest" variant="light">
          {localization.translate('candidateJourney.privateByDesign')}
        </Badge>
        <LocaleControl localization={localization} />
      </Group>
    </Group></Container></AppShell.Header>
  )
}

function LocaleControl({ localization }: LocalizationProps) {
  return <SegmentedControl
    aria-label={localization.translate('locale.switcherLabel')}
    data={[
      { label: 'EN', value: 'en' },
      { label: 'FR', value: 'fr' },
    ]}
    onChange={(locale) => { selectLocale({ locale, localization }) }}
    value={localization.locale}
  />
}

function selectLocale({ locale, localization }: LocalizationProps & Readonly<{ locale: string }>) {
  if (locale !== 'en' && locale !== 'fr') return
  localization.selectLocale(locale)
}

function CandidateJourneyIntroduction({ candidateJourney, localization }: LocalizationProps & Readonly<{
  candidateJourney: CandidateJourneyController
}>) {
  return (
    <Box maw="48rem" pt="xl">
      <Text c="forest.8" fw={700} mb="sm" tt="uppercase">
        {localization.translate('candidateJourney.eyebrow')}
      </Text>
      <Title fz={{ base: '2.75rem', sm: '3.75rem' }} order={1}>
        {localization.translate('candidateJourney.title')}
      </Title>
      <Text c="dimmed" mt="lg" size="xl">
        {localization.translate('candidateJourney.description')}
      </Text>
      <CandidateSessionControls {...{ candidateJourney, localization }} />
      <CandidateSessionNotice localization={localization} view={candidateJourney.view} />
    </Box>
  )
}

function CandidateSessionControls({ candidateJourney, localization }: LocalizationProps & Readonly<{
  candidateJourney: CandidateJourneyController
}>) {
  if (candidateJourney.view.status !== 'candidate-session-open') {
    return <StartCandidateSessionButton {...{ candidateJourney, localization }} />
  }
  return <ActiveCandidateSessionControls {...{ candidateJourney, localization }} />
}

function ActiveCandidateSessionControls({ candidateJourney, localization }:
LocalizationProps & Readonly<{ candidateJourney: CandidateJourneyController }>) {
  const [isDeleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false)
  const closeDeleteConfirmation = () => { setDeleteConfirmationOpen(false) }
  const openDeleteConfirmation = () => { setDeleteConfirmationOpen(true) }
  return <>
    <Group mt="xl">
      <Badge color="forest" size="lg" variant="light">
        {localization.translate('candidateJourney.sessionActive')}
      </Badge>
      <Button color="danger" onClick={openDeleteConfirmation} variant="subtle">
        {localization.translate('candidateJourney.deleteSession')}
      </Button>
    </Group>
    <DeleteCandidateSessionModal {...{
      candidateJourney, closeDeleteConfirmation, isDeleteConfirmationOpen, localization,
    }} />
  </>
}

function StartCandidateSessionButton({ candidateJourney, localization }: LocalizationProps & Readonly<{
  candidateJourney: CandidateJourneyController
}>) {
  const { view } = candidateJourney
  return <Button disabled={view.status !== 'candidate-session-absent'}
    loading={view.status === 'preparing-session'}
    mt="xl" onClick={candidateJourney.startCandidateSession} size="lg">
    {localization.translate('candidateJourney.startSession')}
  </Button>
}

function DeleteCandidateSessionModal({
  candidateJourney, closeDeleteConfirmation, isDeleteConfirmationOpen, localization,
}: LocalizationProps & DeleteCandidateSessionModalProps) {
  const deleteSession = () => {
    deleteCandidateSession({ candidateJourney, closeDeleteConfirmation })
  }
  return <Modal onClose={closeDeleteConfirmation} opened={isDeleteConfirmationOpen}
    title={localization.translate('candidateJourney.deleteDialogTitle')}>
    <Stack>
      <Text>{localization.translate('candidateJourney.deleteDialogDescription')}</Text>
      <DeleteCandidateSessionActions {...{
        closeModal: closeDeleteConfirmation, deleteSession, localization,
      }} />
    </Stack>
  </Modal>
}

type DeleteCandidateSessionModalProps = Readonly<{
  candidateJourney: CandidateJourneyController
  closeDeleteConfirmation: () => void
  isDeleteConfirmationOpen: boolean
}>

function deleteCandidateSession({ candidateJourney, closeDeleteConfirmation }: Readonly<{
  candidateJourney: CandidateJourneyController
  closeDeleteConfirmation: () => void
}>) {
  closeDeleteConfirmation()
  candidateJourney.deleteCandidateSession()
}

function DeleteCandidateSessionActions({ closeModal, deleteSession, localization }:
LocalizationProps & Readonly<{ closeModal: () => void; deleteSession: () => void }>) {
  return <Group justify="flex-end">
    <Button onClick={closeModal} variant="default">
      {localization.translate('candidateJourney.deleteCancel')}
    </Button>
    <Button color="danger" onClick={deleteSession}>
      {localization.translate('candidateJourney.deleteConfirm')}
    </Button>
  </Group>
}

function CandidateSessionNotice({ localization, view }: LocalizationProps & Readonly<{
  view: CandidateJourneyView
}>) {
  if (view.status === 'candidate-session-unavailable') {
    return <Text c="danger.8" mt="md" role="alert">
      {localization.translate('candidateJourney.storageUnavailable')}
    </Text>
  }
  if (view.status !== 'candidate-session-absent' || view.notice === null) return null
  return <Text c="dimmed" mt="md" role="status">
    {localization.translate(candidateSessionNoticeKeys[view.notice])}
  </Text>
}

function CandidateJourneyStatusAnnouncements({ activePhase, candidateJourney, localization }:
LocalizationProps & Readonly<{
  activePhase: CandidateJourneyPhase | null
  candidateJourney: CandidateJourneyController
}>) {
  const activePhaseDefinition = activePhase === null ? null : candidateJourneyPhases.find((phase) =>
    phase.id === activePhase)
  const phaseMessage = activePhaseDefinition === undefined || activePhaseDefinition === null ? null : formatJourneyMessage({
    template: localization.translate('candidateJourney.phaseAnnouncement'),
    value: localization.translate(activePhaseDefinition.titleKey),
    token: 'phase',
  })
  const operation = candidateJourney.view.status === 'candidate-session-open'
    ? candidateJourney.view.operation
    : null
  const operationMessage = operation === null ? null : formatJourneyMessage({
    template: localization.translate('candidateJourney.operationAnnouncement'),
    value: localization.translate(readOperationKey({ candidateJourney, operation })),
    token: 'operation',
  })
  const resultMessage = readValidatedResultMessage({ candidateJourney, localization })
  return <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
    {[phaseMessage, operationMessage, resultMessage].filter((message): message is string =>
      message !== null).join(' ')}
  </div>
}

function CandidateJourneyProgress({ candidateJourney, localization }:
LocalizationProps & Readonly<{ candidateJourney: CandidateJourneyController }>) {
  if (candidateJourney.view.status !== 'candidate-session-open'
    || candidateJourney.view.operation === null) return null
  const { operation } = candidateJourney.view
  return <Paper aria-busy="true" aria-describedby="candidate-journey-progress-description"
    aria-label={localization.translate('candidateJourney.progressLabel')}
    className="candidate-journey-progress" component="section" p={{ base: 'md', sm: 'lg' }} withBorder>
    <Group align="flex-start" wrap="nowrap">
      <Skeleton aria-hidden="true" circle height={36} width={36} />
      <Stack flex={1} gap="xs">
        <Text fw={700}>{localization.translate(readOperationKey({ candidateJourney, operation }))}</Text>
        <Text c="dimmed" id="candidate-journey-progress-description" size="sm">
          {localization.translate('candidateJourney.progressDescription')}
        </Text>
        <Skeleton aria-hidden="true" height={10} radius="xl" width="72%" />
        <Skeleton aria-hidden="true" height={10} radius="xl" width="48%" />
      </Stack>
    </Group>
  </Paper>
}

function readValidatedResultMessage({ candidateJourney, localization }:
LocalizationProps & Readonly<{ candidateJourney: CandidateJourneyController }>) {
  if (candidateJourney.view.status !== 'candidate-session-open') return null
  const result = candidateJourney.view.session.tailoredResume !== null
    ? 'candidateJourney.result.tailoredResume'
    : candidateJourney.view.session.jobMatch !== null
      ? 'candidateJourney.result.matchAnalysis'
      : candidateJourney.view.session.sourceIntake?.criticalAmbiguities.length === 0
        ? 'candidateJourney.result.sourceProfile'
        : null
  return result === null ? null : localization.translate('candidateJourney.validatedResultAnnouncement')
    .replace('{result}', localization.translate(result))
}

function formatJourneyMessage({ template, token, value }: Readonly<{
  template: string
  token: string
  value: string
}>) {
  return template.replace(`{${token}}`, value)
}

type CandidateJourneyOperation = Exclude<
  Extract<CandidateJourneyView, Readonly<{ status: 'candidate-session-open' }>>['operation'], null
>

function readOperationKey({ candidateJourney, operation }: Readonly<{
  candidateJourney: CandidateJourneyController; operation: CandidateJourneyOperation
}>) {
  const phase = candidateJourney.view.status === 'candidate-session-open' ? candidateJourney.view.preparationPhase : null
  if (phase === null) return operationTranslationKeys[operation]
  return ({ 'extracting-source': 'candidateJourney.operation.extractSourceProfile',
    'extracting-posting': 'combinedIntake.extractingPosting', matching: 'combinedIntake.matching',
    writing: 'combinedIntake.writing', validating: 'combinedIntake.validating' } as const)[phase]
}

const operationTranslationKeys: Readonly<Record<CandidateJourneyOperation, Parameters<
  Localization['translate']
>[0]>> = {
  'rendering-resume-document': 'candidateJourney.operation.renderingResumeDocument',
  'preparing-tailored-resume': 'candidateJourney.operation.preparingTailoredResume',
  'processing-job-posting': 'candidateJourney.operation.processingJobPosting',
  'processing-profile-enrichment': 'candidateJourney.operation.processingProfileEnrichment',
  'processing-source-document': 'candidateJourney.operation.extractSourceProfile',
  'resolving-critical-ambiguity': 'candidateJourney.operation.resolvingCriticalAmbiguity',
}

function CandidateJourneyPhaseList({ activePhase, localization }: LocalizationProps & Readonly<{
  activePhase: CandidateJourneyPhase | null
}>) {
  return (
    <Box aria-label={localization.translate('candidateJourney.phasesLabel')} component="nav">
      <SimpleGrid cols={{ base: 1, md: 3 }} component="ol" spacing="lg">
        {candidateJourneyPhases.map((phase, phaseIndex) => (
          <CandidateJourneyPhaseItem {...{ activePhase, localization, phase, phaseIndex }}
            key={phase.id} />
        ))}
      </SimpleGrid>
    </Box>
  )
}

function CandidateJourneyPhaseItem({ activePhase, localization, phase, phaseIndex }:
LocalizationProps & Readonly<{
  activePhase: CandidateJourneyPhase | null
  phase: typeof candidateJourneyPhases[number]
  phaseIndex: number
}>) {
  return <Paper aria-current={phase.id === activePhase ? 'step' : undefined}
    component="li" p="xl" shadow="xs" withBorder>
    <Group align="flex-start" wrap="nowrap">
      <ThemeIcon radius="xl" size="lg" variant="light">
        {String(phaseIndex + 1).padStart(2, '0')}
      </ThemeIcon>
      <Stack gap="xs">
        <Title order={2} size="h3">{localization.translate(phase.titleKey)}</Title>
        <Text c="dimmed">{localization.translate(phase.descriptionKey)}</Text>
      </Stack>
    </Group>
  </Paper>
}

const candidateSessionNoticeKeys = {
  deleted: 'candidateJourney.sessionDeleted',
  'expired-session-discarded': 'candidateJourney.expiredSessionDiscarded',
  'incompatible-session-discarded': 'candidateJourney.incompatibleSessionDiscarded',
} as const
