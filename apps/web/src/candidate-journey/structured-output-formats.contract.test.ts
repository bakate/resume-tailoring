import { describe, expect, it } from 'vitest'
import { jobPostingExtractionResponseFormat, matchEvidenceResponseFormat } from './job-match-schemas'
import { resumeDocumentCoherenceSchema, resumeFieldValidationSchema, resumeSectionOutputSchemas, resumeStructuredOutputFormat } from './resume-document-schemas'
import { structuredSourceProfileResponseFormat } from './structured-source-profile-schema'

const structuredOutputFormats = {
  'job posting extraction': jobPostingExtractionResponseFormat,
  'match evidence': matchEvidenceResponseFormat,
  'resume section validation': resumeStructuredOutputFormat({ name: 'resume_section_validation', schema: resumeFieldValidationSchema }),
  'resume document coherence': resumeStructuredOutputFormat({ name: 'resume_document_coherence', schema: resumeDocumentCoherenceSchema }),
  ...Object.fromEntries(Object.entries(resumeSectionOutputSchemas).map(([kind, schema]) => [`resume ${kind} section writing`,
    resumeStructuredOutputFormat({ name: `resume_section_${kind.replaceAll('-', '_')}`, schema })])),
  'structured source profile': structuredSourceProfileResponseFormat,
}

describe('Structured output formats', () => {
  it.each(Object.entries(structuredOutputFormats))('keeps the %s schema within strict structured-output rules', (_name, format) => {
    const violations = findStrictSchemaViolations({ path: '$', schema: format.schema })

    expect(format.strict).toBe(true)
    expect(violations).toEqual([])
  })
})

function findStrictSchemaViolations({ path, schema }: Readonly<{ path: string; schema: unknown }>): string[] {
  if (Array.isArray(schema)) return schema.flatMap((item, index) => findStrictSchemaViolations({ path: `${path}[${String(index)}]`, schema: item }))
  if (typeof schema !== 'object' || schema === null) return []
  const node = schema as Record<string, unknown>
  const unsupported = Object.keys(node).filter((keyword) => !strictSchemaKeywords.has(keyword))
    .map((keyword) => `${path} uses unsupported keyword ${keyword}`)
  return [...unsupported, ...findObjectViolations({ node, path }), ...Object.entries(node).flatMap(([keyword, value]) =>
    keyword === 'properties' && typeof value === 'object' && value !== null
      ? Object.entries(value).flatMap(([property, child]) => findStrictSchemaViolations({ path: `${path}.${property}`, schema: child }))
      : findStrictSchemaViolations({ path: `${path}.${keyword}`, schema: value }))]
}

function findObjectViolations({ node, path }: Readonly<{ node: Record<string, unknown>; path: string }>) {
  if (node.type !== 'object') return []
  const properties = Object.keys(node.properties ?? {})
  const required = Array.isArray(node.required) ? node.required : []
  return [
    ...node.additionalProperties === false ? [] : [`${path} allows additional properties`],
    ...properties.filter((property) => !required.includes(property)).map((property) => `${path}.${property} is optional`),
  ]
}

// Keywords OpenAI accepts in strict mode; oneOf and allOf are rejected with HTTP 400.
const strictSchemaKeywords = new Set([
  '$schema', 'additionalProperties', 'anyOf', 'const', 'description', 'enum', 'format', 'items', 'maxItems',
  'maxLength', 'maximum', 'minItems', 'minLength', 'minimum', 'pattern', 'properties', 'required', 'type',
])
