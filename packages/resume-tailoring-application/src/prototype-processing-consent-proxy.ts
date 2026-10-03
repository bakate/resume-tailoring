/**
 * PROTOTYPE (throwaway, branch prototype/bak-85-bind-processing-consent). Answers: can one generic Protection Proxy
 * bind Processing Consent around every model-backed port, with each port's own typed refusal?
 */
type AsyncMethod = (...parameters: never[]) => Promise<unknown>
type PortRecord = Readonly<Record<string, Readonly<Record<string, AsyncMethod>>>>

/** The refusal each method returns instead of reaching the Language Model Provider: one of its own failures. */
export type ConsentRefusals<TPorts extends PortRecord> = {
  readonly [Port in keyof TPorts]: {
    readonly [Method in keyof TPorts[Port]]: Extract<Awaited<ReturnType<TPorts[Port][Method]>>, Readonly<{ ok: false }>>
  }
}

/**
 * Identifies the Processing Consent a call was made under, or null without consent to the current Processing Policy.
 * A reply is kept only while the scope is unchanged, so a Candidate Session deleted and reopened also drops it.
 */
export type ReadConsentScope = () => string | null

export function bindProcessingConsent<TPorts extends PortRecord>({ ports, refusals, readConsentScope }: Readonly<{
  ports: TPorts
  refusals: ConsentRefusals<TPorts>
  readConsentScope: ReadConsentScope
}>): TPorts {
  return Object.fromEntries(Object.entries(ports).map(([portName, port]) => [portName,
    Object.fromEntries(Object.entries(port).map(([methodName, method]) => {
      const refusal = (refusals as Record<string, Record<string, unknown>>)[portName]?.[methodName]
      return [methodName, async (...parameters: never[]) => {
        const scope = readConsentScope()
        if (scope === null) return refusal
        const result = await method(...parameters)
        return readConsentScope() === scope ? result : refusal
      }]
    }))])) as TPorts
}
