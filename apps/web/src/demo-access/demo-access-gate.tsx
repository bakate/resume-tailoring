import { Button, Group, Modal, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'

import { LocalizationFailure, useLocalization } from '../localization/localization'
import type { Localization } from '../localization/localization'
import { demoAccessRecovery } from './demo-access-recovery'
import type { DemoAccessRenewal } from './demo-access-recovery'

const accessResponseSchema = z.object({
  ok: z.literal(true),
  value: z.discriminatedUnion('access', [
    z.object({ access: z.literal('granted') }),
    z.object({ access: z.literal('challenge-required'), siteKey: z.string().min(1) }),
  ]),
})

type GateState =
  | Readonly<{ status: 'checking' }>
  | Readonly<{ status: 'challenge'; siteKey: string }>
  | Readonly<{ status: 'granted' }>
  | Readonly<{ status: 'unavailable' }>

type TurnstileApi = Readonly<{
  remove: (widgetId: string) => void
  render: (container: HTMLElement, options: TurnstileOptions) => string
}>

type TurnstileOptions = Readonly<{
  sitekey: string
  appearance: 'interaction-only'
  callback: (token: string) => void
  'error-callback': () => void
  'expired-callback': () => void
}>

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export function DemoAccessGate({ children }: Readonly<{ children: ReactNode }>) {
  const localizationResult = useLocalization()
  const [state, setState] = useState<GateState>({ status: 'checking' })
  const refreshAccess = useCallback(() => {
    setState({ status: 'checking' })
    void readAccess().then(setState)
  }, [])
  const grantAccess = useCallback(() => {
    setState({ status: 'granted' })
  }, [])
  const showFailure = useCallback(() => {
    setState({ status: 'unavailable' })
  }, [])
  const [renewal, setRenewal] = useState<DemoAccessRenewal | null>(null)
  const isGranted = state.status === 'granted'
  useEffect(refreshAccess, [refreshAccess])
  useEffect(() => isGranted ? handleRenewals({ setRenewal }) : undefined, [isGranted])
  const closeRenewal = useCallback(() => { setRenewal(null) }, [])
  if (!localizationResult.ok) return <LocalizationFailure />
  if (isGranted) {
    return <>
      {children}
      {renewal === null
        ? null
        : <DemoAccessRenewalModal localization={localizationResult.value} onClose={closeRenewal} renewal={renewal} />}
    </>
  }
  const { translate } = localizationResult.value
  return (
    <main className="demo-access-gate">
      <p className="demo-access-brand">{translate('brand.name')}</p>
      <section aria-live="polite" className="demo-access-card">
        <h1>{translate('demoAccess.title')}</h1>
        <p>{translate('demoAccess.description')}</p>
        {state.status === 'checking'
          ? <p>{translate('demoAccess.verifying')}</p>
          : null}
        {state.status === 'challenge'
          ? <TurnstileChallenge
              onFailure={showFailure}
              onGranted={grantAccess}
              siteKey={state.siteKey}
            />
          : null}
        {state.status === 'unavailable'
          ? <button className="primary-action" onClick={refreshAccess} type="button">
              {translate('demoAccess.retry')}
            </button>
          : null}
      </section>
    </main>
  )
}

/** Leaving the Candidate Journey abandons a pending renewal, so interrupted requests fail instead of waiting forever. */
function handleRenewals({ setRenewal }: Readonly<{ setRenewal: (renewal: DemoAccessRenewal | null) => void }>) {
  let currentRenewal: DemoAccessRenewal | null = null
  const stopHandling = demoAccessRecovery.handleRenewals((renewal) => {
    currentRenewal = renewal
    setRenewal(renewal)
  })
  return () => {
    stopHandling()
    currentRenewal?.settle(false)
    setRenewal(null)
  }
}

/**
 * Access expired while the Candidate was working: the security check runs above the current page so nothing is
 * unmounted, and the interrupted requests resume once it passes.
 */
function DemoAccessRenewalModal({ localization, onClose, renewal }: Readonly<{
  localization: Localization
  onClose: () => void
  renewal: DemoAccessRenewal
}>) {
  const [state, setState] = useState<GateState>({ status: 'checking' })
  const refreshAccess = useCallback(() => {
    setState({ status: 'checking' })
    void readAccess().then(setState)
  }, [])
  const settle = useCallback((granted: boolean) => {
    renewal.settle(granted)
    onClose()
  }, [onClose, renewal])
  const grantAccess = useCallback(() => { settle(true) }, [settle])
  const abandon = useCallback(() => { settle(false) }, [settle])
  const showFailure = useCallback(() => { setState({ status: 'unavailable' }) }, [])
  useEffect(refreshAccess, [refreshAccess])
  useEffect(() => {
    if (state.status === 'granted') grantAccess()
  }, [grantAccess, state.status])
  const { translate } = localization
  return (
    <Modal closeOnClickOutside={false} onClose={abandon} opened title={translate('demoAccess.expiredTitle')}>
      <Stack aria-live="polite">
        <Text>{translate('demoAccess.expiredDescription')}</Text>
        {state.status === 'checking' ? <Text c="dimmed">{translate('demoAccess.verifying')}</Text> : null}
        {state.status === 'challenge'
          ? <TurnstileChallenge onFailure={showFailure} onGranted={grantAccess} siteKey={state.siteKey} />
          : null}
        {state.status === 'unavailable'
          ? <Group justify="flex-end">
              <Button onClick={abandon} variant="default">{translate('demoAccess.abandon')}</Button>
              <Button onClick={refreshAccess}>{translate('demoAccess.retry')}</Button>
            </Group>
          : null}
      </Stack>
    </Modal>
  )
}

function TurnstileChallenge({ onFailure, onGranted, siteKey }: Readonly<{
  onFailure: () => void
  onGranted: () => void
  siteKey: string
}>) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => mountChallenge({ container: containerRef.current, onFailure, onGranted, siteKey }), [
    onFailure,
    onGranted,
    siteKey,
  ])
  return <div className="demo-access-challenge" ref={containerRef} />
}

