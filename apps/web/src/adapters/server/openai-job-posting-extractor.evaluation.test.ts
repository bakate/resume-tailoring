import { describe, expect, it } from 'vitest'

import { validateServerEnvironment } from '../../env'
import {
  checkDistinctCapabilities,
  checkExcerptFidelity,
  checkGenericDuties,
  distinctCapabilityFixtures,
  extractJobPosting,
  genericDutiesFixtures,
} from '../../model-evaluation/job-posting-extraction-evaluation'
import type { ModelCallMeasurement } from './language-model-request'

// The same fixtures and checks feed the qualification runner (`job-posting-extraction` source).
describe('Job Posting extraction representative evaluation', () => {
  it.each(genericDutiesFixtures)('$name', async (fixture) => {
    const { calls, requirements } = await evaluateJobPosting({ jobPostingContent: fixture.jobPostingContent })
    const checks = [...checkGenericDuties({ fixture, requirements }),
      ...fixture.language === 'en' ? [] : checkExcerptFidelity({ jobPostingContent: fixture.jobPostingContent, requirements })]
    console.info(JSON.stringify({ name: fixture.name, calls: calls.map(summarizeCall), checks,
      requirements: requirements.map(summarizeRequirement) }))

    expect(checks.filter(({ passed }) => !passed)).toEqual([])
  }, 60_000)

  it.each(distinctCapabilityFixtures)('$name', async (fixture) => {
    const { calls, requirements } = await evaluateJobPosting({ jobPostingContent: fixture.jobPostingContent })
    const checks = checkDistinctCapabilities({ fixture, requirements })
    console.info(JSON.stringify({ name: fixture.name, calls: calls.map(summarizeCall), checks,
      requirements: requirements.map(summarizeRequirement) }))

    expect(checks.filter(({ passed }) => !passed)).toEqual([])
  }, 60_000)
})

async function evaluateJobPosting({ jobPostingContent }: Readonly<{ jobPostingContent: string }>) {
  const calls: ModelCallMeasurement[] = []
  const { languageModel } = readServerEnvironment()
  const requirements = await extractJobPosting({ jobPostingContent, connection: {
    apiKey: { value: languageModel.apiKey }, configuration: languageModel.structured.active,
    observeCall: (call) => { calls.push(call) },
  } })
  expect(requirements, 'Expected a source-backed Job Posting extraction').toBeDefined()
  expect(calls).toHaveLength(1)
  expect(calls[0]?.latencyMilliseconds).toBeLessThan(45_000)
  return { calls, requirements: requirements ?? [] }
}

function summarizeCall({ latencyMilliseconds, outcome, usage }: ModelCallMeasurement) {
  return { latencyMilliseconds, outcome, usage }
}

function summarizeRequirement({ importance, sourceExcerpt, value }:
NonNullable<Awaited<ReturnType<typeof extractJobPosting>>>[number]) {
  return { importance, sourceExcerpt, value }
}

/** The structured role the extraction route uses, validated as the server validates it. */
function readServerEnvironment() {
  const environment = validateServerEnvironment({ environment: process.env })
  if (!environment.ok) throw new Error('A Language Model Provider key must be configured for live evaluation')
  return environment.value
}
