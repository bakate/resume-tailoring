// Throwaway spike (BAK-171): measures DeepSeek JSON-mode conformance, provenance, tokens and latency on the
// repository's synthetic corpora. Not wired into the app, CI or `pnpm check`; see
// docs/evaluations/deepseek-spike-2026-10.md.
//
// It reuses the production OpenAI adapters unchanged: each accepts an injected `fetch`, and the shim below translates
// their Responses API body into a DeepSeek chat completion in JSON mode, then translates the answer back, so the
// production instructions, zod schemas and parsers decide conformance.
//
// Run from the repository root (the key is read from .env.local, never printed):
//   pnpm dlx tsx@4.20.3 --env-file=.env.local scripts/spikes/deepseek-conformance.mjs <out-dir> [runs] [operation]
// Raw model outputs are written to <out-dir>; keep it outside the repository.

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { prepareResumeSections } from '../../packages/resume-tailoring-application/src/resume-preparation.ts'
import { requestOpenAiJobPostingExtraction } from '../../apps/web/src/adapters/server/openai-job-posting-extractor.ts'
import { requestOpenAiJobMatchEvidence } from '../../apps/web/src/adapters/server/openai-job-match-evidence-matcher.ts'
import { createOpenAiResumeSectionWriter } from '../../apps/web/src/adapters/server/openai-resume-section-models.ts'
import { jobPostingExtractionSchema, matchEvidenceProposalSchema } from '../../apps/web/src/candidate-journey/job-match-schemas.ts'
import { resumeSectionOutputSchemas } from '../../apps/web/src/candidate-journey/resume-document-schemas.ts'
import { crossSegmentQualificationCorpus } from '../../apps/web/src/model-evaluation/cross-segment-corpus.ts'
import { frontEndAuditJobPosting } from '../../apps/web/src/model-evaluation/front-end-audit-corpus.ts'
import { realSizedResumeFixture } from '../../apps/web/src/model-evaluation/real-sized-resume-corpus.ts'

const apiKey = process.env.DEEPSEEK_API_KEY
if (apiKey === undefined || apiKey.length === 0) throw new Error('DEEPSEEK_API_KEY must be set in the local environment')
const [outDirectory, runsArgument = '20', onlyOperation] = process.argv.slice(2)
if (outDirectory === undefined) throw new Error('usage: deepseek-conformance.mjs <out-dir> [runs] [operation]')
const runCount = Number(runsArgument)
const operator = { source: 'operator', value: 'unused-openai-key' }

// The production efforts mapped onto DeepSeek's: structured `low` stays low, writing `medium` becomes high.
// DeepSeek counts reasoning inside max_tokens, so variants test thinking disabled and a raised budget.
const plans = [
  { operation: 'extraction', model: 'deepseek-flash', effort: 'low' },
  { operation: 'extraction', model: 'deepseek-flash', effort: 'none' },
  { operation: 'matching', model: 'deepseek-flash', effort: 'low' },
  { operation: 'matching', model: 'deepseek-flash', effort: 'low', maxTokens: 32_000 },
  { operation: 'matching', model: 'deepseek-flash', effort: 'none' },
  { operation: 'section-writing', model: 'deepseek-flash', effort: 'high' },
  { operation: 'section-writing', model: 'deepseek-v4-pro', effort: 'high' },
].filter(({ operation }) => onlyOperation === undefined || operation === onlyOperation)

/** Every model call, first attempt and retry alike; content stays on disk, never on stdout. */
const calls = []

await mkdir(outDirectory, { recursive: true })
for (const plan of plans) {
  const startedAt = Date.now()
  if (plan.operation === 'extraction') await runAll({ plan, inputs: extractionInputs(), call: callExtraction })
  if (plan.operation === 'matching') await runAll({ plan, inputs: matchingInputs(), call: callMatching })
  if (plan.operation === 'section-writing') await runSectionWriting({ plan })
  console.info(`${planName(plan)}: done in ${String(Math.round((Date.now() - startedAt) / 1000))}s`)
}
await writeFile(join(outDirectory, 'calls.json'), JSON.stringify(calls, null, 1))
console.info(JSON.stringify(summarize(), null, 1))

