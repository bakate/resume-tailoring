import { MockLanguageModelV4 } from 'ai/test'

import type { LanguageModelProvider } from '../../language-model-configuration'
import type { LanguageModelProviderAdapter } from './language-model-request'

/** What a scripted model answers one call with, chosen by the structured output the call asks for. */
export type ScriptedModelAnswer = Readonly<{
  text: string
  usage?: Readonly<{ inputTokens: number; outputTokens: number }>
}>

/**
 * A Language Model Provider no production code names: tests register it to prove a path never branches on the
 * provider. It answers through the AI SDK's model interface, so the call wrapper runs exactly as for a real provider.
 */
export function createScriptedLanguageModelProvider({ answer, conformance = 'server-side' }: Readonly<{
  answer: (call: Readonly<{ model: string; outputName: string; userText: string }>) => ScriptedModelAnswer
  /** Client-side makes the call wrapper hold each answer to its schema and retry one that does not conform. */
  conformance?: LanguageModelProviderAdapter<LanguageModelProvider>['conformance']
}>): LanguageModelProviderAdapter<LanguageModelProvider> {
  return {
    classifyFailure: () => ({ type: 'transport' }),
    // By default the scripted model answers what it is told, and nothing checks its answer twice.
    conformance,
    createLanguageModel: ({ model }) => new MockLanguageModelV4({
      provider: 'scripted', modelId: model,
      doGenerate: ({ prompt, responseFormat }) => {
        const outputName = responseFormat?.type === 'json' ? responseFormat.name ?? '' : ''
        const userText = prompt.flatMap((message) => message.role === 'user'
          ? message.content.flatMap((part) => part.type === 'text' ? [part.text] : []) : []).join('\n')
        const { text, usage = { inputTokens: 100, outputTokens: 20 } } = answer({ model, outputName, userText })
        return Promise.resolve({
          content: [{ type: 'text', text }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: usage.inputTokens, noCache: usage.inputTokens, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: usage.outputTokens, text: usage.outputTokens, reasoning: 0 },
          },
          warnings: [],
        })
      },
    }),
    readInstructions: ({ instructions }) => instructions,
    // The scripted model reads no option; the configuration's options still decide whether it is qualified.
    readProviderOptions: () => ({}),
  }
}
