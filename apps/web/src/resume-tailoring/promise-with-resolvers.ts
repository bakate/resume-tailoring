type PromiseCapability<TValue> = Readonly<{
  promise: Promise<TValue>
  reject: (reason?: unknown) => void
  resolve: (value: TValue | PromiseLike<TValue>) => void
}>

type CompatiblePromiseConstructor = Readonly<{
  withResolvers?: <TValue>() => PromiseCapability<TValue>
}>

export function installPromiseWithResolvers() {
  const compatiblePromise = Promise as unknown as CompatiblePromiseConstructor
  if (compatiblePromise.withResolvers !== undefined) return
  Object.defineProperty(compatiblePromise, 'withResolvers', {
    configurable: true,
    value: createPromiseCapability,
    writable: true,
  })
}

function createPromiseCapability<TValue>(this: PromiseConstructor): PromiseCapability<TValue> {
  let resolvePromise: (value: TValue | PromiseLike<TValue>) => void = (value) => {
    void value
  }
  let rejectPromise: (reason?: unknown) => void = (reason) => {
    void reason
  }
  const promise = new this<TValue>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, reject: rejectPromise, resolve: resolvePromise }
}
