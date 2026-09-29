import {
  Badge,
  Button,
  FileInput,
  Group,
  List,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { useState } from 'react'

import type { JobMatch, JobRequirement } from '@resume-tailoring/application/job-match'
import type { Localization } from '../localization/localization'
import type { useCandidateJourney } from './use-candidate-journey'

type CandidateJourneyController = ReturnType<typeof useCandidateJourney>
type JobPostingMethod = 'paste' | 'upload'

export function JobMatchWorkspace({ candidateJourney, localization }: Readonly<{
  candidateJourney: CandidateJourneyController
  localization: Localization
}>) {
  const form = useJobPostingForm({ candidateJourney })
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open' || view.session.sourceIntake === null) return null
  return <Paper component="section" p="xl" shadow="xs" withBorder>
    <Stack gap="lg">
      <JobMatchHeader localization={localization} />
      <JobPostingForm {...{ candidateJourney, form, localization }} />
      <JobMatchFailure failure={form.localFailure ?? view.jobMatchFailure}
        localization={localization} />
      {view.session.jobMatch === null ? null : <JobMatchResult
        jobMatch={view.session.jobMatch}
        localization={localization}
        sourceFacts={view.session.sourceIntake.candidateFacts} />}
    </Stack>
  </Paper>
}

function useJobPostingForm({ candidateJourney }: Readonly<{
  candidateJourney: CandidateJourneyController
}>) {
  const [method, setMethod] = useState<JobPostingMethod>('paste')
  const [jobPostingText, setJobPostingText] = useState('')
  const [jobPostingFile, setJobPostingFile] = useState<File | null>(null)
  const [localFailure, setLocalFailure] = useState<'empty-job-posting' | null>(null)
  const submitJobPosting = async () => {
    const document = await readSelectedJobPosting({ jobPostingFile, jobPostingText, method })
    if (document === null) {
      setLocalFailure('empty-job-posting')
      return
    }
    setLocalFailure(null)
    candidateJourney.submitJobPosting(document)
  }
  return {
    jobPostingFile, jobPostingText, localFailure, method, setJobPostingFile,
    setJobPostingText, setMethod, submitJobPosting,
  }
}

type JobPostingFormController = ReturnType<typeof useJobPostingForm>

function JobMatchHeader({ localization }: Readonly<{ localization: Localization }>) {
  return <div><Title order={2} size="h3">{localization.translate('jobMatch.title')}</Title>
    <Text c="dimmed" mt="xs">{localization.translate('jobMatch.description')}</Text></div>
}

function JobPostingForm({ candidateJourney, form, localization }: Readonly<{
  candidateJourney: CandidateJourneyController
  form: JobPostingFormController
  localization: Localization
}>) {
  return <Stack gap="md">
    <SegmentedControl data={[
      { label: localization.translate('jobMatch.pasteMethod'), value: 'paste' },
      { label: localization.translate('jobMatch.uploadMethod'), value: 'upload' },
    ]} onChange={(value) => { form.setMethod(value === 'upload' ? 'upload' : 'paste') }}
    value={form.method} />
    <JobPostingInput {...{ form, localization }} />
    <Button loading={candidateJourney.view.status === 'candidate-session-open'
      ? candidateJourney.view.operation === 'processing-job-posting'
      : false}
      onClick={() => { void form.submitJobPosting() }}>
      {localization.translate('jobMatch.submit')}
    </Button>
  </Stack>
}

function JobPostingInput({ form, localization }: Readonly<{
  form: JobPostingFormController
  localization: Localization
}>) {
  return form.method === 'paste'
    ? <Textarea label={localization.translate('jobMatch.textLabel')} minRows={10}
        onChange={(event) => { form.setJobPostingText(event.currentTarget.value) }}
        placeholder={localization.translate('jobMatch.textPlaceholder')}
        value={form.jobPostingText} />
    : <FileInput accept=".pdf,.txt,application/pdf,text/plain"
        label={localization.translate('jobMatch.fileLabel')}
        onChange={form.setJobPostingFile}
        placeholder={localization.translate('jobMatch.fileHint')}
        value={form.jobPostingFile} />
}

async function readSelectedJobPosting({ jobPostingFile, jobPostingText, method }: Readonly<{
  jobPostingFile: File | null
  jobPostingText: string
  method: JobPostingMethod
}>) {
  if (method === 'paste') return jobPostingText.trim().length === 0 ? null : {
    bytes: new TextEncoder().encode(jobPostingText),
    mediaType: 'text/plain',
    name: 'pasted-job-posting.txt',
  }
  if (jobPostingFile === null) return null
  try {
    return {
      bytes: new Uint8Array(await jobPostingFile.arrayBuffer()),
      mediaType: jobPostingFile.type,
      name: jobPostingFile.name,
    }
  } catch {
    return null
  }
}

function JobMatchResult({ jobMatch, localization, sourceFacts }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
  sourceFacts: readonly Readonly<{ id: string; value: string }>[]
}>) {
  return <Stack gap="xl" role="status">
    <Group align="flex-end" justify="space-between">
      <div><Text fw={700}>{localization.translate('jobMatch.targetRole')}</Text>
        <Title order={3}>{jobMatch.targetRole?.value ?? '—'}</Title></div>
      <div><Text fw={700}>{localization.translate('matchAnalysis.score')}</Text>
        <Title order={3}>{String(jobMatch.analysis.matchScore)}%</Title></div>
      <Badge color={readBandColor({ band: jobMatch.analysis.matchBand })} size="lg">
        {localization.translate(`matchAnalysis.band.${jobMatch.analysis.matchBand}`)}
      </Badge>
    </Group>
    <Text>{localization.translate('jobMatch.measurement')}</Text>
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <RequirementSummary ids={jobMatch.strengthRequirementIds} jobMatch={jobMatch}
        localization={localization} titleKey="jobMatch.strengths" />
      <RequirementSummary ids={jobMatch.priorityGapRequirementIds} jobMatch={jobMatch}
        localization={localization} titleKey="jobMatch.gaps" />
    </SimpleGrid>
    <CriticalReserve {...{ jobMatch, localization }} />
    <PracticalConstraints {...{ jobMatch, localization }} />
    <RequirementDetails {...{ jobMatch, localization, sourceFacts }} />
  </Stack>
}

