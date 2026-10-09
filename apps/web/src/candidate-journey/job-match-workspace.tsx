import {
  Alert,
  Badge,
  Button,
  Group,
  List,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { useState } from 'react'
import type { SyntheticEvent } from 'react'

import type { JobMatch, JobRequirement } from '@resume-tailoring/application/job-match'
import {
  profileEnrichmentFactKinds,
} from '@resume-tailoring/application/job-match'
import type { ProfileEnrichmentFactKind } from '@resume-tailoring/application/job-match'
import type { CandidateFact, SourceIntake } from '@resume-tailoring/application/source-intake'
import type { Localization } from '../localization/localization'
import { coverageTones, readCriticalReserveStatus } from './match-analysis-status'
import type { RequirementCoverage } from './match-analysis-status'
import { readStatusColor, StatusIcon } from './status-message'
import type { useCandidateJourney } from './use-candidate-journey'

type CandidateJourneyController = ReturnType<typeof useCandidateJourney>

export function JobMatchWorkspace({ candidateJourney, localization }: Readonly<{
  candidateJourney: CandidateJourneyController; localization: Localization
}>) {
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const { sourceIntake, jobMatch } = view.preparationInputs
  if (sourceIntake === null || jobMatch === null) return null
  return <Paper component="section" aria-label={localization.translate('jobMatch.title')} p={{ base: 'md', sm: 'xl' }} withBorder>
    <JobMatchResult {...{ candidateJourney, localization, sourceIntake, jobMatch }} />
  </Paper>
}

function JobMatchResult({ candidateJourney, jobMatch, localization, sourceIntake }: Readonly<{
  candidateJourney: CandidateJourneyController
  jobMatch: JobMatch
  localization: Localization
  sourceIntake: SourceIntake
}>) {
  const sourceFacts = sourceIntake.candidateFacts
  return <Stack gap="xl" role="status">
    <MatchOverview {...{ jobMatch, localization }} />

    <Text>{localization.translate('jobMatch.measurement')}</Text>
    <MatchSummaries {...{ jobMatch, localization, sourceFacts }} />
    <CriticalReserve {...{ jobMatch, localization }} />
    <PracticalConstraints {...{ jobMatch, localization }} />
    <RequirementDetails {...{ jobMatch, localization, sourceFacts }} />
    <ProfileEnrichmentPrompts {...{ candidateJourney, jobMatch, localization }} />
  </Stack>
}

function MatchOverview({ jobMatch, localization }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
}>) {
  return <Group align="flex-end" justify="space-between">
    <div><Text fw={700}>{localization.translate('jobMatch.targetRole')}</Text>
      <Title order={3}>{jobMatch.targetRole?.value ?? '–'}</Title></div>
    <div><Text fw={700}>{localization.translate('matchAnalysis.score')}</Text>
      <Title order={3}>{String(jobMatch.analysis.matchScore)}%</Title></div>
    <Badge color={readBandColor({ band: jobMatch.analysis.matchBand })} size="lg">
      {localization.translate(`matchAnalysis.band.${jobMatch.analysis.matchBand}`)}
    </Badge>
  </Group>
}

function MatchSummaries({ jobMatch, localization, sourceFacts }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
  sourceFacts: readonly CandidateFact[]
}>) {
  return <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
    <RequirementSummary ids={jobMatch.strengthRequirementIds} jobMatch={jobMatch}
      localization={localization} titleKey="jobMatch.strengths" />
    <RequirementSummary ids={jobMatch.priorityGapRequirementIds} jobMatch={jobMatch}
      localization={localization} sourceFacts={sourceFacts} titleKey="jobMatch.gaps" />
  </SimpleGrid>
}

