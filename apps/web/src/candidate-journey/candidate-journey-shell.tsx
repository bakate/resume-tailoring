import {
  Alert,
  AppShell,
  Box,
  Button,
  Container,
  Group,
  Modal,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { IconLoader2 } from '@tabler/icons-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

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
import { PhaseProgressList } from './phase-progress-list'
import { PrivacyStatement } from './processing-policy-notice'
import { SourceIntakeWorkspace } from './source-intake-workspace'
import type { CandidateJourneyController } from './use-candidate-journey'

/** The chrome both Candidate Journey routes share: header, skip link and live announcements. */
export function CandidateJourneyShell({ children }: Readonly<{ children: ReactNode }>) {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  return <LocalizedCandidateJourneyShell localization={localizationResult.value}>{children}</LocalizedCandidateJourneyShell>
}

function LocalizedCandidateJourneyShell({ children, localization }: LocalizationProps & Readonly<{ children: ReactNode }>) {
  const candidateJourney = useCandidateJourney()
  return (
    <AppShell className="candidate-journey-app" header={{ height: 76 }} padding={{ base: 'sm', sm: 'xl' }}>
      <a className="skip-link" href="#main-content">
        {localization.translate('candidateJourney.skipToContent')}
      </a>
      <CandidateJourneyHeader localization={localization} />
      <AppShell.Main id="main-content"><Container size="xl"><Stack gap="xl">
        <CandidateJourneyStatusAnnouncements {...{ activePhase: readActivePhase(candidateJourney), candidateJourney, localization }} />
        {children}
      </Stack></Container></AppShell.Main>
    </AppShell>
  )
}

/** `/`: the introduction, the intake, the source evidence and the phases; the result lives on `/resume`. */
export function CandidateIntakePage() {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  const localization = localizationResult.value
  return <CandidateIntake localization={localization} />
}

function CandidateIntake({ localization }: LocalizationProps) {
  const candidateJourney = useCandidateJourney()
  return <>
    <CandidateJourneyIntroduction {...{ candidateJourney, localization }} />
    {isResultOperation(candidateJourney) ? null : <CandidateJourneyProgress {...{ candidateJourney, localization }} />}
    <LatestResumeBanner {...{ candidateJourney, localization }} />
    <CombinedIntakeWorkspace {...{ candidateJourney, localization }} />
    <SourceEvidenceDisclosure {...{ candidateJourney, localization }} />
    <CandidateJourneyPhaseList {...{ activePhase: readActivePhase(candidateJourney), localization }} />
  </>
}

type LocalizationProps = Readonly<{ localization: Localization }>
type CandidateJourneyProps = LocalizationProps & Readonly<{ candidateJourney: CandidateJourneyController }>

/**
 * While a preparation runs, the phase it has reached; the saved session only moves on once a phase succeeds, so it
 * would still name the Source Intake while the resume is being written.
 */
function readActivePhase({ view }: CandidateJourneyController): CandidateJourneyPhase | null {
  if (view.status !== 'candidate-session-open') return null
  if (view.preparationPhase === 'extracting-source') return 'source-intake'
  if (view.preparationPhase !== null) return 'job-match'
  return view.operation === 'preparing-tailored-resume' ? 'tailored-resume-preparation' : view.session.phase
}

/** Preparing and rendering the Tailored Resume are shown on `/resume`, not on the intake. */
export function isResultOperation({ view }: CandidateJourneyController) {
  return view.status === 'candidate-session-open'
    && (view.operation === 'preparing-tailored-resume' || view.operation === 'rendering-resume-document')
}

/** Links back to the result without redirecting, so the Candidate can still change their documents. */
function LatestResumeBanner({ candidateJourney, localization }: CandidateJourneyProps) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const preparing = view.operation === 'preparing-tailored-resume'
  if (!preparing && view.session.tailoredResume === null) return null
  return <Alert color="forest" variant="light">
    <Group justify="space-between" wrap="wrap">
      <Text fw={600}>{localization.translate(preparing ? 'resultBanner.preparing' : 'resultBanner.ready')}</Text>
      <Button component={Link} to="/resume" variant="light" rightSection={<span aria-hidden="true">→</span>}>
        {localization.translate('resultBanner.view')}
      </Button>
    </Group>
  </Alert>
}

function SourceEvidenceDisclosure({ candidateJourney, localization }: CandidateJourneyProps) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const sourceIntake = view.session.preparation?.sourceIntake ?? view.session.sourceIntake
  if (sourceIntake === null) return null
  return <details><summary>{localization.translate('combinedIntake.inspection')}</summary>
    <SourceIntakeWorkspace {...{ candidateJourney, localization }} /></details>
}

