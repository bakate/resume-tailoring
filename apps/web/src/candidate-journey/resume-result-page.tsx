import { Anchor } from '@mantine/core'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { LocalizationFailure, useLocalization } from '../localization/localization'
import type { Localization } from '../localization/localization'
import { CandidateJourneyProgress, isResultOperation } from './candidate-journey-shell'
import { PreparationFeedback } from './combined-intake-workspace'
import { ResumeSectionsPreview } from './resume-sections-preview'
import { TailoredResumeWorkspace } from './tailored-resume-workspace'
import { useCandidateJourney } from './use-candidate-journey'
import type { CandidateJourneyController } from './use-candidate-journey'

/** `/resume`: the preparation progress, then the Tailored Resume with Download as its primary action. */
export function ResumeResultPage() {
  const localizationResult = useLocalization()
  if (!localizationResult.ok) return <LocalizationFailure />
  return <ResumeResult localization={localizationResult.value} />
}

function ResumeResult({ localization }: Readonly<{ localization: Localization }>) {
  const candidateJourney = useCandidateJourney()
  const navigate = useNavigate()
  const toDocuments = () => { void navigate({ to: '/' }) }
  useIntakeRedirectWithoutResult(candidateJourney)
  const { view } = candidateJourney
  if (view.status !== 'candidate-session-open') return null
  const purpose = view.session.preparation?.purpose ?? 'tailored'
  return <>
    <Anchor component={Link} to="/" fw={600} w="fit-content">
      <span aria-hidden="true">← </span>{localization.translate('resumeResult.backToDocuments')}
    </Anchor>
    {isResultOperation(candidateJourney) ? <CandidateJourneyProgress {...{ candidateJourney, localization }} /> : null}
    <ResumeSectionsPreview {...{ candidateJourney, localization }} />
    <PreparationFeedback {...{ candidateJourney, localization }} localFailure={null} onBack={toDocuments}
      onRetry={() => { candidateJourney.startTailoredResumePreparation({ purpose }) }}
      onNormalized={() => { candidateJourney.startTailoredResumePreparation({ purpose: 'normalized' }) }} />
    <TailoredResumeWorkspace {...{ candidateJourney, localization }} onChangeJobPosting={() => {
      candidateJourney.changeJobPosting(); toDocuments() }} />
  </>
}

/**
 * A visit without a result and without a preparation in progress lands on the intake. A preparation that ended in this
 * page's lifetime keeps its outcome on screen: its outcome is held in memory only, so a reload still redirects.
 */
function useIntakeRedirectWithoutResult({ view }: CandidateJourneyController) {
  const navigate = useNavigate()
  const entered = useRef(false)
  useEffect(() => {
    if (view.status === 'preparing-session') return
    const open = view.status === 'candidate-session-open'
    const hasResult = open && (view.session.tailoredResume !== null || view.operation === 'preparing-tailored-resume'
      || view.preparationOutcome !== null)
    if (open && (entered.current || hasResult)) { entered.current = true; return }
    void navigate({ to: '/', replace: true })
  }, [view, navigate])
}
