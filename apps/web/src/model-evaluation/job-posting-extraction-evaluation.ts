import { createJobMatch, type JobMatch } from '@resume-tailoring/application/job-match'

import type { ModelCallMeasurement, ModelConnection } from '../adapters/server/language-model-request'
import { createModelJobPostingExtractor } from '../adapters/server/model-job-posting-extractor'
import { liveModelEvaluationThresholds } from './model-evaluation-baselines'
import { createModelEvaluationObservation, type ModelObservationSource } from './model-qualification-runner'

type JobRequirement = JobMatch['requirements'][number]

/** One named property a Job Posting extraction must hold; what the live evaluation asserts and qualification counts. */
type JobPostingCheck = Readonly<{ name: string; passed: boolean }>

/** Extracts one Job Posting through the production extractor and Job Match, without matching evidence. */
export async function extractJobPosting({ connection, jobPostingContent }: Readonly<{
  connection: ModelConnection
  jobPostingContent: string
}>): Promise<readonly JobRequirement[] | undefined> {
  const result = await createJobMatch({
    candidateFacts: [],
    now: Date.now,
    document: { bytes: new TextEncoder().encode(jobPostingContent), mediaType: 'text/plain', name: 'job-posting.txt' },
    jobPostingDocumentReader: { read: (document) => Promise.resolve({
      ok: true, value: { text: new TextDecoder().decode(document.bytes) },
    }) },
    jobPostingExtractor: createModelJobPostingExtractor(connection),
    matchEvidenceMatcher: { match: () => Promise.resolve({
      ok: true, value: { adjacentEvidence: [], evidence: [], relevance: [] },
    }) },
  })
  return result.ok ? result.value.requirements : undefined
}

/** Generic duties collapse into one complementary requirement; emphasis reads central; mandatory wording critical. */
function checkGenericDuties({ fixture, requirements }: Readonly<{
  fixture: GenericDutiesFixture
  requirements: readonly JobRequirement[]
}>): readonly JobPostingCheck[] {
  const dutyRequirements = requirements.filter((requirement) =>
    fixture.genericDuties.some((duty) => citesTerm({ requirement, term: duty })))
  return [
    { name: 'generic duties form one requirement', passed: dutyRequirements.length === 1 },
    { name: 'that requirement cites every generic duty', passed: dutyRequirements.length > 0
      && fixture.genericDuties.every((duty) => dutyRequirements.every((requirement) => citesTerm({ requirement, term: duty }))) },
    { name: 'generic duties are complementary', passed: dutyRequirements[0]?.importance === 'complementary' },
    { name: 'the emphasized responsibility is central', passed: hasOneCiting({ importance: 'central', requirements,
      term: fixture.emphasizedResponsibility }) },
    { name: 'the mandatory capability is critical', passed: hasOneCiting({ importance: 'critical', requirements,
      term: fixture.mandatoryCapability }) },
  ]
}

/** Each technical capability listed in one sentence keeps its own critical requirement. */
function checkDistinctCapabilities({ fixture, requirements }: Readonly<{
  fixture: DistinctCapabilityFixture
  requirements: readonly JobRequirement[]
}>): readonly JobPostingCheck[] {
  return fixture.technicalCapabilities.flatMap((capability) => {
    const capabilityRequirements = requirements.filter(({ value }) => includesTerm({ term: capability, value }))
    const owned = capabilityRequirements.length === 1 && capabilityRequirements[0] !== undefined
      && fixture.technicalCapabilities.filter((other) =>
        includesTerm({ term: other, value: capabilityRequirements[0]?.value ?? '' })).length === 1
    return [
      { name: `${capability} has its own requirement`, passed: owned },
      { name: `${capability} is critical`, passed: capabilityRequirements.length > 0
        && capabilityRequirements.every(({ importance }) => importance === 'critical') },
    ]
  })
}

/** Multilingual fidelity: every excerpt is copied from the posting in its own language, never translated. */
export function checkExcerptFidelity({ jobPostingContent, requirements }: Readonly<{
  jobPostingContent: string
  requirements: readonly JobRequirement[]
}>): readonly JobPostingCheck[] {
  return requirements.map(({ id, sourceExcerpt }) => ({ name: `${id} is copied from the posting`,
    passed: normalize({ value: jobPostingContent }).includes(normalize({ value: sourceExcerpt })) }))
}

