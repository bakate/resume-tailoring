import { describe, expect, it } from 'vitest'

import {
  isQualifiedModelConfiguration,
  recordedModelQualificationReports,
} from './qualified-model-configurations'

describe('qualified model configurations', () => {
  it('derives fallback eligibility from passing recorded reports', () => {
    expect(recordedModelQualificationReports.every(({ qualified }) => qualified)).toBe(true)
    expect(isQualifiedModelConfiguration({
      model: 'gpt-6-luna', reasoningEffort: 'low', role: 'structured',
    })).toBe(true)
  })

  it('rejects a configuration without a passing recorded report', () => {
    expect(isQualifiedModelConfiguration({
      model: 'gpt-6-sol', reasoningEffort: 'medium', role: 'structured',
    })).toBe(false)
  })
})
