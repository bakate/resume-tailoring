import { describe, expect, it } from 'vitest'
import { resumeSectionKinds } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionContent, ResumeSectionKind, ResumeSectionWritingInput } from '@resume-tailoring/application/candidate-journey'
import { readResumeSection, groupedResumeDocument, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createOpenAiResumeCoherenceChecker, createOpenAiResumeFieldValidator, createOpenAiResumeSectionWriter } from './openai-resume-section-models'

describe('Resume section model adapters', () => {
  it.each(resumeSectionKinds)('writes the %s section under its own strict structured-output schema', async (kind) => {
    let body: RequestBody | null = null
    const content = readResumeSection({ document: groupedResumeDocument, section: sectionFor(kind) })
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: (_url, options) => {
      body = readBody(options)
      return Promise.resolve(Response.json(modelResponse(sectionOutput(content))))
    } })

    const outcome = await writer.write(writingInput(kind))

    expect(outcome).toEqual({ ok: true, value: content, usage: { inputTokens: 900, outputTokens: 120 } })
    expect(body).toMatchObject({ model: 'writing-role', store: false,
      text: { format: { type: 'json_schema', strict: true, name: `resume_section_${kind.replaceAll('-', '_')}` } } })
    expect(JSON.stringify(body)).not.toContain('alex@example.com')
    expect(JSON.stringify(body)).not.toContain('Alex Morgan')
  })

  it('rewrites a section with the propositions its validation rejected and instructions not to reuse them', async () => {
    let body: RequestBody | null = null
    const content = readResumeSection({ document: groupedResumeDocument, section: sectionFor('value-proposition') })
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: (_url, options) => {
      body = readBody(options)
      return Promise.resolve(Response.json(modelResponse(sectionOutput(content))))
    } })
    const rejectedFields = [{ fieldId: 'summary-billing', text: 'Senior engineer with ten years of billing leadership.' }]

    await writer.write({ ...writingInput('value-proposition'), rejectedFields })

    const [instructions, request] = readMessages(body)
    expect(JSON.parse(request ?? '{}')).toMatchObject({ rejectedFields })
    expect(instructions).toContain('rejectedFields')
    expect(instructions).toContain('Never reuse them as written')
  })

  it('validates only the fields of one section against the facts they cite', async () => {
    const validation = { fields: [{ fieldId: 'degree', supported: false }] }
    let body: RequestBody | null = null
    const validator = createOpenAiResumeFieldValidator({ ...structuredRole, request: (_url, options) => {
      body = readBody(options)
      return Promise.resolve(Response.json(modelResponse(validation)))
    } })

    const outcome = await validator.validate({ section: sectionFor('education'), locale: 'en', purpose: 'tailored',
      fields: [{ id: 'degree', text: 'Computer Science degree', factIds: ['source-fact-education-0-qualification-0'] }],
      candidateFacts: structuredResumeSource.candidateFacts.filter(({ path }) => path.startsWith('education.')) })

    expect(outcome).toMatchObject({ ok: true, value: validation })
    expect(body).toMatchObject({ model: 'structured-role', text: { format: { name: 'resume_section_validation', strict: true } } })
  })

  it('checks the assembled document for coherence and language only', async () => {
    const coherence = { coherent: false, languageMatches: true }
    const checker = createOpenAiResumeCoherenceChecker({ ...structuredRole,
      request: () => Promise.resolve(Response.json(modelResponse(coherence))) })

    const { purpose, locale, targetRole, valueProposition, experiences, sections } = groupedResumeDocument
    const outcome = await checker.check({ document: { purpose, locale, targetRole, valueProposition, experiences, sections } })

    expect(outcome).toMatchObject({ ok: true, value: coherence })
  })

  it.each([['malformed', { output: [{ content: [{ type: 'output_text', text: '{}' }] }] }],
    ['incomplete', { status: 'incomplete', output: [] }]])('fails permanently on %s output', async (_label, response) => {
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: () => Promise.resolve(Response.json(response)) })

    const outcome = await writer.write(writingInput('skills'))

    expect(outcome).toEqual({ ok: false, error: { type: 'permanent' } })
  })

  it('marks an upstream outage as transient without retrying inside the adapter', async () => {
    let requests = 0
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: () => {
      requests += 1
      return Promise.resolve(new Response(null, { status: 503 }))
    } })

    const outcome = await writer.write(writingInput('skills'))

    expect(outcome).toEqual({ ok: false, error: { type: 'transient' } })
    expect(requests).toBe(1)
  })

  it('reports a request timeout as a timeout, which is never retried', async () => {
    const writer = createOpenAiResumeSectionWriter({ ...writingRole,
      request: () => Promise.reject(new DOMException('The operation timed out.', 'TimeoutError')) })

    const outcome = await writer.write(writingInput('skills'))

    expect(outcome).toEqual({ ok: false, error: { type: 'timeout' } })
  })
})

type RequestBody = Record<string, unknown>

const writingRole = { apiKey: 'test-key', model: 'writing-role', reasoningEffort: 'medium' } as const
const structuredRole = { apiKey: 'test-key', model: 'structured-role', reasoningEffort: 'low' } as const

function sectionFor(kind: ResumeSectionKind) {
  return { key: kind === 'experience' ? 'experiences.0' : kind, kind }
}

function writingInput(kind: ResumeSectionKind): ResumeSectionWritingInput {
  const section = sectionFor(kind)
  return { section, locale: 'en', purpose: 'tailored', targetRole: 'Frontend Engineer', jobRequirements: ['React'],
    relevantFactIds: [], rejectedFields: [], candidateFacts: structuredResumeSource.candidateFacts.filter(({ path }) => kind === 'value-proposition'
      || path.startsWith(`${section.key}.`)) }
}

function sectionOutput(content: ResumeSectionContent) {
  if (content.kind === 'experience') return content.experience
  if (content.kind === 'value-proposition') return { paragraphs: content.paragraphs }
  return content.kind === 'skills' ? { groups: content.groups } : { fields: content.fields }
}

function modelResponse(value: unknown) {
  return { output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: { input_tokens: 900, output_tokens: 120 } }
}

function readMessages(body: RequestBody | null) {
  const input = (body?.input ?? []) as readonly Readonly<{ content: readonly Readonly<{ text: string }>[] }>[]
  return input.map(({ content }) => content[0]?.text)
}

function readBody(options: RequestInit | undefined): RequestBody {
  return JSON.parse(typeof options?.body === 'string' ? options.body : '{}') as RequestBody
}
