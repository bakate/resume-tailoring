import { describe, expect, it } from 'vitest'
import { groupedResumeDocument, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { createOpenAiResumeDocumentWriter, createOpenAiResumeDocumentValidator } from './openai-resume-document-models'

describe('Resume document model adapters', () => {
  it('uses the configured writing role for a complete semantic document', async () => {
    let body: Record<string, unknown> | null = null
    const document = professionalDocument()
    const writer = createOpenAiResumeDocumentWriter({ apiKey: 'test-key', model: 'writing-role', reasoningEffort: 'medium',
      request: (_url, options) => { body = JSON.parse(typeof options?.body === 'string' ? options.body : '{}') as Record<string, unknown>
        return Promise.resolve(Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(document) }] }] })) } })

    const outcome = await writer.write({ candidateFacts: structuredResumeSource.candidateFacts,
      jobMatch: structuredResumeJobMatch, locale: 'fr', purpose: 'tailored' })

    expect(outcome).toEqual({ ok: true, value: document })
    expect(body).toMatchObject({ model: 'writing-role', store: false })
    expect(JSON.stringify(body)).not.toContain('alex@example.com')
    expect(JSON.stringify(body)).not.toContain('Alex Morgan')
  })

  it('returns complete field-level semantic validation from the structured role', async () => {
    const validation = { coherent: false, languageMatches: true,
      fields: [{ fieldId: 'summary-billing', supported: false }] }
    const document = professionalDocument()
    const validator = createOpenAiResumeDocumentValidator({ apiKey: 'test-key', model: 'structured-role', reasoningEffort: 'low',
      request: () => Promise.resolve(Response.json({ output: [{ content: [{ type: 'output_text', text: JSON.stringify(validation) }] }] })) })

    const outcome = await validator.validate({ candidateFacts: structuredResumeSource.candidateFacts, document })

    expect(outcome).toEqual({ ok: true, value: validation })
  })

  it.each([['malformed', { output: [{ content: [{ type: 'output_text', text: '{}' }] }] }],
    ['incomplete', { status: 'incomplete', output: [] }]])('fails closed on %s output', async (_label, response) => {
    const writer = createOpenAiResumeDocumentWriter({ apiKey: 'test-key', model: 'writing-role', reasoningEffort: 'medium',
      request: () => Promise.resolve(Response.json(response)) })

    const outcome = await writer.write({ candidateFacts: structuredResumeSource.candidateFacts,
      jobMatch: structuredResumeJobMatch, locale: 'en', purpose: 'tailored' })

    expect(outcome).toEqual({ ok: false, error: { type: 'unavailable' } })
  })

  it('marks an upstream outage as transient without retrying inside the adapter', async () => {
    const writer = createOpenAiResumeDocumentWriter({ apiKey: 'test-key', model: 'writing-role', reasoningEffort: 'medium',
      request: () => Promise.resolve(new Response(null, { status: 503 })) })

    const outcome = await writer.write({ candidateFacts: structuredResumeSource.candidateFacts,
      jobMatch: structuredResumeJobMatch, locale: 'en', purpose: 'tailored' })

    expect(outcome).toEqual({ ok: false, error: { type: 'unavailable', transient: true } })
  })
})

function professionalDocument() {
  const { purpose, locale, targetRole, valueProposition, experiences, sections } = groupedResumeDocument
  return { purpose, locale, targetRole, valueProposition, experiences, sections }
}
