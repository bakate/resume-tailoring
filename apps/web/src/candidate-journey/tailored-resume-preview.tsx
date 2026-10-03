import { Avatar, Button, FileButton, Group, Stack, Text, TextInput } from '@mantine/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResumeExportBlocker, ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import { renderTailoredResumeDocument } from './tailored-resume-document'
import { ResumePdfPages } from './resume-pdf-pages'
import { resumePreviewMessages } from './resume-preview-messages'
import { useRenderedResume } from './use-resume-preview'
import type { ResumePreviewProps } from './use-resume-preview'
import './resume-preview.css'

type PreviewMessages = typeof resumePreviewMessages['en'] | typeof resumePreviewMessages['fr']
type CandidateNameDraft = ReturnType<typeof useCandidateNameDraft>
type RenderedResumeProps = Readonly<{
  current: ResumeRenderResult; document: TailoredResume; messages: PreviewMessages; name: CandidateNameDraft
  condensation?: ResumePreviewProps['condensation']; onDownload: () => void; onRetry: () => void; paused: boolean
}>

export function TailoredResumePreview(props: ResumePreviewProps) {
  const messages = resumePreviewMessages[props.locale]
  const [attempt, setAttempt] = useState(0)
  const { photo } = props
  const { current } = useRenderedResume({ ...props, attempt, photo })
  const name = useCandidateNameDraft({ identity: props.document.identity, onCommit: props.onIdentityChange })
  const onRetry = () => { setAttempt((value) => value + 1) }
  return <section aria-label={messages.title}>
    {current === null ? <Stack><Text role="status">{photo.failed ? messages.photoInvalid : messages.pending}</Text>
      <Button disabled>{messages.download}</Button>
      <CandidateNameField identity={props.document.identity} explain={false} messages={messages} name={name} /></Stack>
      : current.assessment.layout.status === 'unavailable' ? <RenderFailure {...{ messages, onRetry }} />
        : <RenderedResume key={current.assessment.layout.revision} {...{ ...props, current, messages, name, onRetry }} />}
    <PhotoPicker photo={photo} messages={messages} disabled={props.enabled === false} />
  </section>
}

function RenderedResume({ condensation, current, document, messages, name, onDownload, onRetry, paused }: RenderedResumeProps) {
  const [preview, setPreview] = useState<'pending' | 'ready' | 'failed'>('pending')
  const ready = useCallback(() => { setPreview('ready') }, [])
  const failed = useCallback(() => { setPreview('failed') }, [])
  const eligibility = current.assessment.exportEligibility
  const bytes = eligibility.status === 'eligible' && preview === 'ready' && !paused ? current.pdf : null
  const blocker = eligibility.status === 'blocked' ? readPrimaryBlocker({ reasons: eligibility.reasons }) : null
  return <Stack gap="sm" mt="md">
    {blocker === null || blocker === 'missing-identity' ? null : <Text role="alert" c="danger.8">{messages[blocker]}</Text>}
    {current.pdf === null ? null : <ResumePdfPages bytes={current.pdf} onReady={ready} onFailure={failed} pageLabel={messages.page} />}
    {preview === 'failed' ? <RenderFailure {...{ messages, onRetry }} /> : null}
    {eligibility.status === 'blocked' && eligibility.reasons.includes('overflow') && condensation !== undefined
      ? <Button disabled={condensation.disabled} onClick={condensation.propose}>{condensation.label}</Button> : null}
    <ResumeDownload {...{ bytes, messages, onDownload, purpose: document.purpose }} />
    <CandidateNameField identity={document.identity} explain={blocker === 'missing-identity'} messages={messages} name={name} />
  </Stack>
}

/** Only one blocking message is shown: the one the Candidate should resolve first. */
function readPrimaryBlocker({ reasons }: Readonly<{ reasons: readonly ResumeExportBlocker[] }>) {
  return blockerPriority.find((reason) => reasons.includes(reason)) ?? null
}

const blockerPriority: readonly ResumeExportBlocker[] = ['unsupported-content', 'overflow', 'missing-identity',
  'missing-contact', 'stale-layout']

/**
 * The name being typed lives above the preview branches, so a render landing mid-typing keeps it. It commits on blur
 * or Enter, at most once per value, so typing never re-renders the PDF and the editor edits the same identity.
 */
