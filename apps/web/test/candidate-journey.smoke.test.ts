import { candidateSessionDurationMilliseconds, candidateSessionStorageVersion } from '@resume-tailoring/application/candidate-journey'
import { structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe('Candidate Journey', () => {
  test('recovers corrected local contacts after reloading the editor', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGroupedEvidenceIsReadyForPreparation()
    await system.prepareGroupedResume()

    await system.correctContactAndReload()

    await system.expectCorrectedContactRecovered()
  })

  test('keeps unresolved wording visible and blocked after reloading', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGroupedEvidenceIsReadyForPreparation()
    await system.prepareGroupedResume()

    await system.editUnsupportedWordingAndReload()

    await system.expectUnresolvedWordingRecovered()
  })

  test('prepares a grouped semantic preview with a readable mobile order', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGroupedEvidenceIsReadyForPreparation()

    await system.prepareGroupedResume()

    await system.expectPreviewFirstReview()
    await system.expectGroupedResumePreview()
  })

  test('keeps semantic metadata when an employer is hidden and restored', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGroupedEvidenceIsReadyForPreparation()
    await system.prepareGroupedResume()

    await system.hideAndRestoreEmployer()

    await system.expectGroupedResumePreview()
  })

  test('keeps candidate section ordering in the preview', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGroupedEvidenceIsReadyForPreparation()
    await system.prepareGroupedResume()

    await system.moveExperienceBeforeSummary()

    await system.expectExperienceBeforeSummary()
  })

  test('restores a complete hidden experience without losing its metadata', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGroupedEvidenceIsReadyForPreparation()
    await system.prepareGroupedResume()

    await system.hideAndRestoreExperience()

    await system.expectGroupedResumePreview()
  })

  test('exposes exactly three domain phases', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Action
    await system.openCandidateJourney()

    // Then
    await system.expectExactlyThreeCandidateJourneyPhases()
  })

  test('a Candidate can start a browser-local Candidate Session', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenCandidateJourneyIsOpen()

    // Action
    await system.startCandidateSession()

    // Then
    await system.expectCandidateSessionToBeActiveInSourceIntake()
  })

  test('a Candidate can restore a browser-local Candidate Session', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenCandidateSessionIsActive()

    // Action
    await system.restoreCandidateSession()

    // Then
    await system.expectCandidateSessionToBeActiveInSourceIntake()
  })

  test('a Candidate can delete the browser-local Candidate Session', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenCandidateSessionIsActive()

    // Action
    await system.deleteCandidateSession()

    // Then
    await system.expectCandidateSessionToBeDeleted()
  })

  test('a Candidate sees the active Processing Policy before granting consent', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenCandidateJourneyIsOpen()

    // Action
    await system.startCandidateSession()

    // Then
    await system.expectActiveProcessingPolicyToBeVisible()
  })

  test('the active Processing Policy content follows the selected locale', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenCandidateSessionIsActive()

    // Action
    await system.selectFrenchLocale()

    // Then
    await system.expectFrenchProcessingPolicyToBeVisible()
  })

  test('a Candidate grants Processing Consent to the active policy', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenCandidateSessionIsActive()

    // Action
    await system.grantProcessingConsent()

    // Then
    await system.expectProcessingConsentToBeGranted()
  })

  test('a Candidate restores Processing Consent for the unchanged policy', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenProcessingConsentIsGranted()

    // Action
    await system.restoreCandidateSession()

    // Then
    await system.expectRestoredProcessingConsentToBeGranted()
  })

  test('a Candidate pastes professional text and proceeds directly to Job Match', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenProcessingConsentIsGranted()
    await system.givenStructuredSourceProfileExtractionSucceeds()

    // Action
    await system.submitPastedProfessionalText()

    // Then
    await system.expectStructuredSourceProfileToBeOptionalAndJobMatchToBeCurrent()
  })

  test('a Candidate resolves only the targeted Critical Ambiguity', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenProcessingConsentIsGranted()
    await system.givenSourceIntakeRequiresCriticalAmbiguityResolution()

    // Action
    await system.answerCriticalAmbiguity()

    // Then
    await system.expectCriticalAmbiguityToBeResolvedForJobMatch()
  })

  test('a Candidate receives an explainable Match Analysis without requirement review', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenProcessingConsentIsGranted()
    await system.givenStructuredSourceProfileExtractionSucceeds()
    await system.givenSourceIntakeIsReadyForJobMatch()
    await system.givenExplainableJobMatchSucceeds()

    // Action
    await system.submitPastedJobPosting()

    // Then
    await system.expectExplainableMatchAnalysisToBeVisible()
  })

  test('a Candidate confirms targeted missing evidence and receives a fresh Match Analysis', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenProcessingConsentIsGranted()
    await system.givenStructuredSourceProfileExtractionSucceeds()
    await system.givenSourceIntakeIsReadyForJobMatch()
    await system.givenExplainableJobMatchSucceeds()
    await system.submitPastedJobPosting()
    await system.expectTargetedProfileEnrichmentIsVisible()
    system.givenProfileEnrichmentRefreshSucceeds()

    // Action
    await system.confirmProfileEnrichment()

    // Then
    await system.expectCandidateFactAndFreshMatchAnalysis()
  })

  test('a low Match Score warns without blocking an evidence-backed Tailored Resume', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenProcessingConsentIsGranted()
    await system.givenStructuredSourceProfileExtractionSucceeds()
    await system.givenSourceIntakeIsReadyForJobMatch()
    await system.givenLowExplainableJobMatchSucceeds()

    // Action
    await system.submitPastedJobPosting()

    // Then
    await system.expectLowScoreWarningAndTailoredResumeOffer()
  })

  test('no relevant evidence offers only an explicitly non-tailored normalized source resume', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    // Given
    await system.givenProcessingConsentIsGranted()
    await system.givenStructuredSourceProfileExtractionSucceeds()
    await system.givenSourceIntakeIsReadyForJobMatch()
    await system.givenUnsupportedJobMatchSucceeds()

    // Action
    await system.submitPastedJobPosting()

    // Then
    await system.expectOnlyNormalizedSourceResumeOffer()
  })
})

