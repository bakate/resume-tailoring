import { describe, expect, it } from 'vitest'
import { resumeSectionKinds } from '@resume-tailoring/application/candidate-journey'
import type { ResumeSectionContent, ResumeSectionKind, ResumeSectionWritingInput } from '@resume-tailoring/application/candidate-journey'
import { readResumeSection, groupedResumeDocument, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createOpenAiResumeCoherenceChecker, createOpenAiResumeFieldValidator, createOpenAiResumeSectionWriter } from './openai-resume-section-models'
import { resumeSectionWritingInputSchema } from '../../candidate-journey/resume-document-schemas'

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

  it('accepts a coherence rewrite with the previous version of its section and passes it to the writer', async () => {
    let body: RequestBody | null = null
    const previousContent = readResumeSection({ document: groupedResumeDocument, section: sectionFor('skills') })
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: (_url, options) => {
      body = readBody(options)
      return Promise.resolve(Response.json(modelResponse(sectionOutput(previousContent))))
    } })
    const input = resumeSectionWritingInputSchema.parse({ ...writingInput('skills'), previousContent,
      rejectedFields: [{ fieldId: 'skills-0', text: 'Languages', reason: 'skill-category' },
        { fieldId: 'skills-1', text: 'Kubernetes', reason: 'unsupported', unsupportedProposition: 'Kubernetes appears in none of the cited facts' }] })

    await writer.write(input)

    expect(input.previousContent).toEqual(previousContent)
    expect(input.rejectedFields[1]).toMatchObject({ unsupportedProposition: 'Kubernetes appears in none of the cited facts' })
    expect(readModelInput(body)).toMatchObject({ previousContent })
  })

  it('accepts a rewrite with the fields its structure was rejected for and passes them to the writer', async () => {
    let body: RequestBody | null = null
    const content = readResumeSection({ document: groupedResumeDocument, section: sectionFor('experience') })
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: (_url, options) => {
      body = readBody(options)
      return Promise.resolve(Response.json(modelResponse(sectionOutput(content))))
    } })
    const rejectedFields = [{ fieldId: 'experiences.0.role', text: 'Frontend Engineer building accessible screens', reason: 'misplaced-fact' },
      { fieldId: 'experiences.0.organization', text: '', reason: 'missing-field' }]
    const input = resumeSectionWritingInputSchema.parse({ ...writingInput('experience'), rejectedFields })

    await writer.write(input)

    expect(readModelInput(body)).toMatchObject({ rejectedFields })
  })

  it('accepts an experience with the class and achievement budget code set and passes them to the writer', async () => {
    let body: RequestBody | null = null
    const content = readResumeSection({ document: groupedResumeDocument, section: sectionFor('experience') })
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: (_url, options) => {
      body = readBody(options)
      return Promise.resolve(Response.json(modelResponse(sectionOutput(content))))
    } })
    const experienceShape = { chronology: 'relevant', achievementBudget: 6 } as const
    const input = resumeSectionWritingInputSchema.parse({ ...writingInput('experience'),
      section: { ...sectionFor('experience'), experienceShape } })

    await writer.write(input)

    expect(readModelInput(body)).toMatchObject({ section: { key: 'experiences.0', experienceShape } })
  })

  it('validates only the fields of one section against the facts they cite', async () => {
    const validation = { fields: [{ fieldId: 'degree', supported: false, unsupportedProposition: 'The cited facts name no degree' },
      { fieldId: 'institution', supported: true, unsupportedProposition: null }] }
    let body: RequestBody | null = null
    const validator = createOpenAiResumeFieldValidator({ ...structuredRole, request: (_url, options) => {
      body = readBody(options)
      return Promise.resolve(Response.json(modelResponse(validation)))
    } })

    const outcome = await validator.validate({ ...validationInput(), namesUnsupportedPropositions: true })

    // A supported field carries no proposition key, which a browser tab loaded before this field still accepts.
    expect(outcome).toMatchObject({ ok: true, value: { fields: [validation.fields[0], { fieldId: 'institution', supported: true }] } })
    expect(outcome.ok && outcome.value.fields[1]).not.toHaveProperty('unsupportedProposition')
    expect(body).toMatchObject({ model: 'structured-role', text: { format: { name: 'resume_section_validation', strict: true } } })
    expect(JSON.stringify(body)).not.toContain('namesUnsupportedPropositions')
  })

  it('withholds the unsupported proposition from a browser loaded before it could read one', async () => {
    const validation = { fields: [{ fieldId: 'degree', supported: false, unsupportedProposition: 'The cited facts name no degree' }] }
    const validator = createOpenAiResumeFieldValidator({ ...structuredRole,
      request: () => Promise.resolve(Response.json(modelResponse(validation))) })

    const outcome = await validator.validate(validationInput())

    expect(outcome).toMatchObject({ ok: true, value: { fields: [{ fieldId: 'degree', supported: false }] } })
    expect(outcome.ok && outcome.value.fields[0]).not.toHaveProperty('unsupportedProposition')
  })

  it('checks the assembled document for coherence and language and names the fields to rewrite', async () => {
    const coherence = { coherent: false, languageMatches: true, issues: [{ fieldId: 'summary-0', kind: 'redundant' }] }
    const checker = createOpenAiResumeCoherenceChecker({ ...structuredRole,
      request: () => Promise.resolve(Response.json(modelResponse(coherence))) })

    const { purpose, locale, targetRole, valueProposition, experiences, sections } = groupedResumeDocument
    const outcome = await checker.check({ document: { purpose, locale, targetRole, valueProposition, experiences, sections } })

    expect(outcome).toMatchObject({ ok: true, value: coherence })
  })

  it.each([['malformed', { output: [{ content: [{ type: 'output_text', text: '{}' }] }] }],
    ['incomplete', { status: 'incomplete', output: [] }]])('reports an invalid provider response on %s output', async (_label, response) => {
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: () => Promise.resolve(Response.json(response)) })

    const outcome = await writer.write(writingInput('skills'))

    expect(outcome).toEqual({ ok: false, error: { type: 'invalid-provider-response' } })
  })

  it('reports an upstream outage as an unavailable provider without retrying inside the adapter', async () => {
    let requests = 0
    const writer = createOpenAiResumeSectionWriter({ ...writingRole, request: () => {
      requests += 1
      return Promise.resolve(new Response(null, { status: 503 }))
    } })

    const outcome = await writer.write(writingInput('skills'))

    expect(outcome).toEqual({ ok: false, error: { type: 'provider-unavailable' } })
    expect(requests).toBe(1)
  })

  it('reports a provider rate limit with the delay it asks for', async () => {
    const writer = createOpenAiResumeSectionWriter({ ...writingRole,
      request: () => Promise.resolve(new Response(null, { status: 429, headers: { 'Retry-After': '12' } })) })

    const outcome = await writer.write(writingInput('skills'))

    expect(outcome).toEqual({ ok: false, error: { type: 'rate-limited', retryAfterSeconds: 12 } })
  })

  it('reports a request timeout as a timeout', async () => {
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
    relevantFactIds: [], rejectedFields: [], previousContent: null, candidateFacts: structuredResumeSource.candidateFacts.filter(({ path }) => kind === 'value-proposition'
      || path.startsWith(`${section.key}.`)) }
}

function validationInput() {
  return { section: sectionFor('education'), locale: 'en', purpose: 'tailored',
    fields: [{ id: 'degree', text: 'Computer Science degree', factIds: ['source-fact-education-0-qualification-0'] }],
    candidateFacts: structuredResumeSource.candidateFacts.filter(({ path }) => path.startsWith('education.')) } as const
}

function sectionOutput(content: ResumeSectionContent) {
  if (content.kind === 'experience') return content.experience
  if (content.kind === 'value-proposition') return { paragraphs: content.paragraphs }
  return content.kind === 'skills' ? { groups: content.groups } : { fields: content.fields }
}

function readModelInput(body: RequestBody | null): unknown {
  const input = body?.input as readonly Readonly<{ role: string; content: readonly Readonly<{ text: string }>[] }>[] | undefined
  return JSON.parse(input?.find(({ role }) => role === 'user')?.content[0]?.text ?? 'null')
}

function modelResponse(value: unknown) {
  return { output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
    usage: { input_tokens: 900, output_tokens: 120 } }
}

function readBody(options: RequestInit | undefined): RequestBody {
  return JSON.parse(typeof options?.body === 'string' ? options.body : '{}') as RequestBody
}