// Inputs: synthetic, fictional or anonymized corpora only.

function extractionInputs() {
  const fixtures = pickAcrossFamilies({ count: runCount - 8 })
  return [
    ...repeat({ count: 4, value: { inputId: realSizedResumeFixture.id, posting: realSizedResumeFixture.request.jobMatch.jobPosting.originalContent } }),
    ...repeat({ count: 4, value: { inputId: 'front-end-audit', posting: frontEndAuditJobPosting } }),
    ...fixtures.map((fixture) => ({ inputId: fixture.id, posting: fixture.jobPosting })),
  ]
}

function matchingInputs() {
  const { candidateFacts, jobMatch } = realSizedResumeFixture.request
  const realSized = { candidateFacts: candidateFacts.map((fact) => ({ id: fact.id, kind: kindOf(fact.path), value: fact.value })),
    requirements: jobMatch.requirements }
  // The corpus ids predate the production id contract (`source-fact-…`, `job-requirement-…`), so they are prefixed.
  const fixtures = pickAcrossFamilies({ count: runCount - 8 }).map((fixture) => ({ inputId: fixture.id, matchRequest: {
    candidateFacts: fixture.candidateFacts.map((fact) => ({ ...fact, id: `source-fact-${fact.id}` })),
    requirements: fixture.extractedRequirements.map((requirement) => ({ ...requirement, id: `job-requirement-${requirement.id}`,
      importanceRationale: requirement.importanceRationale ?? requirement.sourceExcerpt })),
  } }))
  return [...repeat({ count: 8, value: { inputId: realSizedResumeFixture.id, matchRequest: realSized } }), ...fixtures]
}

function pickAcrossFamilies({ count }) {
  const byFamily = Map.groupBy(crossSegmentQualificationCorpus.fixtures, ({ roleFamily }) => roleFamily)
  const families = [...byFamily.values()]
  return Array.from({ length: count }, (_, index) => {
    const family = families[index % families.length]
    return family[Math.floor(index / families.length) % family.length]
  })
}

function kindOf(path) {
  const section = path.split('.')[0]
  return { certifications: 'certification', education: 'education', experiences: 'experience', languages: 'language',
    projects: 'project', skills: 'skill' }[section]
}

// Operations: one production adapter call per attempt, retried once when the output does not conform.

async function callExtraction({ input, request }) {
  const result = await requestOpenAiJobPostingExtraction({ apiKey: operator, jobPostingContent: input.posting,
    model: 'unused', reasoningEffort: 'low', request })
  return { ok: result.ok, value: result.ok ? result.value : undefined,
    provenance: result.ok ? extractionProvenance({ extraction: result.value, posting: input.posting }) : undefined }
}

async function callMatching({ input, request }) {
  const result = await requestOpenAiJobMatchEvidence({ apiKey: operator, matchRequest: input.matchRequest,
    model: 'unused', reasoningEffort: 'low', request })
  return { ok: result.ok, value: result.ok ? result.value : undefined,
    provenance: result.ok ? matchingProvenance({ proposal: result.value, matchRequest: input.matchRequest }) : undefined }
}

async function runAll({ plan, inputs, call }) {
  await mapConcurrently({ items: inputs, concurrency: 4, run: async (input, runIndex) => {
    await attemptWithOneRetry({ plan, inputId: input.inputId, runIndex,
      attempt: (request) => call({ input, request }), schema: schemaFor({ operation: plan.operation }) })
  } })
}

/**
 * Section writing runs the production preparation on the real-sized resume, so the writer receives the section plan,
 * budgets and inputs a Candidate's preparation sends. Validation and coherence are stubbed as passing: this spike
 * measures the writer only, and reads its provenance from the output instead.
 */