function createSystemUnderTest({ page }: Readonly<{ page: Page }>) {
  return new CandidateJourneyTestSystem(page)
}

type MatchEvidenceApiResponse = typeof matchEvidenceResponse
  | ReturnType<typeof createEnrichedMatchEvidenceResponse>
  | typeof lowMatchEvidenceResponse
  | typeof unsupportedMatchEvidenceResponse

class CandidateJourneyTestSystem {
  readonly #page: Page
  readonly #pageErrors: string[] = []
  #completedAction: CandidateJourneyAction | null = null
  #matchEvidenceResponse: MatchEvidenceApiResponse = matchEvidenceResponse
  #readMatchEvidenceResponse: (candidateFacts: readonly Readonly<{
    id: `source-fact-${string}`
  }>[]) => MatchEvidenceApiResponse = () => this.#matchEvidenceResponse
  #lastMatchResponse: unknown = null

  constructor(page: Page) {
    this.#page = page
    page.on('pageerror', (error) => { this.#pageErrors.push(error.message) })
  }

  async givenGroupedEvidenceIsReadyForPreparation() {
    const startedAt = Date.now()
    const session = {
      expiresAt: startedAt + candidateSessionDurationMilliseconds, startedAt,
      version: candidateSessionStorageVersion,
      sessionId: 'candidate-session-00000000-0000-4000-8000-000000000056',
      phase: 'job-match', processingConsent: null, tailoredResume: null,
      sourceIntake: structuredResumeSource, jobMatch: structuredResumeJobMatch,
    }
    await this.#page.addInitScript((storedSession) => {
      if (window.top !== window || localStorage.getItem('honest-resume:candidate-session') !== null) return
      localStorage.setItem('honest-resume:candidate-session', JSON.stringify(storedSession))
    }, session)
    await this.#page.goto('/')
  }

  async prepareGroupedResume() {
    await this.#page.getByRole('button', { name: 'Prepare my Tailored Resume' }).click()
    await expect(this.#page.getByTitle('Tailored Resume preview')).toBeVisible()
    this.#completedAction = 'grouped-resume-prepared'
  }

  async correctContactAndReload() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByLabel('Email', { exact: true }).fill('updated@example.com')
    await this.#page.reload()
    this.#completedAction = 'contact-corrected-and-reloaded'
  }

  async expectCorrectedContactRecovered() {
    this.#expectCompletedAction('contact-corrected-and-reloaded')
    await expect(this.#page.frameLocator('iframe').getByText('updated@example.com', { exact: true })).toBeVisible()
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await expect(this.#page.getByLabel('Email', { exact: true })).toHaveValue('updated@example.com')
  }

  async editUnsupportedWordingAndReload() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await this.#page.getByLabel('Resume Field', { exact: true }).first().fill('Led 100 engineers')
    await this.#page.getByRole('button', { name: 'Save wording', exact: true }).first().click()
    await this.#page.reload()
    this.#completedAction = 'wording-edited-and-reloaded'
  }

  async expectUnresolvedWordingRecovered() {
    this.#expectCompletedAction('wording-edited-and-reloaded')
    await expect(this.#page.frameLocator('iframe').getByText('Led 100 engineers', { exact: true })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Print current resume', exact: true })).toHaveCount(0)
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await expect(this.#page.getByText('This professional edit is not supported by the current Candidate Facts.', { exact: true })).toBeVisible()
  }

  async expectPreviewFirstReview() {
    await expect(this.#page.getByRole('button', { name: 'Edit resume', exact: true })).toBeVisible()
    await expect(this.#page.getByLabel('Resume Field', { exact: true })).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0)
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await expect(this.#page.getByRole('dialog')).toBeVisible()
    await this.#page.keyboard.press('Escape')
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Edit resume', exact: true })).toBeFocused()
  }

  async hideAndRestoreEmployer() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Experience', exact: true }).click()
    const employerField = this.#page.locator('textarea').filter({ hasText: 'Northwind' })
    const fieldCard = employerField.locator('xpath=ancestor::*[contains(@class,"mantine-Paper-root")][1]')
    await fieldCard.getByRole('button', { name: 'Hide field', exact: true }).click()
    await expect(this.#page.frameLocator('iframe').getByText('Northwind', { exact: true })).toHaveCount(0)
    await this.#page.getByRole('tab', { name: 'Restore content', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Restore field', exact: true }).click()
    await this.#page.keyboard.press('Escape')
    this.#completedAction = 'grouped-resume-prepared'
  }

  async hideAndRestoreExperience() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Experience', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Hide experience', exact: true }).first().click()
    await expect(this.#page.frameLocator('iframe').getByText('Northwind', { exact: true })).toHaveCount(0)
    await this.#page.getByRole('tab', { name: 'Restore content', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Restore experience', exact: true }).click()
    await this.#page.keyboard.press('Escape')
  }

  async moveExperienceBeforeSummary() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Section order', exact: true }).click()
    const experienceOrder = this.#page.getByRole('tabpanel').getByText('Experience', { exact: true }).locator('..')
    await experienceOrder.getByRole('button', { name: 'Move up', exact: true }).click()
    await this.#page.keyboard.press('Escape')
  }

  async expectExperienceBeforeSummary() {
    const headings = this.#page.frameLocator('iframe').getByRole('heading', { level: 2 })
    await expect(headings.nth(0)).toHaveText('Experience')
    await expect(headings.nth(1)).toHaveText('Summary')
  }

  async expectGroupedResumePreview() {
    this.#expectCompletedAction('grouped-resume-prepared')
    expect(this.#pageErrors).toEqual([])
    await expect(this.#page).toHaveURL('/')
    await expect(this.#page.locator('vite-error-overlay')).toHaveCount(0)
    const preview = this.#page.frameLocator('iframe')
    const experience = preview.locator('article').filter({ has: preview.getByRole('heading', { name: 'Frontend Engineer', exact: true }) })
    await expect(experience).toContainText('Northwind')
    await expect(experience).toContainText('2021 – 2024')
    await expect(experience).toContainText('Built accessible billing screens')
    await expect(preview.getByRole('heading', { name: 'Front-end', exact: true })).toHaveCount(1)
    await expect(preview.locator('.skill-group')).toHaveText('Front-endReact · TypeScript')
    await expect(preview.locator('li').filter({ hasText: /^Front-end$/ })).toHaveCount(0)
    const pageWidth = await preview.locator('body').evaluate((body) => body.scrollWidth)
    const viewportWidth = await this.#page.locator('iframe').evaluate((frame) => frame.clientWidth)
    expect(pageWidth).toBeLessThanOrEqual(viewportWidth)
  }

  async givenCandidateJourneyIsOpen() {
    await this.#page.goto('/')
  }

  async givenCandidateSessionIsActive() {
    await this.givenCandidateJourneyIsOpen()
    await this.startCandidateSession()
  }

  async givenProcessingConsentIsGranted() {
    await this.givenCandidateSessionIsActive()
    await this.grantProcessingConsent()
  }

  async givenStructuredSourceProfileExtractionSucceeds() {
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => (
      route.fulfill({ json: structuredSourceProfileResponse })
    ))
  }

  async givenSourceIntakeRequiresCriticalAmbiguityResolution() {
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => (
      route.fulfill({ json: criticalAmbiguitySourceProfileResponse })
    ))
    await this.#submitProfessionalText()
    await expect(this.#page.getByRole('region', { name: 'Resolve Critical Ambiguities' }))
      .toBeVisible()
  }

  async givenSourceIntakeIsReadyForJobMatch() {
    await this.#submitProfessionalText()
    await expect(this.#page.getByRole('listitem').filter({ hasText: 'Job Match' }))
      .toHaveAttribute('aria-current', 'step')
  }

  async givenExplainableJobMatchSucceeds() {
    await this.#page.route('**/api/explainable-job-posting-extraction', (route) => (
      route.fulfill({ json: jobPostingExtractionResponse })
    ))
    await this.#page.route('**/api/explainable-match-evidence', async (route) => {
      const request = route.request().postDataJSON() as Readonly<{
        candidateFacts: readonly Readonly<{ id: `source-fact-${string}` }>[]
      }>
      const response = this.#readMatchEvidenceResponse(request.candidateFacts)
      await route.fulfill({ json: response })
    })
  }

  async givenLowExplainableJobMatchSucceeds() {
    this.#matchEvidenceResponse = lowMatchEvidenceResponse
    await this.givenExplainableJobMatchSucceeds()
  }

  async givenUnsupportedJobMatchSucceeds() {
    this.#matchEvidenceResponse = unsupportedMatchEvidenceResponse
    await this.givenExplainableJobMatchSucceeds()
  }

  givenProfileEnrichmentRefreshSucceeds() {
    this.#readMatchEvidenceResponse = (candidateFacts) => {
      const enrichedFactId = candidateFacts.at(-1)?.id
      return enrichedFactId === undefined ? this.#matchEvidenceResponse
        : createEnrichedMatchEvidenceResponse({ enrichedFactId })
    }
  }

  async expectTargetedProfileEnrichmentIsVisible() {
    this.#expectCompletedAction('job-posting-submitted')
    const enrichment = this.#page.getByRole('region', { name: 'Optional profile enrichment' })
    await expect(enrichment).toContainText('Architecture leadership')
    await expect(enrichment).toContainText('Executive communication')
    await expect(enrichment).not.toContainText('Kubernetes')
  }

  async openCandidateJourney() {
    await this.#page.goto('/')
    this.#completedAction = 'candidate-journey-opened'
  }

  async startCandidateSession() {
    await this.#page.getByRole('button', { name: 'Start a Candidate Session' }).click()
    this.#completedAction = 'candidate-session-started'
  }

  async restoreCandidateSession() {
    await this.#page.reload()
    this.#completedAction = 'candidate-session-restored'
  }

  async deleteCandidateSession() {
    await this.#page.getByRole('button', { name: 'Delete Candidate Session' }).click()
    await this.#page.getByRole('button', { name: 'Delete session now' }).click()
    this.#completedAction = 'candidate-session-deleted'
  }

  async grantProcessingConsent() {
    await this.#page.getByRole('button', { name: 'Grant Processing Consent' }).click()
    this.#completedAction = 'processing-consent-granted'
  }

  async selectFrenchLocale() {
    await this.#page.getByRole('radiogroup', { name: 'Language' }).getByText('FR').click()
    this.#completedAction = 'french-locale-selected'
  }

  async submitPastedProfessionalText() {
    await this.#submitProfessionalText()
    this.#completedAction = 'source-document-submitted'
  }

  async answerCriticalAmbiguity() {
    const question = 'What year did you start at Acme?'
    await this.#page.getByRole('textbox', { name: question }).fill('2021')
    await this.#page.getByRole('button', { name: 'Save this answer' }).click()
    this.#completedAction = 'critical-ambiguity-answered'
  }

  async submitPastedJobPosting() {
    await this.#page.getByRole('textbox', { name: 'Job Posting text' }).fill(jobPostingText)
    await this.#page.getByRole('button', { name: 'Analyze this Job Posting' }).click()
    this.#completedAction = 'job-posting-submitted'
  }

  async confirmProfileEnrichment() {
    const prompt = this.#page.getByRole('group', { name: 'Architecture leadership' })
    await prompt.getByRole('textbox', { name: 'Describe only what you actually did' })
      .fill('Practiced Architecture leadership across the organization')
    const refreshResponse = this.#page.waitForResponse('**/api/explainable-match-evidence')
    await prompt.getByRole('button', {
      name: 'Add this Candidate Fact and refresh analysis',
    }).click()
    this.#lastMatchResponse = await (await refreshResponse).json()
    this.#completedAction = 'profile-enrichment-confirmed'
  }

  async #submitProfessionalText() {
    await this.#page.getByRole('textbox', { name: 'Professional text' }).fill([
      'Bakate Example',
      'bakate@example.com',
      'Senior FullStack Developer at Acme',
    ].join('\n'))
    await this.#page.getByRole('button', { name: 'Build my Source Profile' }).click()
  }

  async expectActiveProcessingPolicyToBeVisible() {
    this.#expectCompletedAction('candidate-session-started')
    const policy = this.#page.getByRole('region', { name: 'Processing Policy' })
    await expect(policy).toContainText('OpenAI')
    await expect(policy).toContainText('Purposes')
    await expect(policy).toContainText('Data sent')
    await expect(policy).toContainText('Retention')
    await expect(policy).toContainText('Storage')
    await expect(policy).toContainText('Policy version 2026-09-29')
  }

  async expectExactlyThreeCandidateJourneyPhases() {
    this.#expectCompletedAction('candidate-journey-opened')
    const phases = this.#page.getByRole('navigation', { name: 'Candidate Journey phases' })
      .getByRole('listitem')
    await expect(phases).toHaveText([
      '01Source IntakeAdd the professional facts that can support your application.',
      '02Job MatchCompare your evidence with one Job Posting.',
      '03Tailored Resume PreparationPrepare and export an evidence-backed resume.',
    ])
  }

  async expectFrenchProcessingPolicyToBeVisible() {
    this.#expectCompletedAction('french-locale-selected')
    const policy = this.#page.getByRole('region', { name: 'Politique de Traitement' })
    await expect(policy).toContainText('Extraire et structurer les preuves professionnelles')
    await expect(policy).toContainText("Contenu de l’Offre d’emploi")
    await expect(policy).toContainText('jusqu’à 30 jours')
    await expect(policy).toContainText('Le contenu du Candidat reste dans le navigateur')
    await expect(policy).not.toContainText('Extract and structure professional evidence')
  }

  async expectCandidateSessionToBeActiveInSourceIntake() {
    this.#expectCompletedActionIn(['candidate-session-started', 'candidate-session-restored'])
    await expect(this.#page.getByText('Candidate Session active')).toBeVisible()
    await expect(this.#page.getByRole('listitem').filter({ hasText: 'Source Intake' }))
      .toHaveAttribute('aria-current', 'step')
  }

  async expectCandidateSessionToBeDeleted() {
    this.#expectCompletedAction('candidate-session-deleted')
    await expect(this.#page.getByRole('button', { name: 'Start a Candidate Session' })).toBeEnabled()
    await expect(this.#page.getByText('Candidate Session deleted from this browser.')).toBeVisible()
  }

  async expectProcessingConsentToBeGranted() {
    this.#expectCompletedAction('processing-consent-granted')
    await expect(this.#page.getByText('Processing Consent granted for this policy.')).toBeVisible()
  }

  async expectRestoredProcessingConsentToBeGranted() {
    this.#expectCompletedAction('candidate-session-restored')
    await expect(this.#page.getByText('Processing Consent granted for this policy.')).toBeVisible()
  }

  async expectStructuredSourceProfileToBeOptionalAndJobMatchToBeCurrent() {
    this.#expectCompletedAction('source-document-submitted')
    await expect(this.#page.getByRole('listitem').filter({ hasText: 'Job Match' }))
      .toHaveAttribute('aria-current', 'step')
    await expect(this.#page.getByText('Your Source Profile is ready.')).toBeVisible()
    await this.#page.getByRole('button', { name: 'Inspect Source Profile' }).click()
    await expect(this.#page.getByRole('region', { name: 'Detailed Source Profile' }))
      .toContainText('TypeScript')
  }

  async expectCriticalAmbiguityToBeResolvedForJobMatch() {
    this.#expectCompletedAction('critical-ambiguity-answered')
    await expect(this.#page.getByRole('listitem').filter({ hasText: 'Job Match' }))
      .toHaveAttribute('aria-current', 'step')
    await expect(this.#page.getByText('Your Source Profile is ready.')).toBeVisible()
  }

  async expectExplainableMatchAnalysisToBeVisible() {
    this.#expectCompletedAction('job-posting-submitted')
    await expect(this.#page.getByText('54%')).toBeVisible()
    await expect(this.#page.getByText('Credible evidence coverage')).toBeVisible()
    await expect(this.#page.getByText('Three strongest matches')).toBeVisible()
    await expect(this.#page.getByText('Three priority gaps')).toBeVisible()
    const criticalReserve = this.#page.getByRole('heading', {
      name: 'Critical Requirement Reserve',
    }).locator('..')
    await expect(criticalReserve).toContainText('Architecture leadership')
    await expect(this.#page.getByText('Important Practical Constraints')).toBeVisible()
    await this.#page.getByText('Complete requirement-to-evidence details').click()
    await expect(this.#page.getByText('Exact source excerpt: TypeScript is required.')).toBeVisible()
    await expect(this.#page.getByText('TypeScript', { exact: true }).last()).toBeVisible()
  }

  async expectCandidateFactAndFreshMatchAnalysis() {
    this.#expectCompletedAction('profile-enrichment-confirmed')
    expect(this.#lastMatchResponse).toEqual(expect.objectContaining({
      ok: true,
      value: expect.objectContaining({
        evidence: expect.arrayContaining([
          expect.objectContaining({ requirementId: 'job-requirement-4' }),
        ]),
      }),
    }))
    await expect(this.#page.getByText('77%')).toBeVisible()
    await this.#page.getByText('Complete requirement-to-evidence details').click()
    await expect(this.#page.getByText(
      'Practiced Architecture leadership across the organization',
    )).toBeVisible()
  }

  async expectLowScoreWarningAndTailoredResumeOffer() {
    this.#expectCompletedAction('job-posting-submitted')
    await expect(this.#page.getByText(
      'A low Match Score is a warning, not a generation block.',
    )).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Prepare my Tailored Resume' }))
      .toBeEnabled()
  }

  async expectOnlyNormalizedSourceResumeOffer() {
    this.#expectCompletedAction('job-posting-submitted')
    await expect(this.#page.getByText(
      'No relevant Candidate Fact supports an honest Tailored Resume.',
    )).toBeVisible()
    await expect(this.#page.getByRole('button', {
      name: 'Use my normalized source resume — not tailored',
    })).toBeEnabled()
    await expect(this.#page.getByRole('button', { name: 'Prepare my Tailored Resume' }))
      .toHaveCount(0)
  }

  #expectCompletedAction(expectedAction: CandidateJourneyAction) {
    expect(this.#completedAction, 'Expected a caller-visible Action before reading the outcome')
      .toBe(expectedAction)
  }

  #expectCompletedActionIn(expectedActions: readonly CandidateJourneyAction[]) {
    expect(expectedActions, 'Expected a caller-visible Action before reading the outcome')
      .toContain(this.#completedAction)
  }
}

type CandidateJourneyAction =
  | 'contact-corrected-and-reloaded'
  | 'wording-edited-and-reloaded'
  | 'candidate-journey-opened'
  | 'grouped-resume-prepared'
  | 'candidate-session-deleted'
  | 'candidate-session-restored'
  | 'candidate-session-started'
  | 'critical-ambiguity-answered'
  | 'french-locale-selected'
  | 'job-posting-submitted'
  | 'profile-enrichment-confirmed'
  | 'processing-consent-granted'
  | 'source-document-submitted'

const structuredSourceProfileResponse = {
  ok: true,
  value: {
    certifications: [],
    criticalAmbiguities: [],
    education: [],
    experiences: [{
      achievements: ['Built a billing platform'],
      context: null,
      endDate: null,
      organization: 'Acme',
      role: 'Senior FullStack Developer',
      startDate: '2021',
    }],
    languages: [],
    projects: [],
    skills: [
      { category: 'Programming language', name: 'TypeScript' },
      { category: 'Frontend', name: 'React' },
      { category: 'Runtime', name: 'Node.js' },
    ],
  },
} as const

const jobPostingText = [
  'We are hiring a Staff Engineer.',
  'TypeScript is required.',
  'React is central to the role.',
  'Node.js is central to the role.',
  'Architecture leadership is essential.',
  'Executive communication is expected.',
  'Kubernetes is a plus.',
  'Work from Paris three days per week.',
].join('\n')

const jobPostingExtractionResponse = {
  ok: true,
  value: {
    practicalConstraints: [{
      sourceExcerpt: 'Work from Paris three days per week.',
      value: 'Paris, three days per week',
    }],
    requirements: [
      requirement('1', 'technical-expertise', 'TypeScript', 'central', 'TypeScript is required.'),
      requirement('2', 'technical-expertise', 'React', 'central', 'React is central to the role.'),
      requirement('3', 'technical-expertise', 'Node.js', 'central', 'Node.js is central to the role.'),
      requirement('4', 'leadership', 'Architecture leadership', 'critical', 'Architecture leadership is essential.'),
      requirement('5', 'stakeholder-communication', 'Executive communication', 'central', 'Executive communication is expected.'),
      requirement('6', 'technical-expertise', 'Kubernetes', 'complementary', 'Kubernetes is a plus.'),
    ],
    targetRole: {
      sourceExcerpt: 'We are hiring a Staff Engineer.',
      value: 'Staff Engineer',
    },
  },
} as const

function requirement(
  identifier: string,
  dimension: 'leadership' | 'stakeholder-communication' | 'technical-expertise',
  value: string,
  importance: 'central' | 'complementary' | 'critical',
  sourceExcerpt: string,
) {
  return {
    capability: { dimension, name: value },
    id: `job-requirement-${identifier}`,
    importance,
    importanceRationale: `The source wording makes ${value} ${importance}.`,
    sourceExcerpt,
    value,
  }
}

const matchEvidenceResponse = {
  ok: true,
  value: {
    evidence: [
      evidence('1', 'source-fact-skills-0-name-0', 'TypeScript'),
      evidence('2', 'source-fact-skills-1-name-0', 'React'),
      evidence('3', 'source-fact-skills-2-name-0', 'Node.js'),
    ],
    relevance: [
      relevance('1', 'source-fact-skills-0-name-0', 'TypeScript'),
      relevance('2', 'source-fact-skills-1-name-0', 'React'),
      relevance('3', 'source-fact-skills-2-name-0', 'Node.js'),
    ],
  },
} as const

const lowMatchEvidenceResponse = {
  ok: true,
  value: {
    evidence: [evidence('1', 'source-fact-skills-0-name-0', 'TypeScript')],
    relevance: [relevance('1', 'source-fact-skills-0-name-0', 'TypeScript')],
  },
} as const

const unsupportedMatchEvidenceResponse = {
  ok: true,
  value: { evidence: [], relevance: [] },
} as const

function createEnrichedMatchEvidenceResponse({ enrichedFactId }: Readonly<{
  enrichedFactId: `source-fact-${string}`
}>) {
  return {
    ok: true,
    value: {
      evidence: [
        ...matchEvidenceResponse.value.evidence,
        evidence('4', enrichedFactId, 'Architecture leadership', 'Architecture leadership'),
      ],
      relevance: [
        ...matchEvidenceResponse.value.relevance,
        relevance('4', enrichedFactId, 'Architecture leadership'),
      ],
    },
  } as const
}

function evidence(
  identifier: string,
  factId: `source-fact-${string}`,
  requirementTerm: string,
  factTerm = requirementTerm,
) {
  return {
    coverage: 'covered',
    factMatches: [{ factId, factTerm, relationship: 'exact', requirementTerm }],
    requirementId: `job-requirement-${identifier}`,
  }
}

function relevance(
  identifier: string,
  factId: `source-fact-${string}`,
  requirementTerm: string,
  factTerm = requirementTerm,
) {
  return {
    factMatch: { factId, factTerm, relationship: 'exact', requirementTerm },
    requirementId: `job-requirement-${identifier}`,
  }
}

const criticalAmbiguitySourceProfileResponse = {
  ...structuredSourceProfileResponse,
  value: {
    ...structuredSourceProfileResponse.value,
    criticalAmbiguities: [{
      path: 'experiences.0.startDate.0',
      question: 'What year did you start at Acme?',
    }],
    experiences: [{
      ...structuredSourceProfileResponse.value.experiences[0],
      startDate: '2021 or 2022',
    }],
  },
} as const
