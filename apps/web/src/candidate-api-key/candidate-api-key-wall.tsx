import { Anchor, Button, Checkbox, Group, List, Modal, PasswordInput, Stack, Text } from '@mantine/core'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { SyntheticEvent } from 'react'
import { z } from 'zod'

import { apiFailureSchema } from '../api-failure'
import { createAccessRecoveringRequest, demoAccessRecovery } from '../demo-access/demo-access-recovery'
import type { Localization } from '../localization/localization'
import { candidateApiKeyHeaderName } from './candidate-api-key-header'
import { candidateApiKeyRecovery, candidateApiKeys, dailyQuota } from './candidate-api-key-recovery'
import type { CandidateApiKeyPrompt, CandidateApiKeyRequest } from './candidate-api-key-recovery'
import { formatDailyQuotaReset, readNextDailyQuotaReset } from './daily-quota'

/** The Candidate API Key of this tab, re-read whenever it is entered or removed. */
export function useCandidateApiKey() {
  return useSyncExternalStore(candidateApiKeys.subscribe, readActiveKey, () => false)
}

/** The Daily Quota the edge last announced; asked once when shown, without spending anything. */
export function useDailyQuota() {
  useEffect(() => { void dailyQuota.refresh(fetch) }, [])
  return useSyncExternalStore(dailyQuota.subscribe, dailyQuota.read, () => null)
}

/**
 * Shows the wall when the Daily Quota refuses a request, and the key entry when a Recovery asks for a key. It sits
 * above the current page so nothing is unmounted, and the interrupted requests resume once a valid key is entered.
 */
export function CandidateApiKeyWall({ localization }: Readonly<{ localization: Localization }>) {
  const [pending, setPending] = useState<CandidateApiKeyRequest | null>(null)
  useEffect(() => {
    const stopHandling = candidateApiKeyRecovery.handleRequests(setPending)
    return () => {
      stopHandling()
      setPending(null)
    }
  }, [])
  const settle = useCallback((entered: boolean) => {
    pending?.settle(entered)
    setPending(null)
  }, [pending])
  if (pending === null) return null
  return <CandidateApiKeyModal localization={localization} onSettle={settle} prompt={pending.request} />
}

function CandidateApiKeyModal({ localization, onSettle, prompt }: Readonly<{
  localization: Localization; onSettle: (entered: boolean) => void; prompt: CandidateApiKeyPrompt
}>) {
  const [showsEntry, setShowsEntry] = useState(prompt.reason !== 'daily-quota-reached')
  const decline = useCallback(() => { onSettle(false) }, [onSettle])
  const { translate } = localization
  const title = prompt.reason === 'daily-quota-reached'
    ? translate(`candidateApiKey.wall.${prompt.scope}`).replace('{count}', String(dailyQuotaPerClient))
    : translate('candidateApiKey.form.title')
  return <Modal closeOnClickOutside={false} onClose={decline} opened title={title}>
    {prompt.reason === 'daily-quota-reached' && !showsEntry
      ? <Stack>
          <Text>{translate('candidateApiKey.wall.description')}</Text>
          <Group justify="flex-end">
            <Button onClick={decline} variant="default">{translate('candidateApiKey.wall.comeBack')
              .replace('{time}', formatDailyQuotaReset({ locale: localization.locale, resetAt: new Date(prompt.resetAt) }))}</Button>
            <Button onClick={() => { setShowsEntry(true) }}>{translate('candidateApiKey.use')}</Button>
          </Group>
        </Stack>
      : <CandidateApiKeyForm localization={localization} onCancel={decline} onEntered={() => { onSettle(true) }} />}
  </Modal>
}

type EntryState =
  | Readonly<{ status: 'editing' | 'checking' }>
  | Readonly<{ status: 'failed'; reason: EntryFailure }>
type EntryFailure = 'required' | 'candidate-api-key-invalid' | 'candidate-api-key-model-unavailable'
  | 'provider-credit-exhausted' | 'unavailable'

/**
 * Entering a key is consenting to its Processing Policy variant, and the key is validated before it is kept: no
 * model request is ever signed with a key the Candidate has not consented to or the provider rejects.
 */