function useCandidateNameDraft({ identity, onCommit }: Readonly<{
  identity: TailoredResume['identity']; onCommit: ResumePreviewProps['onIdentityChange']
}>) {
  const committed = identity?.value ?? ''
  const [draft, setDraft] = useState(committed)
  const submitted = useRef(committed)
  useEffect(() => { setDraft(committed); submitted.current = committed }, [committed])
  const commit = () => {
    const name = draft.trim()
    if (name === submitted.current.trim()) return
    submitted.current = name
    onCommit(name.length === 0 ? null : { kind: 'personal-information', value: name })
  }
  return { draft, setDraft, commit }
}

function CandidateNameField({ identity, explain, messages, name }: Readonly<{
  identity: TailoredResume['identity']; explain: boolean; messages: PreviewMessages; name: CandidateNameDraft
}>) {
  return <TextInput label={messages.fullName} value={name.draft} autoComplete="name"
    description={identity?.origin === 'detected' ? messages.detectedName : undefined}
    error={explain && (identity?.value.trim() ?? '').length === 0 ? messages['missing-identity'] : undefined}
    onChange={(event) => { name.setDraft(event.currentTarget.value) }} onBlur={name.commit}
    onKeyDown={(event) => { if (event.key === 'Enter') name.commit() }} />
}

/** A photo picker that reads as one: the chosen photo's thumbnail, an explicit action and the accepted formats. */
function PhotoPicker({ disabled, messages, photo }: Readonly<{
  disabled: boolean; messages: PreviewMessages; photo: ResumePreviewProps['photo']
}>) {
  const chosen = photo.name !== null
  return <div role="group" aria-labelledby="resume-photo-label"><Stack gap={6} mt="sm">
    <Text id="resume-photo-label" fw={600} size="sm">{messages.photo}</Text>
    <Group gap="md" wrap="nowrap">
      <Avatar src={photo.ready ? photo.dataUrl : undefined} alt="" radius="xl" size="lg" />
      <Stack gap={4}>
        <Group gap="xs">
          <FileButton accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={photo.select}>
            {(props) => <Button {...props} variant="default" size="xs">{chosen ? messages.photoChange : messages.photoAdd}</Button>}
          </FileButton>
          {chosen ? <Button variant="subtle" size="xs" disabled={disabled} onClick={() => { photo.select(null) }}>
            {messages.photoRemove}</Button> : null}
        </Group>
        <Text c={photo.failed ? 'danger.8' : 'dimmed'} role={photo.failed ? 'alert' : undefined} size="xs">
          {photo.failed ? messages.photoInvalid : photo.name ?? messages.photoHint}</Text>
      </Stack>
    </Group>
  </Stack></div>
}

function RenderFailure({ messages, onRetry }: Readonly<{ messages: PreviewMessages; onRetry: () => void }>) {
  return <Stack gap="sm" mt="md"><Text role="alert" c="danger.8">{messages['layout-unavailable']}</Text>
    <Button onClick={onRetry}>{messages.retry}</Button></Stack>
}

function ResumeDownload({ bytes, messages, onDownload, purpose }: Readonly<{
  bytes: Uint8Array | null; messages: PreviewMessages; onDownload: () => void; purpose: TailoredResume['purpose']
}>) {
  const [download, setDownload] = useState<'idle' | 'failed' | 'handed-off'>('idle')
  return <><Button disabled={bytes === null} onClick={() => {
    if (bytes === null) return
    const outcome = handOffResumePdf({ bytes, purpose })
    setDownload(outcome ? 'handed-off' : 'failed')
    if (outcome) onDownload()
  }}>{messages.download}</Button>
    {download === 'idle' ? null : <Text role={download === 'failed' ? 'alert' : 'status'}>
      {download === 'failed' ? messages.downloadFailed : messages.downloaded}</Text>}
  </>
}

export function DocumentText({ document, locale }: Readonly<{ document: TailoredResume; locale: TailoredResume['locale'] }>) {
  const messages = resumePreviewMessages[locale]
  return <details><summary>{messages.textVersion}</summary>
    <iframe className="tailored-resume-preview-frame" sandbox="" title={messages.previewTitle}
      srcDoc={renderTailoredResumeDocument({ tailoredResume: document })} />
  </details>
}

function handOffResumePdf({ bytes, purpose }: Readonly<{ bytes: Uint8Array; purpose: TailoredResume['purpose'] }>) {
  let url: string | undefined
  const link = window.document.createElement('a')
  try {
    url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }))
    link.href = url
    link.download = purpose === 'normalized' ? 'normalized-resume.pdf' : 'tailored-resume.pdf'
    window.document.body.append(link)
    link.click()
    return true
  } catch {
    return false
  } finally {
    link.remove()
    if (url !== undefined) { const releasedUrl = url; window.setTimeout(() => { URL.revokeObjectURL(releasedUrl) }, 30_000) }
  }
}