function RequirementSummary({ ids, jobMatch, localization, sourceFacts = [], titleKey }: Readonly<{
  ids: readonly string[]
  jobMatch: JobMatch
  localization: Localization
  sourceFacts?: readonly CandidateFact[]
  titleKey: 'jobMatch.gaps' | 'jobMatch.strengths'
}>) {
  const requirements = ids.flatMap((id) => {
    const requirement = jobMatch.requirements.find((candidate) => candidate.id === id)
    return requirement === undefined ? [] : [requirement]
  })
  return <Paper p="md" withBorder><Title order={4}>{localization.translate(titleKey)}</Title>
    <List mt="sm">{requirements.map((requirement) => (
      <List.Item key={requirement.id}>{requirement.value}
        <AdjacentEvidenceNote {...{ jobMatch, localization, requirement, sourceFacts }} />
      </List.Item>
    ))}</List></Paper>
}

// Adjacent Evidence sits next to the gap and never reads as coverage.
function AdjacentEvidenceNote({ jobMatch, localization, requirement, sourceFacts }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
  requirement: JobRequirement
  sourceFacts: readonly CandidateFact[]
}>) {
  const factIds = new Set(jobMatch.analysis.adjacentEvidence
    .filter(({ requirementId }) => requirementId === requirement.id)
    .flatMap((adjacentEvidence) => adjacentEvidence.factIds))
  const values = sourceFacts.filter(({ id }) => factIds.has(id)).map(({ value }) => value)
  if (values.length === 0) return null
  return <Text c="dimmed" size="sm">{localization.translate('jobMatch.adjacentEvidence')}:{' '}
    {values.join(' · ')}</Text>
}

function CriticalReserve({ jobMatch, localization }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
}>) {
  const { headingKey, messageKey, tone } = readCriticalReserveStatus(jobMatch.analysis.criticalRequirementReserve)
  const requirements = readRequirements({
    ids: jobMatch.analysis.criticalRequirementReserve.requirementIds,
    jobMatch,
  })
  return <Paper p="md" withBorder><Group gap="xs" wrap="nowrap"><StatusIcon tone={tone} />
    <Title order={4}>{localization.translate(headingKey)}</Title>
  </Group><Text mt="xs">{localization.translate(messageKey)}</Text>
    {requirements.length === 0 ? null : <List mt="xs">{requirements.map((requirement) => (
      <List.Item key={requirement.id}>{requirement.value}</List.Item>
    ))}</List>}
  </Paper>
}

function PracticalConstraints({ jobMatch, localization }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
}>) {
  return <div><Title order={4}>{localization.translate('jobMatch.constraints')}</Title>
    {jobMatch.practicalConstraints.length === 0
      ? <Text c="dimmed">{localization.translate('jobMatch.constraints.none')}</Text>
      : <List mt="xs">{jobMatch.practicalConstraints.map((constraint) => (
          <List.Item key={constraint.sourceExcerpt}>{constraint.value}</List.Item>
        ))}</List>}
  </div>
}

function RequirementDetails({ jobMatch, localization, sourceFacts }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
  sourceFacts: readonly CandidateFact[]
}>) {
  return <details><summary>{localization.translate('jobMatch.details')}</summary>
    <Stack gap="md" mt="md">{jobMatch.requirements.map((requirement) => (
      <RequirementDetail {...{ jobMatch, localization, requirement, sourceFacts }}
        key={requirement.id} />
    ))}</Stack>
  </details>
}

type RequirementDetailProps = Readonly<{
  jobMatch: JobMatch
  localization: Localization
  requirement: JobRequirement
  sourceFacts: readonly CandidateFact[]
}>

function RequirementDetail({
  jobMatch, localization, requirement, sourceFacts,
}: RequirementDetailProps) {
  const evidence = jobMatch.analysis.evidence.find(({ requirementId }) =>
    requirementId === requirement.id)
  const evidenceValues = readEvidenceValues({ evidence: evidence === undefined ? [] : [evidence],
    sourceFacts })
  return <Paper p="md" withBorder><Stack gap="xs">
    <RequirementBadges coverage={evidence?.coverage ?? 'uncovered'}
      {...{ localization, requirement }} />
    <RequirementEvidence {...{ evidenceValues, localization }} />
    <AdjacentEvidenceNote {...{ jobMatch, localization, requirement, sourceFacts }} />
  </Stack></Paper>
}