function CandidateApiKeyForm({ localization, onCancel, onEntered }: Readonly<{
  localization: Localization; onCancel: () => void; onEntered: () => void
}>) {
  const [apiKey, setApiKey] = useState('')
  const [consented, setConsented] = useState(false)
  const [state, setState] = useState<EntryState>({ status: 'editing' })
  const { translate } = localization
  const submit = (event: SyntheticEvent) => {
    event.preventDefault()
    const entered = apiKey.trim()
    if (entered.length === 0 || !consented) {
      setState({ status: 'failed', reason: 'required' })
      return
    }
    setState({ status: 'checking' })
    void validateCandidateApiKey(entered).then((result) => {
      if (!result.ok) {
        setState({ status: 'failed', reason: result.reason })
        return
      }
      candidateApiKeys.save({ apiKey: entered, grantedAt: Date.now() })
      onEntered()
    })
  }
  const checking = state.status === 'checking'
  return <form onSubmit={submit}><Stack>
    <PasswordInput autoComplete="off" disabled={checking} label={translate('candidateApiKey.form.label')}
      onChange={(event) => { setApiKey(event.currentTarget.value) }} spellCheck={false} value={apiKey} />
    <Text size="sm">{translate('candidateApiKey.form.help')}{' '}
      <Anchor href="https://platform.openai.com/api-keys" rel="noreferrer" target="_blank">
        {translate('candidateApiKey.form.helpLink')}</Anchor></Text>
    <div>
      <Text fw={700} size="sm">{translate('candidateApiKey.form.policyTitle')}</Text>
      <List size="sm">
        <List.Item>{translate('candidateApiKey.form.policyAccount')}</List.Item>
        <List.Item>{translate('candidateApiKey.form.policyTransit')}</List.Item>
        <List.Item>{translate('candidateApiKey.form.policyRetention')}</List.Item>
      </List>
    </div>
    <Checkbox checked={consented} disabled={checking} label={translate('candidateApiKey.form.consent')}
      onChange={(event) => { setConsented(event.currentTarget.checked) }} />
    <div aria-live="polite">
      {checking ? <Text c="dimmed" size="sm">{translate('candidateApiKey.form.checking')}</Text> : null}
      {state.status === 'failed'
        ? <Text c="danger.8" role="alert" size="sm">{translate(state.reason === 'required'
          ? 'candidateApiKey.form.required' : `candidateApiKey.form.failure.${state.reason}`)}</Text>
        : null}
    </div>
    <Group justify="flex-end">
      <Button disabled={checking} onClick={onCancel} variant="default">{translate('candidateApiKey.form.cancel')}</Button>
      <Button loading={checking} type="submit">{translate('candidateApiKey.form.submit')}</Button>
    </Group>
  </Stack></form>
}

/**
 * Before a preparation starts: the free resumes left today, or the active Candidate API Key with the way back to the
 * free quota. Nothing here is a payment; the key is an option for heavy use.
 */
export function DailyQuotaStatus({ localization }: Readonly<{ localization: Localization }>) {
  const hasKey = useCandidateApiKey()
  const quota = useDailyQuota()
  const { translate } = localization
  if (hasKey) {
    return <Group gap="xs" justify="space-between">
      <div>
        <Text fw={700} size="sm">{translate('candidateApiKey.active')}</Text>
        <Text c="dimmed" size="sm">{translate('candidateApiKey.activeDescription')}</Text>
      </div>
      <Button onClick={() => { candidateApiKeys.remove() }} size="compact-sm" variant="default">
        {translate('candidateApiKey.remove')}</Button>
    </Group>
  }
  if (quota === null) return null
  return <Group gap="xs" justify="space-between">
    <Text c="dimmed" size="sm">{quota.remaining > 0
      ? translate('dailyQuota.remaining').replace('{count}', String(quota.remaining))
      : translate('dailyQuota.none').replace('{time}',
        formatDailyQuotaReset({ locale: localization.locale, resetAt: new Date(quota.resetAt) }))}</Text>
    <Button onClick={() => { void candidateApiKeyRecovery.request({ reason: 'enter-key' }) }} size="compact-sm"
      variant="subtle">{translate('candidateApiKey.use')}</Button>
  </Group>
}

/** The local time at which the Daily Quota of a refused preparation comes back, whenever the failure is shown. */
export function formatNextDailyQuotaReset({ locale }: Readonly<{ locale: string }>) {
  return formatDailyQuotaReset({ locale, resetAt: readNextDailyQuotaReset(Date.now()) })
}

async function validateCandidateApiKey(apiKey: string): Promise<
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: Exclude<EntryFailure, 'required'> }>
> {
  try {
    const response = await validationRequest('/api/candidate-api-key', {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', [candidateApiKeyHeaderName]: apiKey },
      body: '{}',
    })
    const body: unknown = await response.json()
    if (response.ok && validatedSchema.safeParse(body).success) return { ok: true }
    const failure = apiFailureSchema.safeParse(body)
    const type = failure.success ? failure.data.error.type : undefined
    return { ok: false, reason: type === 'candidate-api-key-invalid' || type === 'candidate-api-key-model-unavailable'
      || type === 'provider-credit-exhausted' ? type : 'unavailable' }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

function readActiveKey() {
  return candidateApiKeys.read() !== null
}

/** The validation, like any request to the server, waits for the Candidate to renew expired demo access. */
const validationRequest = createAccessRecoveringRequest({ recovery: demoAccessRecovery, request: fetch })
const validatedSchema = z.object({ ok: z.literal(true) })
/** The Daily Quota named on the wall; the edge holds the authoritative count. */
const dailyQuotaPerClient = 4