async function runSectionWriting({ plan }) {
  let firstWrites = 0
  for (let preparationIndex = 0; firstWrites < runCount; preparationIndex += 1) {
    const writer = { write: async (input) => {
      if (input.rejectedFields.length === 0) firstWrites += 1
      let written
      await attemptWithOneRetry({ plan, inputId: `${realSizedResumeFixture.id}:${String(preparationIndex)}:${input.section.key}`,
        runIndex: preparationIndex, schema: resumeSectionOutputSchemas[input.section.kind],
        rewrite: input.rejectedFields.length > 0,
        attempt: async (request) => {
          written = await createOpenAiResumeSectionWriter({ apiKey: operator, model: 'unused', reasoningEffort: 'medium',
            request }).write(input)
          return { ok: written.ok, value: written.ok ? written.value : undefined,
            provenance: written.ok ? sectionProvenance({ content: written.value, input }) : undefined }
        } })
      return written
    } }
    const output = await prepareResumeSections({
      models: {
        writeSection: writer.write,
        validateFields: (input) => Promise.resolve({ ok: true, value: { fields: input.fields.map(({ id }) => ({ fieldId: id, supported: true })) } }),
        checkCoherence: () => Promise.resolve({ ok: true, value: { coherent: true, languageMatches: true, issues: [] } }),
      },
      now: () => performance.now(),
      recordTelemetry: () => undefined,
      request: realSizedResumeFixture.request,
      revision: `${realSizedResumeFixture.id}:deepseek:${plan.model}:${String(preparationIndex)}`,
    })
    console.info(`  preparation ${String(preparationIndex)} (${plan.model}): ${output.status}`)
  }
}

async function attemptWithOneRetry({ plan, inputId, runIndex, attempt, schema, rewrite = false }) {
  for (const attemptIndex of [0, 1]) {
    const exchange = {}
    const result = await attempt(createDeepSeekRequest({ plan, exchange }))
    const outcome = classify({ exchange, result, schema })
    calls.push({ plan: planName(plan), operation: plan.operation, model: plan.model, effort: plan.effort, inputId, runIndex, attemptIndex, rewrite,
      outcome: outcome.kind, schemaIssues: outcome.issues, latencyMilliseconds: exchange.latencyMilliseconds,
      finishReason: exchange.finishReason, usage: exchange.usage, provenance: result.provenance,
      output: exchange.content, reasoningCharacters: exchange.reasoningCharacters })
    if (outcome.kind === 'conformant') return
  }
}

function classify({ exchange, result, schema }) {
  if (exchange.transportFailure !== undefined) return { kind: `transport:${exchange.transportFailure}` }
  if (result.ok) return { kind: 'conformant' }
  if (exchange.content === undefined || exchange.content.trim().length === 0) return { kind: 'empty' }
  let parsed
  try { parsed = JSON.parse(exchange.content) } catch { return { kind: 'unparseable' } }
  const validation = schema.safeParse(parsed)
  // Parsed and schema-valid yet refused: a production rule beyond the schema (ids, source-backed excerpts, length).
  if (validation.success) return { kind: 'rejected-by-adapter' }
  return { kind: 'schema-invalid', issues: validation.error.issues.slice(0, 5).map(({ code, path }) => `${code}@${path.join('.')}`) }
}

function schemaFor({ operation }) {
  return operation === 'extraction' ? jobPostingExtractionSchema : matchEvidenceProposalSchema
}

// The DeepSeek shim: a `fetch` the production adapters call in place of the OpenAI Responses API.