function RequirementBadges({ coverage, localization, requirement }: Readonly<{
  coverage: JobMatch['analysis']['requirementGroups'][number]['coverage']
  localization: Localization
  requirement: JobRequirement
}>) {
  return <Group><Text fw={700}>{requirement.value}</Text><Badge variant="light">
    {localization.translate(`jobMatch.importance.${requirement.importance}`)}
  </Badge><CoverageBadge {...{ coverage, localization }} /></Group>
}

// The icon and the label both tell the coverage; the colour only repeats them.
function CoverageBadge({ coverage, localization }: Readonly<{
  coverage: RequirementCoverage
  localization: Localization
}>) {
  const tone = coverageTones[coverage]
  return <Badge color={readStatusColor({ tone })} leftSection={<StatusIcon size={14} tone={tone} />} variant="light">
    {localization.translate(`jobMatch.coverage.${coverage}`)}
  </Badge>
}

function RequirementEvidence({ evidenceValues, localization }: Readonly<{
  evidenceValues: readonly string[]
  localization: Localization
}>) {
  return <Text size="sm"><strong>{localization.translate('jobMatch.evidence')}:</strong>{' '}
    {evidenceValues.length === 0
      ? localization.translate('jobMatch.evidence.none')
      : evidenceValues.join(' · ')}</Text>
}

function ProfileEnrichmentPrompts({ candidateJourney, jobMatch, localization }: Readonly<{
  candidateJourney: CandidateJourneyController
  jobMatch: JobMatch
  localization: Localization
}>) {
  const requirements = readProfileEnrichmentRequirements({ jobMatch })
  if (requirements.length === 0) return null
  return <section aria-label={localization.translate('matchAnalysis.enrichmentTitle')}>
    <Title order={4}>{localization.translate('matchAnalysis.enrichmentTitle')}</Title>
    <Text c="dimmed" mt="xs">{localization.translate('matchAnalysis.enrichmentDescription')}</Text>
    <ProfileEnrichmentFailure {...{ candidateJourney, localization }} />
    <Stack gap="md" mt="md">{requirements.map((requirement) => (
      <ProfileEnrichmentPrompt {...{ candidateJourney, localization, requirement }}
        key={requirement.id} />
    ))}</Stack>
  </section>
}

function readProfileEnrichmentRequirements({ jobMatch }: Readonly<{ jobMatch: JobMatch }>) {
  const requirementById = new Map(jobMatch.requirements.map((requirement) => [
    requirement.id, requirement,
  ]))
  return jobMatch.priorityGapRequirementIds.flatMap((requirementId) => {
    const requirement = requirementById.get(requirementId)
    return requirement === undefined || requirement.importance === 'complementary'
      ? [] : [requirement]
  })
}

function ProfileEnrichmentFailure({ candidateJourney, localization }: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
}>) {
  if (candidateJourney.view.status !== 'candidate-session-open'
    || candidateJourney.view.profileEnrichmentFailure === null) return null
  const key = profileEnrichmentFailureKeys[candidateJourney.view.profileEnrichmentFailure]
  return <Alert color="danger" mt="md" role="alert">{localization.translate(key)}</Alert>
}

function ProfileEnrichmentPrompt({
  candidateJourney, localization, requirement,
}: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
  requirement: JobRequirement
}>) {
  const form = useProfileEnrichmentForm({ candidateJourney, requirement })
  return <Paper aria-label={requirement.value} component="form" onSubmit={form.submit}
    p="md" role="group" withBorder>
    <Stack gap="sm"><Text>{localization.translate('matchAnalysis.enrichmentQuestion')}</Text>
      <Text fw={700}>{requirement.value}</Text>
      <ProfileEnrichmentFields {...{ form, localization }} />
      <Button loading={candidateJourney.view.status === 'candidate-session-open'
        ? candidateJourney.view.operation === 'processing-profile-enrichment' : false}
        type="submit">{localization.translate('matchAnalysis.enrichmentAdd')}</Button>
    </Stack>
  </Paper>
}