function mountChallenge({ container, onFailure, onGranted, siteKey }: Readonly<{
  container: HTMLDivElement | null
  onFailure: () => void
  onGranted: () => void
  siteKey: string
}>) {
  if (container === null) return undefined
  let widget: Readonly<{ api: TurnstileApi; id: string }> | undefined
  void loadTurnstile().then((result) => {
    if (!result.ok) {
      onFailure()
      return
    }
    const id = result.value.render(container, {
      sitekey: siteKey,
      appearance: 'interaction-only',
      callback: (token) => { void exchangeToken({ onFailure, onGranted, token }) },
      'error-callback': onFailure,
      'expired-callback': onFailure,
    })
    widget = { api: result.value, id }
  })
  return () => {
    if (widget !== undefined) widget.api.remove(widget.id)
  }
}

async function readAccess(): Promise<GateState> {
  try {
    const response = await fetch('/api/demo-access', { cache: 'no-store' })
    const result = accessResponseSchema.safeParse(await response.json())
    if (!result.success) return { status: 'unavailable' }
    return result.data.value.access === 'granted'
      ? { status: 'granted' }
      : { status: 'challenge', siteKey: result.data.value.siteKey }
  } catch {
    return { status: 'unavailable' }
  }
}

async function exchangeToken({ onFailure, onGranted, token }: Readonly<{
  onFailure: () => void
  onGranted: () => void
  token: string
}>) {
  try {
    const response = await fetch('/api/demo-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    })
    if (response.ok) {
      onGranted()
      return
    }
    onFailure()
  } catch {
    onFailure()
  }
}

function loadTurnstile(): Promise<
  Readonly<{ ok: true; value: TurnstileApi }> | Readonly<{ ok: false }>
> {
  if (window.turnstile !== undefined) return Promise.resolve({ ok: true, value: window.turnstile })
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.onload = () => {
      resolve(window.turnstile === undefined
        ? { ok: false }
        : { ok: true, value: window.turnstile })
    }
    script.onerror = () => {
      resolve({ ok: false })
    }
    document.head.append(script)
  })
}