export const jobPostingExtractionSource: ModelObservationSource = {
  id: 'job-posting-extraction',
  roles: ['structured'],
  observe: async ({ connect }) => {
    const connection = connect('structured')
    const observations = []
    for (const fixture of [...genericDutiesFixtures, ...distinctCapabilityFixtures]) {
      const calls: ModelCallMeasurement[] = []
      const requirements = await extractJobPosting({ jobPostingContent: fixture.jobPostingContent, connection: {
        ...connection, observeCall: (call) => { calls.push(call); connection.observeCall?.(call) } } }) ?? []
      const checks = 'genericDuties' in fixture
        ? checkGenericDuties({ fixture, requirements })
        : checkDistinctCapabilities({ fixture, requirements })
      // Latency is gated by p95 over every call; a live run still holds each posting to one call within the budget.
      const answered = [{ name: 'one extraction call answered within the latency budget', passed: calls.length === 1
        && calls.every(({ latencyMilliseconds }) => latencyMilliseconds < extractionCallBudgetMilliseconds) }]
      const fidelity = fixture.language === 'en' || requirements.length === 0 ? [] : checkExcerptFidelity({
        jobPostingContent: fixture.jobPostingContent, requirements })
      observations.push(createModelEvaluationObservation({ fixtureId: fixture.id,
        extractionExpectedCount: checks.length, extractionMatchedCount: countPassed(checks),
        // A non-English posting that yields nothing has failed fidelity too.
        multilingualCheckCount: fixture.language === 'en' ? 0 : Math.max(1, fidelity.length),
        multilingualPassedCount: countPassed(fidelity),
        observedValues: [...checks, ...answered].filter(({ passed }) => !passed).map(({ name }) => `failed:${name}`) }))
    }
    return observations
  },
}

const extractionCallBudgetMilliseconds = liveModelEvaluationThresholds.structured.p95LatencyMilliseconds

function countPassed(checks: readonly JobPostingCheck[]) {
  return checks.filter(({ passed }) => passed).length
}

function hasOneCiting({ importance, requirements, term }: Readonly<{
  importance: JobRequirement['importance']
  requirements: readonly JobRequirement[]
  term: string
}>) {
  const citing = requirements.filter((requirement) => citesTerm({ requirement, term }))
  return citing.length === 1 && citing[0]?.importance === importance
}

function citesTerm({ requirement, term }: Readonly<{ requirement: JobRequirement; term: string }>) {
  return includesTerm({ term, value: requirement.sourceExcerpt })
}

function includesTerm({ term, value }: Readonly<{ term: string; value: string }>) {
  return normalize({ value }).includes(normalize({ value: term }))
}

function normalize({ value }: Readonly<{ value: string }>) {
  return value.normalize('NFKC').toLocaleLowerCase('fr').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

type GenericDutiesFixture = typeof genericDutiesFixtures[number]
type DistinctCapabilityFixture = typeof distinctCapabilityFixtures[number]

const genericDutiesFixtures = [
  {
    id: 'generic-duties-en',
    language: 'en',
    name: 'One sentence of generic duties yields one requirement',
    jobPostingContent: [
      'We are hiring a Senior Product Engineer.',
      'Your core mission is to own the architecture of our payments platform.',
      'You will define features, ensure quality and collaborate with product managers.',
      'Strong TypeScript experience is required.',
    ].join('\n'),
    genericDuties: ['define features', 'ensure quality', 'collaborate with product managers'],
    emphasizedResponsibility: 'architecture of our payments platform',
    mandatoryCapability: 'TypeScript',
  },
  {
    id: 'generic-duties-fr',
    language: 'fr',
    name: 'Une phrase de missions génériques produit une seule exigence',
    jobPostingContent: [
      'Nous recrutons un Développeur Full Stack.',
      'Votre mission principale est de concevoir et faire évoluer notre plateforme de paiement.',
      'Vous définirez les fonctionnalités, garantirez la qualité et collaborerez avec les product managers.',
      'La maîtrise de React est obligatoire.',
    ].join('\n'),
    genericDuties: ['définirez les fonctionnalités', 'garantirez la qualité',
      'collaborerez avec les product managers'],
    emphasizedResponsibility: 'plateforme de paiement',
    mandatoryCapability: 'React',
  },
] as const

const distinctCapabilityFixtures = [
  {
    id: 'distinct-capabilities-en',
    language: 'en',
    name: 'Distinct technical capabilities in one sentence stay separate',
    jobPostingContent: [
      'We are hiring a Backend Engineer.',
      'Production experience with PostgreSQL, Kafka and Kubernetes is required.',
      'You will define features, ensure quality and collaborate with product managers.',
    ].join('\n'),
    technicalCapabilities: ['PostgreSQL', 'Kafka', 'Kubernetes'],
  },
] as const