function useProfileEnrichmentForm({ candidateJourney, requirement }: Readonly<{
  candidateJourney: CandidateJourneyController
  requirement: JobRequirement
}>) {
  const [kind, setKind] = useState<ProfileEnrichmentFactKind>('experience')
  const [value, setValue] = useState('')
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    candidateJourney.confirmProfileEnrichment({ kind, requirementId: requirement.id, value })
  }
  return { kind, setKind, setValue, submit, value }
}

type ProfileEnrichmentForm = ReturnType<typeof useProfileEnrichmentForm>

function ProfileEnrichmentFields({ form, localization }: Readonly<{
  form: ProfileEnrichmentForm
  localization: Localization
}>) {
  return <><Select data={createProfileEnrichmentKindOptions({ localization })}
    label={localization.translate('matchAnalysis.enrichmentKind')}
    onChange={(nextKind) => { form.setKind(readProfileEnrichmentKind({ value: nextKind })) }}
    value={form.kind} />
  <Textarea label={localization.translate('matchAnalysis.enrichmentAnswer')}
    onChange={(event) => { form.setValue(event.currentTarget.value) }} value={form.value} /></>
}

function createProfileEnrichmentKindOptions({ localization }: Readonly<{
  localization: Localization
}>) {
  return profileEnrichmentFactKinds.map((value) => ({
    label: localization.translate(`sourceProfile.kind.${value}`), value,
  }))
}

function readProfileEnrichmentKind({ value }: Readonly<{ value: string | null }>) {
  return profileEnrichmentFactKinds.find((kind) => kind === value) ?? 'experience'
}

function readEvidenceValues({ evidence, sourceFacts }: Readonly<{
  evidence: JobMatch['analysis']['evidence']
  sourceFacts: readonly CandidateFact[]
}>) {
  const factIds = new Set(evidence.flatMap(({ factIds: evidenceFactIds }) => evidenceFactIds))
  return sourceFacts.filter(({ id }) => factIds.has(id)).map(({ value }) => value)
}

function readRequirements({ ids, jobMatch }: Readonly<{
  ids: readonly string[]
  jobMatch: JobMatch
}>) {
  const requirementIds = new Set(ids)
  return jobMatch.requirements.filter(({ id }) => requirementIds.has(id))
}

export const jobMatchFailureKeys = {
  'candidate-session-storage-unavailable': 'jobMatch.failure.storage',
  'empty-job-posting': 'jobMatch.failure.empty',
  'invalid-job-posting': 'jobMatch.failure.invalid',
  'job-posting-extraction-unavailable': 'jobMatch.failure.extraction',
  'match-evidence-unavailable': 'jobMatch.failure.evidence',
  'oversized-job-posting': 'jobMatch.failure.oversized',
  'processing-consent-required': 'jobMatch.failure.consent',
  'scanned-job-posting': 'jobMatch.failure.scanned',
  'unreadable-job-posting': 'jobMatch.failure.unreadable',
  'unsupported-job-posting': 'jobMatch.failure.unsupported',
} as const

const profileEnrichmentFailureKeys = {
  'candidate-fact-duplicate': 'matchAnalysis.enrichmentDuplicateFailure',
  'candidate-fact-invalid': 'matchAnalysis.enrichmentInvalidFailure',
  'candidate-session-storage-unavailable': 'jobMatch.failure.storage',
  'match-evidence-unavailable': 'jobMatch.failure.evidence',
  'profile-enrichment-unavailable': 'jobMatch.enrichmentUnavailable',
} as const

function readBandColor({ band }: Readonly<{ band: JobMatch['analysis']['matchBand'] }>) {
  if (band === 'strong') return 'forest'
  if (band === 'credible') return 'informative'
  return 'caution'
}