function createDeepSeekRequest({ plan, exchange }) {
  return async (_url, init) => {
    const body = JSON.parse(init.body)
    const [developer, ...userMessages] = body.input
    const schema = body.text.format.schema
    const system = [
      readText(developer),
      'Answer with one json object only, no prose and no code fence. It must conform exactly to this JSON Schema:',
      'every required key present, no additional key, and null where a value is absent but nullable.',
      JSON.stringify(schema),
      'Example of the json shape (placeholder values, not content to reuse):',
      JSON.stringify(exampleFor({ schema, root: schema })),
    ].join('\n')
    const startedAt = performance.now()
    let response
    try {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST', signal: init.signal,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: plan.model,
          messages: [{ role: 'system', content: system }, ...userMessages.map((message) => ({ role: 'user', content: readText(message) }))],
          response_format: { type: 'json_object' },
          ...(plan.effort === 'none' ? { thinking: { type: 'disabled' } }
            : { thinking: { type: 'enabled' }, reasoning_effort: plan.effort }),
          max_tokens: plan.maxTokens ?? body.max_output_tokens,
          stream: false,
        }),
      })
    } catch (error) {
      exchange.latencyMilliseconds = Math.round(performance.now() - startedAt)
      exchange.transportFailure = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network'
      throw error
    }
    if (!response.ok) {
      exchange.latencyMilliseconds = Math.round(performance.now() - startedAt)
      exchange.transportFailure = `http-${String(response.status)}`
      return new Response('{}', { status: response.status })
    }
    // Timed once the whole body arrived: fetch resolves on the headers, long before a non-streamed answer ends.
    const completion = await response.json()
    exchange.latencyMilliseconds = Math.round(performance.now() - startedAt)
    const choice = completion.choices?.[0]
    exchange.content = choice?.message?.content ?? ''
    exchange.reasoningCharacters = choice?.message?.reasoning_content?.length ?? 0
    exchange.finishReason = choice?.finish_reason
    exchange.usage = {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      cacheHitTokens: completion.usage?.prompt_cache_hit_tokens ?? 0,
      cacheMissTokens: completion.usage?.prompt_cache_miss_tokens ?? completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      reasoningTokens: completion.usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    }
    return Response.json({
      status: choice?.finish_reason === 'length' ? 'incomplete' : 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: exchange.content }] }],
      usage: { input_tokens: exchange.usage.promptTokens, output_tokens: exchange.usage.completionTokens },
    })
  }
}

function readText(message) {
  return message.content.map(({ text }) => text).join('\n')
}

/** A placeholder instance of a JSON Schema, so the instructions show the shape as well as the rules. */
function exampleFor({ schema, root }) {
  if (schema.$ref !== undefined) {
    const name = schema.$ref.split('/').at(-1)
    return exampleFor({ schema: (root.definitions ?? root.$defs)[name], root })
  }
  const variants = schema.anyOf ?? schema.oneOf
  if (variants !== undefined) return exampleFor({ schema: variants.find((variant) => variant.type !== 'null') ?? variants[0], root })
  if (schema.const !== undefined) return schema.const
  if (schema.enum !== undefined) return schema.enum[0]
  const type = Array.isArray(schema.type) ? schema.type.find((candidate) => candidate !== 'null') : schema.type
  if (type === 'object') {
    return Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, property]) => [key, exampleFor({ schema: property, root })]))
  }
  if (type === 'array') return [exampleFor({ schema: schema.items ?? {}, root })]
  if (type === 'string') return schema.pattern === undefined ? '…' : `${schema.pattern.replace(/^\^|\.\*\$?$|\$$/gu, '').replace(/\(.*$/u, '')}1`
  if (type === 'integer' || type === 'number') return 0
  if (type === 'boolean') return true
  return null
}

// Provenance read from the output alone; the note complements it with a manual reading.

function extractionProvenance({ extraction, posting }) {
  const source = normalize(posting)
  const unbacked = extraction.requirements.filter(({ sourceExcerpt }) => !source.includes(normalize(sourceExcerpt)))
  return { requirementCount: extraction.requirements.length, unbackedExcerptCount: unbacked.length }
}

