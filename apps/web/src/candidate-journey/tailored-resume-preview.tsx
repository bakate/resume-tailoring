import { Button, FileInput, Stack, Text, Title } from '@mantine/core'
import { useCallback, useState } from 'react'
import type { ResumeRenderResult } from '@resume-tailoring/application/candidate-journey'
import type { TailoredResume } from '@resume-tailoring/application/tailored-resume'
import { renderTailoredResumeDocument } from './tailored-resume-document'
import { ResumePdfPages } from './resume-pdf-pages'
import { resumePreviewMessages } from './resume-preview-messages'
import { useRenderedResume } from './use-resume-preview'
import type { ResumePreviewProps } from './use-resume-preview'
import './resume-preview.css'

type PreviewMessages = typeof resumePreviewMessages['en'] | typeof resumePreviewMessages['fr']
type RenderedResumeProps = Readonly<{
  current: ResumeRenderResult; document: TailoredResume; messages: PreviewMessages
  onDownload: () => void; onRetry: () => void
}>

export function TailoredResumePreview(props: ResumePreviewProps) {
  const messages = resumePreviewMessages[props.document.locale]
  const [attempt, setAttempt] = useState(0)
  const { photo } = props
  const { current } = useRenderedResume({ ...props, attempt, photo })
  const onRetry = () => { setAttempt((value) => value + 1) }
  return <section aria-labelledby="tailored-resume-preview-title">
    <Title id="tailored-resume-preview-title" order={3}>{messages.title}</Title>
    <Text c="dimmed" mt="xs">{messages.description}</Text>
    <FileInput label={messages.photo} accept="image/png,image/jpeg,image/webp" value={photo.file}
      clearable disabled={props.enabled === false} onChange={photo.select} error={photo.failed ? messages.photoInvalid : undefined} />
    {current === null ? <Stack><Text role="status">{photo.failed ? messages.photoInvalid : messages.pending}</Text>
      <Button disabled>{messages.download}</Button></Stack>
      : current.assessment.layout.status === 'unavailable' ? <RenderFailure {...{ messages, onRetry }} />
        : <RenderedResume key={current.assessment.layout.revision} {...{ ...props, current, messages, onRetry }} />}
    <DocumentText {...{ document: props.document, messages }} />
  </section>
}

function RenderedResume({ current, document, messages, onDownload, onRetry }: RenderedResumeProps) {
  const [preview, setPreview] = useState<'pending' | 'ready' | 'failed'>('pending')
  const ready = useCallback(() => { setPreview('ready') }, [])
  const failed = useCallback(() => { setPreview('failed') }, [])
  const eligibility = current.assessment.exportEligibility
  const bytes = eligibility.status === 'eligible' && preview === 'ready' ? current.pdf : null
  return <Stack gap="sm" mt="md">
    {eligibility.status === 'blocked' ? eligibility.reasons.map((reason) =>
      <Text role="alert" c="danger.8" key={reason}>{messages[reason]}</Text>) : null}
    {current.pdf === null ? null : <ResumePdfPages bytes={current.pdf} onReady={ready} onFailure={failed} pageLabel={messages.page} />}
    {preview === 'failed' ? <RenderFailure {...{ messages, onRetry }} /> : null}
    <ResumeDownload {...{ bytes, messages, onDownload, purpose: document.purpose }} />
  </Stack>
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

function DocumentText({ document, messages }: Readonly<{ document: TailoredResume; messages: PreviewMessages }>) {
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
