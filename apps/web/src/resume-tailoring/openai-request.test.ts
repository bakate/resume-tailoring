import { describe, expect, it, vi } from 'vitest'

import { createOpenAiRequester, createOpenAiRequestDeadline } from './openai-request'

describe('OpenAI request policy', () => {
  it('creates a deadline with thirty seconds of Lambda response headroom', () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout')

    createOpenAiRequestDeadline()

    expect(timeout).toHaveBeenCalledWith(90_000)
    timeout.mockRestore()
  })

  it('reuses a supplied deadline across requests', async () => {
    const deadlineSignal = new AbortController().signal
    const signals: (AbortSignal | null)[] = []
    const requester = createOpenAiRequester({
      apiKey: 'test-api-key',
      request: (_input, init) => {
        signals.push(init?.signal ?? null)
        return Promise.resolve(Response.json({ output: [] }))
      },
    })

    await requester.send({ body: {}, deadlineSignal, operation: 'match-analysis' })
    await requester.send({ body: {}, deadlineSignal, operation: 'match-analysis' })

    expect(signals).toEqual([deadlineSignal, deadlineSignal])
  })

  it('reports a privacy-safe timeout without request content or credentials', async () => {
    const writeLog = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const requester = createOpenAiRequester({
      apiKey: 'private-api-key',
      request: () => Promise.reject(new DOMException('Timed out', 'TimeoutError')),
    })

    const result = await requester.send({
      body: { professionalContent: 'Private Candidate history' },
      operation: 'source-profile-extraction',
    })

    expect(result).toEqual({ ok: false })
    expect(writeLog).toHaveBeenCalledOnce()
    const serializedMetric = String(writeLog.mock.calls.at(0)?.at(0))
    expect(serializedMetric).toContain('"cause":"timeout"')
    expect(serializedMetric).toContain('"operation":"source-profile-extraction"')
    expect(serializedMetric).not.toContain('Private Candidate history')
    expect(serializedMetric).not.toContain('private-api-key')
    writeLog.mockRestore()
  })
})
