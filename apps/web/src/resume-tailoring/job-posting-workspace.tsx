import type {
  JobPostingReview,
  JobRequirement,
} from '@resume-tailoring/application/resume-tailoring-workflow-ports'
import {
  hasCurrentJobPostingProcessingConsent,
  jobPostingProcessingNoticeVersion,
} from '@resume-tailoring/application/resume-tailoring-workflow'
import { useEffect, useState } from 'react'

import type { Localization } from '../localization/localization'
import type { CandidateSessionController } from './use-candidate-session'

type WorkspaceProps = Readonly<{
  candidateSession: CandidateSessionController
  localization: Localization
}>
type ReviewProps = WorkspaceProps & Readonly<{ jobPosting: JobPostingReview }>
type ContentRevision = 'changed' | 'saved'

export function JobPostingWorkspace({ candidateSession, localization }: WorkspaceProps) {
  if (candidateSession.view.status !== 'ready') return null
  const jobPosting = candidateSession.view.jobPosting
  return (
    <section className="job-posting-workspace" aria-labelledby="job-posting-title">
      <h2 id="job-posting-title">{localization.translate('jobPosting.title')}</h2>
      {jobPosting === undefined
        ? <JobPostingInput {...{ candidateSession, localization }} />
        : jobPosting.status === 'reviewing-posting'
          ? <JobPostingReview {...{ candidateSession, jobPosting, localization }} />
          : <JobRequirementReview {...{ candidateSession, jobPosting, localization }} />}
    </section>
  )
}

function JobPostingInput({ candidateSession, localization }: WorkspaceProps) {
  const [content, setContent] = useState('')
  return (
    <div className="source-profile-card source-profile-review">
      <label htmlFor="job-posting-input">{localization.translate('jobPosting.inputLabel')}</label>
      <textarea id="job-posting-input" rows={12} value={content}
        onChange={(event) => { setContent(event.currentTarget.value) }} />
      <button className="primary-action compact-action" disabled={content.trim().length === 0}
        onClick={() => void candidateSession.reviewJobPosting({ content })} type="button">
        {localization.translate('jobPosting.review')}
      </button>
    </div>
  )
}

function JobPostingReview({ candidateSession, jobPosting, localization }: ReviewProps) {
  const [content, setContent] = useState(jobPosting.outgoingContent)
  useEffect(() => { setContent(jobPosting.outgoingContent) }, [jobPosting.outgoingContent])
  const revision = content === jobPosting.outgoingContent ? 'saved' : 'changed'
  return (
    <div className="source-profile-card source-profile-review">
      <JobPostingEditor {...{ content, localization, setContent }} />
      <button className="secondary-action" disabled={revision === 'saved'}
        onClick={() => void candidateSession.updateJobPostingContent({ outgoingContent: content })}
        type="button">
        {localization.translate('jobPosting.save')}
      </button>
      <JobPostingProcessingNotice {...{ candidateSession, jobPosting, localization, revision }} />
    </div>
  )
}

function JobPostingEditor({ content, localization, setContent }: Readonly<{
  content: string
  localization: Localization
  setContent: (content: string) => void
}>) {
  return <>
    <label htmlFor="outgoing-job-posting">{localization.translate('jobPosting.outgoingLabel')}</label>
    <textarea id="outgoing-job-posting" rows={14} value={content}
      onChange={(event) => { setContent(event.currentTarget.value) }} />
  </>
}

function JobPostingProcessingNotice({
  candidateSession,
  jobPosting,
  localization,
  revision,
}: ReviewProps & Readonly<{ revision: ContentRevision }>) {
  const confirmed = hasCurrentJobPostingProcessingConsent({ jobPosting })
  return (
    <div className="processing-notice">
      <h3>{localization.translate('jobPosting.noticeTitle')}</h3>
      <p>{localization.translate('jobPosting.noticeText')}</p>
      <small>{localization.translate('jobPosting.noticeVersion')} {jobPostingProcessingNoticeVersion}</small>
      <JobPostingNoticeActions {...{
        candidateSession, confirmed, jobPosting, localization, revision,
      }} />
    </div>
  )
}

function JobPostingNoticeActions({
  candidateSession,
  confirmed,
  jobPosting,
  localization,
  revision,
}: ReviewProps & Readonly<{ confirmed: boolean; revision: ContentRevision }>) {
  return <>
    {confirmed ? <p className="confirmed-note">{localization.translate('jobPosting.confirmed')}</p> : (
      <button className="secondary-action"
        disabled={revision === 'changed' || jobPosting.outgoingContent.trim().length === 0}
        onClick={() => void candidateSession.confirmJobPostingProcessingNotice()} type="button">
        {localization.translate('jobPosting.confirm')}
      </button>
    )}
    <button className="primary-action compact-action"
      disabled={!confirmed || revision === 'changed'}
      onClick={() => void candidateSession.extractJobRequirements()} type="button">
      {localization.translate('jobPosting.extract')}
    </button>
  </>
}

function JobRequirementReview({ jobPosting, localization }: ReviewProps) {
  return (
    <div className="source-profile-card">
      <h3>{localization.translate('jobPosting.requirementsTitle')}</h3>
      <ul className="source-fact-list">
        {jobPosting.requirements.map((requirement) => (
          <JobRequirementCard key={requirement.id} {...{ localization, requirement }} />
        ))}
      </ul>
    </div>
  )
}

function JobRequirementCard({ localization, requirement }: Readonly<{
  localization: Localization
  requirement: JobRequirement
}>) {
  return (
    <li className="source-fact" data-requirement-group={requirement.groupId}>
      <div className="fact-heading">
        <strong>{requirement.value}</strong>
        <span>{localization.translate(`jobPosting.classification.${requirement.classification}`)}</span>
      </div>
      <p className="source-excerpt">
        <strong>{localization.translate('jobPosting.sourceExcerpt')}</strong>
        <span>{requirement.sourceExcerpt}</span>
      </p>
    </li>
  )
}