function matchingProvenance({ proposal, matchRequest }) {
  const facts = new Map(matchRequest.candidateFacts.map((fact) => [fact.id, normalize(fact.value)]))
  const requirementIds = new Set(matchRequest.requirements.map(({ id }) => id))
  const matches = [
    ...proposal.evidence.flatMap(({ factMatches, requirementId }) => factMatches.map((match) => ({ ...match, requirementId }))),
    ...proposal.relevance.map(({ factMatch, requirementId }) => ({ ...factMatch, requirementId })),
    ...proposal.adjacentEvidence.flatMap(({ factMatches, requirementId }) => factMatches.map((match) => ({ ...match, requirementId }))),
  ]
  return {
    factMatchCount: matches.length,
    unknownFactCount: matches.filter(({ factId }) => !facts.has(factId)).length,
    unknownRequirementCount: matches.filter(({ requirementId }) => !requirementIds.has(requirementId)).length,
    nonVerbatimExcerptCount: matches.filter(({ factId, factExcerpt }) => facts.has(factId)
      && !facts.get(factId).includes(normalize(factExcerpt))).length,
  }
}

function sectionProvenance({ content, input }) {
  const factIds = new Set(input.candidateFacts.map(({ id }) => id))
  const fields = collectFields(content)
  return {
    fieldCount: fields.length,
    uncitedFieldCount: fields.filter(({ factIds: cited }) => cited.length === 0).length,
    unknownFactFieldCount: fields.filter(({ factIds: cited }) => cited.some((id) => !factIds.has(id))).length,
    emDashFieldCount: fields.filter(({ text }) => text.includes('—')).length,
  }
}

function collectFields(value) {
  if (Array.isArray(value)) return value.flatMap(collectFields)
  if (value === null || typeof value !== 'object') return []
  if (typeof value.text === 'string' && Array.isArray(value.factIds)) return [value]
  return Object.values(value).flatMap(collectFields)
}

function normalize(text) {
  return text.toLowerCase().replace(/\s+/gu, ' ').trim()
}

// Summary: conformance before and after one retry, tokens and latency per operation and model.

function summarize() {
  const groups = Map.groupBy(calls, ({ plan }) => plan)
  return Object.fromEntries([...groups].map(([key, groupCalls]) => {
    const first = groupCalls.filter(({ attemptIndex }) => attemptIndex === 0)
    const retries = groupCalls.filter(({ attemptIndex }) => attemptIndex === 1)
    const latencies = groupCalls.map(({ latencyMilliseconds }) => latencyMilliseconds ?? 0).sort((left, right) => left - right)
    const outcomes = (list) => list.reduce((counts, { outcome }) => ({ ...counts, [outcome]: (counts[outcome] ?? 0) + 1 }), {})
    const sum = (field) => groupCalls.reduce((total, { usage }) => total + (usage?.[field] ?? 0), 0)
    return [key, {
      firstAttempts: first.length,
      firstAttemptOutcomes: outcomes(first),
      retryOutcomes: outcomes(retries),
      failingAfterOneRetry: retries.filter(({ outcome }) => outcome !== 'conformant').length,
      truncatedByLength: groupCalls.filter(({ finishReason }) => finishReason === 'length').length,
      latencyMilliseconds: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95) },
      meanTokensPerCall: Object.fromEntries(['promptTokens', 'cacheHitTokens', 'cacheMissTokens', 'completionTokens', 'reasoningTokens']
        .map((field) => [field, Math.round(sum(field) / groupCalls.length)])),
    }]
  }))
}

function planName({ operation, model, effort, maxTokens }) {
  return `${operation} ${model} effort:${effort}${maxTokens === undefined ? '' : ` max_tokens:${String(maxTokens)}`}`
}

function percentile(sorted, rank) {
  return sorted[Math.max(0, Math.ceil(sorted.length * rank) - 1)] ?? 0
}

function repeat({ count, value }) {
  return Array.from({ length: count }, () => value)
}

async function mapConcurrently({ items, concurrency, run }) {
  let next = 0
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const index = next
      next += 1
      await run(items[index], index)
    }
  }))
}