function RequirementSummary({ ids, jobMatch, localization, titleKey }: Readonly<{
  ids: readonly string[]
  jobMatch: JobMatch
  localization: Localization
  titleKey: 'jobMatch.gaps' | 'jobMatch.strengths'
}>) {
  const requirements = ids.flatMap((id) => {
    const requirement = jobMatch.requirements.find((candidate) => candidate.id === id)
    return requirement === undefined ? [] : [requirement]
  })
  return <Paper p="md" withBorder><Title order={4}>{localization.translate(titleKey)}</Title>
    <List mt="sm">{requirements.map((requirement) => (
      <List.Item key={requirement.id}>{requirement.value}</List.Item>
    ))}</List></Paper>
}

function CriticalReserve({ jobMatch, localization }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
}>) {
  const status = jobMatch.analysis.criticalRequirementReserve.status
  return <Paper p="md" withBorder><Title order={4}>
    {localization.translate('jobMatch.criticalReserve')}
  </Title><Text mt="xs">{localization.translate(`jobMatch.criticalReserve.${status}`)}</Text></Paper>
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
  sourceFacts: readonly Readonly<{ id: string; value: string }>[]
}>) {
  return <details><summary>{localization.translate('jobMatch.details')}</summary>
    <Stack gap="md" mt="md">{jobMatch.requirements.map((requirement) => (
      <RequirementDetail {...{ jobMatch, localization, requirement, sourceFacts }}
        key={requirement.id} />
    ))}</Stack>
  </details>
}

function RequirementDetail({ jobMatch, localization, requirement, sourceFacts }: Readonly<{
  jobMatch: JobMatch
  localization: Localization
  requirement: JobRequirement
  sourceFacts: readonly Readonly<{ id: string; value: string }>[]
}>) {
  const group = jobMatch.analysis.requirementGroups.find(
    ({ requirementIds }) => requirementIds.includes(requirement.id),
  )
  const evidence = jobMatch.analysis.evidence.find(({ requirementId }) =>
    requirementId === requirement.id)
  const evidenceValues = evidence?.factIds.flatMap((factId) => {
    const fact = sourceFacts.find(({ id }) => id === factId)
    return fact === undefined ? [] : [fact.value]
  }) ?? []
  return <Paper p="md" withBorder><Stack gap="xs">
    <Group><Text fw={700}>{requirement.value}</Text><Badge variant="light">
      {localization.translate(`jobMatch.importance.${requirement.importance}`)}
    </Badge><Badge color="forest" variant="light">
      {localization.translate(`jobMatch.coverage.${group?.coverage ?? 'uncovered'}`)}
    </Badge></Group>
    <Text size="sm">{requirement.importanceRationale}</Text>
    <Text size="sm"><strong>{localization.translate('jobMatch.sourceExcerpt')}:</strong>{' '}
      {requirement.sourceExcerpt}</Text>
    <Text size="sm"><strong>{localization.translate('jobMatch.evidence')}:</strong>{' '}
      {evidenceValues.length === 0
        ? localization.translate('jobMatch.evidence.none')
        : evidenceValues.join(' · ')}</Text>
  </Stack></Paper>
}

function JobMatchFailure({ failure, localization }: Readonly<{
  failure: JobMatchFailureValue
  localization: Localization
}>) {
  if (failure === null) return null
  return <Text c="danger.8" role="alert">
    {localization.translate(jobMatchFailureKeys[failure])}
  </Text>
}

type JobMatchFailureValue =
  | 'candidate-session-storage-unavailable'
  | 'empty-job-posting'
  | 'invalid-job-posting'
  | 'job-posting-extraction-unavailable'
  | 'match-evidence-unavailable'
  | 'oversized-job-posting'
  | 'processing-consent-required'
  | 'scanned-job-posting'
  | 'unreadable-job-posting'
  | 'unsupported-job-posting'
  | null

const jobMatchFailureKeys = {
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

function readBandColor({ band }: Readonly<{ band: JobMatch['analysis']['matchBand'] }>) {
  if (band === 'strong') return 'forest'
  if (band === 'credible') return 'informative'
  return 'caution'
}