function CandidateJourneyHeader({ localization }: LocalizationProps) {
  return (
    <AppShell.Header><Container h="100%" size="xl"><Group className="candidate-journey-header" h="100%" justify="space-between" wrap="wrap">
      <Text className="candidate-journey-brand" component={Link} to="/" fw={700} size="lg">{localization.translate('brand.name')}</Text>
      <LocaleControl localization={localization} />
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
      <PrivacyStatement localization={localization}
        processingPolicy={candidateJourney.languageModelGateway.processingPolicy} />
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
  const operation = candidateJourney.view.status === 'candidate-session-open'
    ? candidateJourney.view.operation
    : null
  // While a preparation runs, the phase is named as the progress list shows it.
  const phaseMessage = activePhaseDefinition === undefined || activePhaseDefinition === null ? null : formatJourneyMessage({
    template: localization.translate('candidateJourney.phaseAnnouncement'),
    value: localization.translate(operation === 'preparing-tailored-resume'
      ? `phaseProgress.${activePhaseDefinition.id}` : activePhaseDefinition.titleKey),
    token: 'phase',
  })
  // The previous result is only promised to stay visible when there is one.
  const hasStableResult = candidateJourney.view.status === 'candidate-session-open'
    && candidateJourney.view.session.tailoredResume !== null
  const operationMessage = operation === null ? null : formatJourneyMessage({
    template: localization.translate(hasStableResult ? 'candidateJourney.operationAnnouncement' : 'candidateJourney.firstOperationAnnouncement'),
    value: localization.translate(readOperationKey({ candidateJourney, operation })),
    token: 'operation',
  })
  const resultMessage = readValidatedResultMessage({ candidateJourney, localization })
  return <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">
    {[phaseMessage, operationMessage, resultMessage].filter((message): message is string =>
      message !== null).join(' ')}
  </div>
}

export function CandidateJourneyProgress({ candidateJourney, localization }:
LocalizationProps & Readonly<{ candidateJourney: CandidateJourneyController }>) {
  if (candidateJourney.view.status !== 'candidate-session-open'
    || candidateJourney.view.operation === null) return null
  const { operation } = candidateJourney.view
  const activePhase = readActivePhase(candidateJourney)
  return <Paper aria-busy="true" aria-describedby="candidate-journey-progress-description"
    aria-label={localization.translate('candidateJourney.progressLabel')}
    className="candidate-journey-progress" component="section" p={{ base: 'md', sm: 'lg' }} withBorder>
    <Stack gap="sm">
      {operation === 'preparing-tailored-resume' && activePhase !== null
        ? <PhaseProgressList {...{ activePhase, localization }} />
        : <Group gap="xs" wrap="nowrap"><IconLoader2 aria-hidden="true" className="progress-spinner" size={20} stroke={2} />
          <Text fw={700}>{localization.translate(readOperationKey({ candidateJourney, operation }))}</Text></Group>}
      <Text c="dimmed" id="candidate-journey-progress-description" size="sm">
        {readProgressDescription({ candidateJourney, localization })}
      </Text>
    </Stack>
  </Paper>
}

/** A resume preparation names the step it has reached out of three; other operations only say how long they may take. */
function readProgressDescription({ candidateJourney, localization }: CandidateJourneyProps) {
  const phase = readActivePhase(candidateJourney)
  const preparing = candidateJourney.view.status === 'candidate-session-open'
    && candidateJourney.view.operation === 'preparing-tailored-resume'
  if (!preparing || phase === null) return localization.translate('candidateJourney.progressDescription')
  return formatJourneyMessage({ template: localization.translate('candidateJourney.progressStep'), token: 'step',
    value: String(candidateJourneyPhases.findIndex(({ id }) => id === phase) + 1) })
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
  const { view } = candidateJourney
  const phase = view.status === 'candidate-session-open' ? view.preparationPhase : null
  const writingSections = view.status === 'candidate-session-open' && operation === 'preparing-tailored-resume'
    && view.session.preparation?.status === 'pending' && view.session.preparation.sections !== undefined
  if (phase === null) return writingSections ? 'combinedIntake.writing' : operationTranslationKeys[operation]
  return ({ 'extracting-source': 'candidateJourney.operation.extractSourceProfile',
    'extracting-posting': 'combinedIntake.extractingPosting', matching: 'combinedIntake.matching' } as const)[phase]
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
      <SimpleGrid className="candidate-journey-phase-list" cols={{ base: 1, md: 3 }} component="ol" spacing="lg">
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
