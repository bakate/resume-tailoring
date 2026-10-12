import { describe, expect, it } from 'vitest'

import { createScriptedLanguageModelProvider } from '../adapters/server/scripted-language-model-provider'
import { jobPostingExtractionSource } from './job-posting-extraction-evaluation'
import type { ModelConfiguration } from './model-qualification'
import { runModelQualification } from './model-qualification-runner'

describe('Job Posting extraction observations', () => {
  it('counts every extraction check and every French excerpt copied from its posting', async () => {
    const { recordedRun, report } = await qualifyExtraction({ answers: faithfulAnswers })

    expect(recordedRun.observations.filter(({ fixtureId }) => !fixtureId.includes(':call-')).map((observation) => ({
      fixtureId: observation.fixtureId, extraction: [observation.extractionMatchedCount, observation.extractionExpectedCount],
      multilingual: [observation.multilingualPassedCount, observation.multilingualCheckCount] }))).toEqual([
      { fixtureId: 'job-posting-extraction:generic-duties-en', extraction: [5, 5], multilingual: [0, 0] },
      { fixtureId: 'job-posting-extraction:generic-duties-fr', extraction: [5, 5], multilingual: [3, 3] },
      { fixtureId: 'job-posting-extraction:distinct-capabilities-en', extraction: [6, 6], multilingual: [0, 0] },
    ])
    expect(report.qualified).toBe(true)
  })

  it('fails multilingual fidelity when a French posting comes back translated', async () => {
    const { report } = await qualifyExtraction({ answers: { ...faithfulAnswers, 'Nous recrutons': [
      requirement({ excerpt: 'Your core mission is to design our payment platform.', importance: 'central', value: 'payment platform' }),
      requirement({ excerpt: 'You will define features, ensure quality and collaborate with product managers.',
        importance: 'complementary', value: 'Generic duties' }),
      requirement({ excerpt: 'React is mandatory.', importance: 'critical', value: 'React' }),
    ] } })

    expect(report.gates.multilingualFidelity).toEqual({ passed: false, threshold: 1, value: 0 })
    expect(report.qualified).toBe(false)
  })

  it('counts a check the extraction breaks, such as one requirement per generic duty', async () => {
    const { recordedRun } = await qualifyExtraction({ answers: { ...faithfulAnswers, 'Senior Product Engineer': [
      requirement({ excerpt: 'own the architecture of our payments platform', importance: 'central', value: 'Architecture' }),
      requirement({ excerpt: 'define features', importance: 'complementary', value: 'Define features' }),
      requirement({ excerpt: 'ensure quality', importance: 'complementary', value: 'Ensure quality' }),
      requirement({ excerpt: 'Strong TypeScript experience is required.', importance: 'critical', value: 'TypeScript' }),
    ] } })

    expect(recordedRun.observations[0]).toMatchObject({ extractionExpectedCount: 5, extractionMatchedCount: 3,
      observedValues: ['failed:generic duties form one requirement', 'failed:that requirement cites every generic duty'] })
  })
})

type ScriptedRequirement = ReturnType<typeof requirement>

async function qualifyExtraction({ answers }: Readonly<{ answers: Readonly<Record<string, readonly ScriptedRequirement[]>> }>) {
  const provider = createScriptedLanguageModelProvider({ answer: ({ userText }) => {
    const requirements = Object.entries(answers).find(([marker]) => userText.includes(marker))?.[1]
    if (requirements === undefined) throw new Error('No scripted answer for this Job Posting')
    return { text: JSON.stringify({ practicalConstraints: [], requirements, targetRole: null }) }
  } })
  return runModelQualification({ apiKey: { value: 'scripted-key' }, candidate: { configuration }, datasetId: 'scripted-v1',
    providers: { scripted: provider }, sources: [jobPostingExtractionSource],
    thresholds: { costUsd: 1, extractionRecall: 0.9, multilingualFidelity: 1, p95LatencyMilliseconds: 30_000 } })
}

function requirement({ excerpt, importance, value }: Readonly<{
  excerpt: string; importance: 'central' | 'complementary' | 'critical'; value: string
}>) {
  return { capability: { dimension: 'execution', name: value }, importance, importanceRationale: 'Scripted.',
    sourceExcerpt: excerpt, substitutableGroup: null, value }
}

const faithfulAnswers = {
  'Senior Product Engineer': [
    requirement({ excerpt: 'Your core mission is to own the architecture of our payments platform.', importance: 'central',
      value: 'own the architecture of our payments platform' }),
    requirement({ excerpt: 'You will define features, ensure quality and collaborate with product managers.',
      importance: 'complementary', value: 'define features, ensure quality and collaborate with product managers' }),
    requirement({ excerpt: 'Strong TypeScript experience is required.', importance: 'critical', value: 'Strong TypeScript experience' }),
  ],
  'Nous recrutons': [
    requirement({ excerpt: 'Votre mission principale est de concevoir et faire évoluer notre plateforme de paiement.',
      importance: 'central', value: 'concevoir et faire évoluer notre plateforme de paiement' }),
    requirement({ excerpt: 'Vous définirez les fonctionnalités, garantirez la qualité et collaborerez avec les product managers.',
      importance: 'complementary', value: 'définirez les fonctionnalités, garantirez la qualité et collaborerez avec les product managers' }),
    requirement({ excerpt: 'La maîtrise de React est obligatoire.', importance: 'critical', value: 'La maîtrise de React' }),
  ],
  'Backend Engineer': ['PostgreSQL', 'Kafka', 'Kubernetes'].map((value) => requirement({ importance: 'critical', value,
    excerpt: 'Production experience with PostgreSQL, Kafka and Kubernetes is required.' })),
}

// A provider production does not know, so the source is shown to run on any provider the runner is handed.
const configuration = {
  provider: 'scripted', model: 'scripted-structured', role: 'structured', providerOptions: {},
  pricing: [{ condition: 'peak', inputUsdPerMillionTokens: 1, outputUsdPerMillionTokens: 4 }],
} as unknown as ModelConfiguration
