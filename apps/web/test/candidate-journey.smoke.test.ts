import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import { structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import type { ResumeCoherenceInput, ResumeFieldValidationInput, ResumeSectionWritingInput } from '@resume-tailoring/application/candidate-journey'
import { routeResumeSectionModels, writeFixtureSection } from './resume-section-model-routes'

test.describe('Candidate Journey preview-first preparation', () => {
  test('downloads the validated PDF shown by the active journey', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenCombinedIntake()
    await system.generateResume()
    await system.givenRequiredContactsArePresent()

    await system.downloadCurrentResume()

    await system.expectCurrentResumePdfDownloaded()
  })

  test('keeps unsupported text blocked and confirmable after repeated saves', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenCombinedIntake()
    await system.generateResume()
    await system.givenRequiredContactsArePresent()

    await system.givenUnsupportedProfessionalTextWasSaved()

    await system.saveUnsupportedProfessionalTextAgain()

    await system.expectUnsupportedDownloadBlocked()
  })

  test('blocks download immediately while an unsupported edit is still unsaved', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenCombinedIntake()
    await system.generateResume()
    await system.givenRequiredContactsArePresent()

    await system.enterUnsupportedProfessionalText()

    await system.expectUnsavedDownloadBlocked()
  })

  test('recovers a failed PDF render without losing the source or draft', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenCombinedIntake()
    await system.givenRenderingFails()
    await system.generateResume()
    await system.givenRequiredContactsArePresent()

    await system.retryResumePreview()

    await system.expectRecoveredPreview()
  })

  test('downloads a clearly non-tailored normalized PDF through the same quality gate', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'no-correspondence' })
    await system.givenNoCorrespondenceResult()
    await system.prepareNormalizedResume()
    await system.givenRequiredContactsArePresent()

    await system.downloadCurrentResume()

    await system.expectNormalizedResumePdfDownloaded()
  })

  test('blocks export when the current document loses its only contact method', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenCombinedIntake()
    await system.generateResume()
    await system.givenRequiredContactsArePresent()

    await system.removeResumeContact()

    await system.expectMissingContactDownloadBlocked()
  })


  test('recovers corrected local contacts after reloading the editor', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.correctContactAndReload()

    await system.expectCorrectedContactRecovered()
  })

  test('keeps unresolved wording visible and blocked after reloading', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.editUnsupportedWordingAndReload()

    await system.expectUnresolvedWordingRecovered()
  })

  test('prepares a grouped semantic preview with a readable mobile order', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.expectPreviewFirstReview()
    await system.expectGroupedPreview()
  })

  test('keeps semantic metadata when an employer is hidden and restored', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.hideAndRestoreEmployer()

    await system.expectGroupedPreview()
  })

  test('keeps candidate section ordering in the preview', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.moveExperienceBeforeSummary()

    await system.expectExperienceBeforeSummary()
  })

  test('restores a complete hidden experience without losing its metadata', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.hideAndRestoreExperience()

    await system.expectGroupedPreview()
  })


  test('generates a coherent preview from combined intake in one action', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectGroupedPreview()
  })

  test('renews expired demo access and resumes the preparation it interrupted', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'expired-access' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectGroupedPreview()
    system.expectAccessRenewedOnce()
  })

  test('isolates nonblocking ambiguity and still produces a usable preview', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'isolated-ambiguity' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectIsolatedAmbiguityWithPreview()
  })

  test('resumes after a blocking targeted correction without a second generation approval', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'blocking-ambiguity' })
    await system.givenBlockedPreparation()

    await system.correctBlockingAmbiguity()

    await system.expectCorrectedPreview()
  })

  test('warns on low coverage without blocking the preview', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'low-coverage' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectLowCoveragePreview()
  })

  test('shows Adjacent Evidence next to a gap without presenting it as coverage', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'adjacent-evidence' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectAdjacentEvidenceNextToTheGap()
  })

  test('explains no correspondence and offers a non-tailored document', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'no-correspondence' })
    await system.givenNoCorrespondenceResult()

    await system.prepareNormalizedResume()

    await system.expectNormalizedPreview()
  })

  test('keeps the current extracted profile inspectable without correspondence', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'no-correspondence' })
    await system.givenNoCorrespondenceResult()

    await system.inspectSourceProfile()

    await system.expectCurrentSourceEvidence()
  })

  test('retains an optional source correction when retrying a failed first generation', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'isolated-ambiguity' })
    await system.givenFailedResumeWithOptionalCorrection()

    await system.correctSourceAndRetry()

    await system.expectCorrectedSourceInPreview()
  })

  test('removes a pending correction when the posting changes', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'blocking-ambiguity' })
    await system.givenBlockedPreparation()

    await system.replacePosting()

    await system.expectOutdatedCorrectionRemoved()
  })

  test('supports a French override and retains the original employer', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenCombinedIntakeInFrench()

    await system.generateResume()

    await system.expectFrenchPreview()
  })

  test('does not publish unsafe model wording', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'unsafe-output' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectUnsafeOutputRejected()
  })

  test('marks only the experience copied from the resume as taken as written, outside the exported PDF', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'copied-experience' })
    await system.givenCombinedIntake()
    await system.generateResume()
    await system.givenRequiredContactsArePresent()

    await system.downloadCurrentResume()

    await system.expectOnlyFirstExperienceMarkedCopied()
  })

  test('explains a resume that stays incoherent and keeps its checked sections', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'incoherent' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectIncoherentSectionsExplained()
  })

  test('summarizes a failed experience above the kept sections and leads to it', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'failed-experience' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectFailedExperienceSummarized()
  })

  test('recovers interrupted preparation after reload', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'interrupted' })
    await system.givenInterruptedPreparation()

    await system.resumePreparation()

    await system.expectGroupedPreview()
  })

  test('offers a single retry action on the documents after an interrupted preparation', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'interrupted' })
    await system.givenCombinedIntake()

    await system.interruptPreparationByReloading()

    await system.expectOneRetryActionOnTheDocuments()
  })

  test('retains a stable preview after failed regeneration', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.regenerateWithUnavailableWriter()

    await system.expectStablePreviewAfterFailure()
  })

  test('can hide and restore an employer without losing experience associations', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.hideAndRestoreEmployer()

    await system.expectGroupedPreview()
  })

  test('keeps consent, local session restoration and deletion accessible', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenStablePreview()

    await system.restoreAndDeleteSession()

    await system.expectDeletedSession()
  })

  test('reveals validated sections under resume-language headings while another is still a placeholder', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'held-skills' })
    await system.givenCombinedIntakeInFrench()

    await system.generateResume()

    await system.expectFrenchSectionsRevealedBesideTheSkillsPlaceholder()
  })

  test('downloads the complete preview once the last section is validated', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'held-skills' })
    await system.givenCombinedIntake()
    await system.generateResume()
    await system.givenHeldSkillsSectionReleased()
    await system.givenRequiredContactsArePresent()

    await system.downloadCurrentResume()

    await system.expectCurrentResumePdfDownloaded()
  })

  test('points to each missing document and focuses the first one', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.openUnconsentedIntake()

    await system.requestGenerationWithoutDocuments()

    await system.expectEachMissingDocumentExplainedAtItsField()
  })

  test('announces the writing phase and the step reached while the resume is being written', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'pending-writing' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectWritingPhaseAnnouncedWithItsStep()
  })

  test('keeps secondary text, the consent notice and the focus ring readable', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    await system.openUnconsentedIntake()

    await system.expectReadableSecondaryTextAndFocusRing()
  })

  test('locks the intake while the resume is being prepared', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'pending-writing' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectIntakeLockedDuringPreparation()
  })

  test('hides analysis and source disclosures until a result exists', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    await system.openUnconsentedIntake()

    await system.expectNoEmptyResultDisclosures()
  })

  test('shows a dropped resume file as the selected source', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.openUnconsentedIntake()

    await system.dropSourceFile({ name: 'alex-morgan.pdf', mimeType: 'application/pdf' })

    await system.expectSelectedSourceFile('alex-morgan.pdf')
  })

  test('explains a dropped resume file in an unsupported format', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.openUnconsentedIntake()

    await system.dropSourceFile({ name: 'alex-morgan.png', mimeType: 'image/png' })

    await system.expectRejectedSourceFile()
  })

  test('offers to choose a file rather than drop one on a touch screen', async ({ page, hasTouch }) => {
    const system = createSystemUnderTest({ page })

    await system.openUnconsentedIntake()

    await system.expectFileChoiceCopyFor({ touch: hasTouch })
  })

  for (const width of [320, 375]) {
    test(`fits the intake and its header to a ${String(width)}px screen`, async ({ page }) => {
      const system = createSystemUnderTest({ page })
      await system.givenScreenWidth(width)

      await system.openUnconsentedIntake()

      await system.expectNoHorizontalScroll()
      await system.expectNoNestedDocumentCards()
      await system.expectHeaderWithinItsBar()
    })
  }

  test('explains a failed posting analysis in a single alert', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'posting-extraction-unavailable' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectSinglePostingFailureAlert()
  })

  test('waits out a rate limit before offering to try again', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenRateLimitedPreparation()

    await system.retryOnceTheWaitIsOver()

    await system.expectGroupedPreview()
  })

  test('leads back to the documents when the job posting is too long', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenTooLongPostingFailure()

    await system.shortenInput()

    await system.expectDocumentsToShorten()
  })

  test('offers a reload when the service answers unexpectedly and keeps the inputs', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenUnexpectedSourceFailure()

    await system.reloadPage()

    await system.expectFailureKeptAfterReload()
  })

  test('replaces a page that crashed while rendering and restores the Candidate Session on reload', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenUnexpectedSourceFailure()
    await system.givenPageCrashedWhileRendering()

    await system.reloadFromSafetyNet()

    await system.expectInputsRestored()
  })

  test('discloses the Processing Policy at the generation action', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    await system.openUnconsentedIntake()

    await system.expectPolicyDisclosedAtGeneration()
  })
})

function createSystemUnderTest({ page, scenario = 'normal' }: Readonly<{ page: Page; scenario?: Scenario }>) {
  return new CandidateJourneyTestSystem(page, scenario)
}

type Scenario = 'normal' | 'isolated-ambiguity' | 'blocking-ambiguity' | 'low-coverage' | 'adjacent-evidence' | 'no-correspondence'
  | 'unsafe-output' | 'interrupted' | 'unavailable' | 'pending-writing' | 'posting-extraction-unavailable' | 'held-skills'
  | 'incoherent' | 'expired-access' | 'copied-experience' | 'failed-experience'

class CandidateJourneyTestSystem {
  readonly #page: Page
  readonly #errors: string[] = []
  #downloadPath: string | null = null
  #scenario: Scenario
  #completedAction: string | null = null
  #hasTriggeredExpiry = false
  #isAccessExpired = false
  #accessRenewals = 0
  #releaseHeldSkills: () => void = () => undefined
  readonly #heldSkills = new Promise<void>((resolve) => { this.#releaseHeldSkills = resolve })

  constructor(page: Page, scenario: Scenario) {
    this.#page = page; this.#scenario = scenario
    page.on('pageerror', (error) => { if (!isCancelledByLeavingPage(error.message)) this.#errors.push(error.message) })
  }

  async #installModelAdapters() {
    await this.#page.route('**/api/resume-claim-validation', (route) => route.fulfill({ status: 502, json: {
      ok: false, error: { type: 'provider-unavailable' },
    } }))
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => route.fulfill({ json: {
      ok: true, value: extractionFor(this.#scenario),
    } }))
    await this.#page.route('**/api/explainable-job-posting-extraction', (route) => route.fulfill(this.#scenario === 'posting-extraction-unavailable'
      ? { status: 502, json: { ok: false, error: { type: 'provider-unavailable' } } } : { json: {
      ok: true, value: { targetRole: structuredResumeJobMatch.targetRole, practicalConstraints: [], requirements: requirementsFor(this.#scenario) },
    } }))
    await this.#page.route('**/api/explainable-match-evidence', (route) => route.fulfill({ json: {
      ok: true, value: matchFor(this.#scenario),
    } }))
    await routeResumeSectionModels(this.#page, { write: writeFixtureSection, supported: () => this.#scenario !== 'unsafe-output' })
    await this.#page.route('**/api/resume-section-writing', (route) => {
      if (this.#scenario === 'interrupted') return route.abort()
      if (this.#scenario === 'pending-writing') return new Promise<void>(() => undefined)
      if (this.#scenario === 'held-skills' && (route.request().postDataJSON() as ResumeSectionWritingInput).section.kind === 'skills') {
        return this.#heldSkills.then(() => route.fallback())
      }
      if (this.#scenario === 'unavailable') return route.fulfill({ status: 502, json: { ok: false, error: { type: 'invalid-provider-response' } } })
      // Only the second experience cannot be written, so the preparation fails with every other section kept.
      if (this.#scenario === 'failed-experience' && (route.request().postDataJSON() as ResumeSectionWritingInput).section.key === 'experiences.1') {
        return route.fulfill({ status: 502, json: { ok: false, error: { type: 'provider-unavailable' } } })
      }
      if (this.#scenario === 'expired-access' && !this.#hasTriggeredExpiry) {
        this.#hasTriggeredExpiry = true
        this.#isAccessExpired = true
      }
      if (this.#isAccessExpired) {
        return route.fulfill({ status: 401, json: { ok: false, error: { type: 'demo-access-required' } } })
      }
      return route.fallback()
    })
    // The first experience is never supported, before or after its rewrite, so it is copied from its Candidate Facts.
    await this.#page.route('**/api/resume-section-validation', (route) => {
      const input = route.request().postDataJSON() as ResumeFieldValidationInput
      if (this.#scenario !== 'copied-experience' || input.section.key !== 'experiences.0') return route.fallback()
      return route.fulfill({ json: { ok: true, value: { fields: input.fields.map(({ id }) => ({ fieldId: id, supported: false })) } } })
    })
    // The demo access cookie stays expired until the Candidate passes a new security check.
    await this.#page.route('**/api/demo-access', (route) => {
      if (this.#isAccessExpired) this.#accessRenewals += 1
      this.#isAccessExpired = false
      return route.fallback()
    })
    await this.#page.route('**/api/resume-document-coherence', (route) => {
      if (this.#scenario !== 'incoherent') return route.fallback()
      // The Value Proposition keeps mixing two experiences, before and after its rewrite; a redundancy would be removed.
      const { document } = route.request().postDataJSON() as ResumeCoherenceInput
      const fieldId = document.valueProposition.paragraphs[0]?.id ?? 'missing-field'
      return route.fulfill({ json: { ok: true, value: { coherent: false, languageMatches: true,
        issues: [{ fieldId, kind: 'mixed-association' }] } } })
    })
  }

  async openUnconsentedIntake() {
    await this.#installModelAdapters()
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Get started', exact: true }).click()
    this.#completedAction = 'intake-opened'
  }

  async givenCombinedIntake() {
    await this.openUnconsentedIntake()
    await this.#page.getByRole('textbox', { name: 'Professional text', exact: true }).fill(
      'Alex Morgan\nalex@example.com\nFrontend Engineer at Northwind. Built accessible billing screens. React and TypeScript.')
    await this.#page.getByRole('textbox', { name: 'Job posting text', exact: true }).fill(postingText)
  }

  expectAccessRenewedOnce() {
    this.#expectAction()
    expect(this.#accessRenewals).toBe(1)
  }

  async givenCombinedIntakeInFrench() {
    await this.givenCombinedIntake()
    await this.#page.getByRole('combobox', { name: 'Resume language', exact: true }).click()
    await this.#page.getByRole('option', { name: 'Français', exact: true }).click()
  }

  async generateResume() {
    await this.#page.getByRole('button', { name: 'Generate my resume', exact: true }).click()
    await expect(this.#page).toHaveURL(/\/resume$/u)
    await expect(this.#page.locator('#combined-intake-title')).toHaveCount(0)
    this.#completedAction = 'generated'
  }

  async #returnToDocuments() {
    await this.#page.getByRole('link', { name: 'Back to my documents', exact: true }).click()
    await expect(this.#page).toHaveURL(/\/$/u)
  }

  async givenStablePreview() {
    await this.givenCombinedIntake()
    await this.generateResume()
    await this.#showDocumentText()
    await expect(this.#page.locator('iframe')).toBeVisible()
  }

  async givenBlockedPreparation() {
    await this.givenCombinedIntake()
    await this.generateResume()
    await expect(this.#page.getByRole('textbox', { name: 'Which skill did you use?' })).toBeVisible()
    await expect(this.#page.getByTitle('Tailored resume preview')).toHaveCount(0)
  }

  async correctBlockingAmbiguity() {
    await this.#page.getByRole('textbox', { name: 'Which skill did you use?' }).fill('React')
    await this.#page.getByRole('button', { name: 'Save this answer' }).click()
    this.#completedAction = 'corrected'
  }

  async givenNoCorrespondenceResult() {
    await this.givenCombinedIntake()
    await this.generateResume()
    await expect(this.#page.getByTitle('Tailored resume preview')).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Prepare a non-tailored resume' })).toBeVisible()
  }

  async givenFailedResumeWithOptionalCorrection() {
    await this.givenCombinedIntake()
    await this.#page.route('**/api/resume-section-writing', (route) => route.fulfill({ status: 502, json: { ok: false, error: { type: 'invalid-provider-response' } } }))
    await this.generateResume()
    await expect(this.#page.getByText('Preparation could not finish.', { exact: false }).first()).toBeVisible()
    await this.#page.getByRole('button', { name: 'Back to my documents', exact: true }).click()
    await this.#page.getByText('See or add to what we took from your resume', { exact: true }).click()
    await this.#page.unroute('**/api/resume-section-writing')
    await this.#installModelAdapters()
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => route.fulfill({ status: 502, json: { ok: false, error: { type: 'provider-unavailable' } } }))
  }

  async correctSourceAndRetry() {
    await this.#page.getByRole('textbox', { name: 'Which team?' }).fill('Billing platform team')
    await this.#page.getByRole('button', { name: 'Save this answer' }).click()
    await expect(this.#page.getByRole('textbox', { name: 'Which team?' })).toHaveCount(0)
    await this.generateResume()
    this.#completedAction = 'corrected-and-retried'
  }

  async expectCorrectedSourceInPreview() {
    this.#expectAction()
    await this.#showDocumentText()
    await expect(this.#page.locator('iframe')).toBeVisible()
    await expect(this.#page.frameLocator('iframe').getByText('Billing platform team', { exact: true })).toBeVisible()
  }

  async inspectSourceProfile() {
    await this.#page.getByRole('button', { name: 'Back to my documents', exact: true }).click()
    await this.#page.getByText('See or add to what we took from your resume', { exact: true }).click()
    await this.#page.getByRole('button', { name: 'See what we took from your resume', exact: true }).click()
    this.#completedAction = 'inspected'
  }

  async replacePosting() {
    await this.#returnToDocuments()
    await this.#page.getByRole('textbox', { name: 'Job posting text', exact: true }).fill('Rust engineer. Rust is required.')
    this.#completedAction = 'posting-replaced'
  }

  async expectCurrentSourceEvidence() {
    this.#expectAction()
    const source = this.#page.getByRole('region', { name: 'Add your resume' })
    await expect(source.getByText('Frontend Engineer – Northwind', { exact: true })).toBeVisible()
    await expect(source.getByText('Built accessible billing screens', { exact: true })).toBeVisible()
  }

  async expectOutdatedCorrectionRemoved() {
    this.#expectAction()
    await expect(this.#page.getByRole('textbox', { name: 'Which skill did you use?' })).toHaveCount(0)
    await expect(this.#page.getByTitle('Tailored resume preview')).toHaveCount(0)
  }

  async prepareNormalizedResume() {
    await this.#page.getByRole('button', { name: 'Prepare a non-tailored resume' }).click()
    this.#completedAction = 'normalized'
  }

  async givenInterruptedPreparation() {
    await this.givenCombinedIntake()
    await this.interruptPreparationByReloading()
    await this.#page.unroute('**/api/resume-section-writing')
    this.#scenario = 'normal'
    await this.#installModelAdapters()
  }

  /** Reloads while a section is being written, which leaves the preparation interrupted. */
  async interruptPreparationByReloading() {
    await this.#page.route('**/api/resume-section-writing', async (route) => {
      await new Promise((resolve) => { setTimeout(resolve, 2_000) })
      await route.abort().catch(() => undefined)
    })
    await this.generateResume()
    await expect(this.#page.getByRole('region', { name: 'Progress', exact: true })).toContainText('Writing')
    await this.#page.reload()
    await expect(this.#page.getByText('Generation was interrupted.', { exact: false })).toBeVisible()
    this.#completedAction = 'interrupted'
  }

  async resumePreparation() {
    await this.#page.getByRole('button', { name: 'Try again' }).click()
    this.#completedAction = 'resumed'
  }

  async regenerateWithUnavailableWriter() {
    this.#scenario = 'unavailable'
    await this.#returnToDocuments()
    await this.#page.getByRole('button', { name: 'Regenerate my resume', exact: true }).click()
    await expect(this.#page.getByRole('dialog')).toContainText('including manual edits')
    await this.#page.getByRole('button', { name: 'Replace and regenerate' }).click()
    this.#completedAction = 'regenerated'
  }

  async correctContactAndReload() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByLabel('Email', { exact: true }).fill('updated@example.com')
    await this.#page.reload()
    this.#completedAction = 'contact-corrected-and-reloaded'
  }

  async expectCorrectedContactRecovered() {
    this.#expectAction()
    await this.#showDocumentText()
    await expect(this.#page.frameLocator('iframe').getByText('updated@example.com', { exact: true })).toBeVisible()
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await expect(this.#page.getByLabel('Email', { exact: true })).toHaveValue('updated@example.com')
  }

  async editUnsupportedWordingAndReload() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await this.#page.getByLabel('Resume field', { exact: true }).first().fill('Led 100 engineers')
    await this.#page.getByRole('button', { name: 'Save wording', exact: true }).first().click()
    await this.#page.reload()
    this.#completedAction = 'wording-edited-and-reloaded'
  }

  async expectUnresolvedWordingRecovered() {
    this.#expectAction()
    await this.#showDocumentText()
    await expect(this.#page.frameLocator('iframe').getByText('Led 100 engineers', { exact: true })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await expect(this.#page.getByText("This edit adds something your resume doesn't mention.", { exact: true })).toBeVisible()
  }

  async expectPreviewFirstReview() {
    await expect(this.#page.getByRole('button', { name: 'Edit resume', exact: true })).toBeVisible()
    await expect(this.#page.getByLabel('Resume field', { exact: true })).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible()
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await expect(this.#page.getByRole('dialog')).toBeVisible()
    await this.#page.keyboard.press('Escape')
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Edit resume', exact: true })).toBeFocused()
  }

  async givenRequiredContactsArePresent() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Name', exact: true }).fill('Alex Morgan')
    await this.#page.getByRole('textbox', { name: 'Email', exact: true }).fill('alex@example.com')
    await this.#page.keyboard.press('Escape')
  }

  async downloadCurrentResume() {
    const downloadPromise = this.#page.waitForEvent('download')
    await this.#page.getByRole('button', { name: 'Download PDF', exact: true }).click({ timeout: 20_000 })
    this.#downloadPath = await (await downloadPromise).path()
  }

  async expectCurrentResumePdfDownloaded() {
    expect(this.#downloadPath, 'downloadCurrentResume must run first').not.toBeNull()
    if (this.#downloadPath === null) return
    const { pageCount, text } = await this.#readDownloadedPdf()
    expect(pageCount).toBe(1)
    expect(text).toContain('Alex Morgan')
    expect(text).toContain('Northwind')
    expect(text).toContain('React')
    await expect(this.#page.locator('.resume-pdf-pages canvas')).toHaveCount(pageCount)
    await expect(this.#page.getByRole('status').filter({ hasText: 'PDF handed to your browser' })).toBeVisible()
    await this.#page.getByText('Read the document text', { exact: true }).click()
    await this.#page.setViewportSize({ width: 1280, height: 1800 })
    await this.#page.getByRole('region', { name: 'Preview and export' }).screenshot({ path: 'test-results/bak-59-preview.png' })
  }

  async expectOnlyFirstExperienceMarkedCopied() {
    this.#expectAction()
    const copied = this.#page.getByRole('list', { name: 'Experiences taken as written', exact: true })
    await expect(copied.getByRole('listitem')).toHaveCount(1)
    await expect(copied).toContainText('Frontend Engineer – Northwind')
    await expect(this.#page.getByText('Taken as written from your resume', { exact: true })).toHaveCount(1)
    await this.#showDocumentText()
    await expect(this.#page.frameLocator('iframe').getByText('Taken as written', { exact: false })).toHaveCount(0)
    const { text } = await this.#readDownloadedPdf()
    expect(text).toContain('Northwind')
    expect(text).not.toContain('Taken as written')
    expect(this.#errors).toEqual([])
  }

  async #readDownloadedPdf() {
    if (this.#downloadPath === null) throw new Error('downloadCurrentResume must run first')
    const loading = getDocument({ data: new Uint8Array(await readFile(this.#downloadPath)) })
    try {
      const pdf = await loading.promise
      const pages = await Promise.all(Array.from({ length: pdf.numPages }, (_page, index) => pdf.getPage(index + 1)))
      const contents = await Promise.all(pages.map((pdfPage) => pdfPage.getTextContent()))
      return { pageCount: pdf.numPages,
        text: contents.flatMap(({ items }) => items.flatMap((item) => 'str' in item ? item.str : [])).join(' ') }
    } finally { await loading.destroy() }
  }

  async enterUnsupportedProfessionalText() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Resume field', exact: true }).first()
      .fill('Built accessible billing screens and led 500 engineers')
  }

  async givenUnsupportedProfessionalTextWasSaved() {
    await this.enterUnsupportedProfessionalText()
    await this.saveUnsupportedProfessionalTextAgain()
  }

  async saveUnsupportedProfessionalTextAgain() {
    await this.#page.getByRole('button', { name: 'Save wording', exact: true }).first().click()
  }

  async expectUnsavedDownloadBlocked() {
    await expect(this.#page.getByRole('dialog')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true, includeHidden: true })).toBeDisabled()
  }

  async expectUnsupportedDownloadBlocked() {
    await expect(this.#page.getByRole('button', { name: 'Confirm this is accurate', exact: true })).toBeVisible()
    await this.#page.keyboard.press('Escape')
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled({ timeout: 20_000 })
    await expect(this.#page.getByText('Resolve or confirm the unsupported professional changes before downloading.', { exact: true })).toBeVisible()
  }

  async givenRenderingFails() {
    await this.#page.route('**/api/resume-document', (route) => route.fulfill({ status: 503,
      json: { ok: false, error: { type: 'provider-unavailable' } } }))
  }

  async retryResumePreview() {
    const preview = this.#page.getByRole('region', { name: 'Preview and export' })
    await expect(preview.getByRole('alert')).toContainText('The writing service did not answer correctly.')
    await this.#page.unroute('**/api/resume-document')
    await preview.getByRole('button', { name: 'Try again', exact: true }).click()
  }

  async givenRateLimitedPreparation() {
    await this.givenCombinedIntake()
    await this.#page.route('**/api/resume-section-writing', (route) => route.fulfill({ status: 429,
      headers: { 'Retry-After': '2' }, json: { ok: false, error: { type: 'rate-limited', retryAfterSeconds: 2 } } }))
    await this.generateResume()
    const alert = this.#page.getByRole('alert').filter({ hasText: 'Preparation could not finish.' })
    await expect(alert).toContainText('Too many requests were sent in a short time.')
    await expect(alert.getByRole('button', { name: /^Try again in \d s$/u })).toBeDisabled()
  }

  async retryOnceTheWaitIsOver() {
    await this.#page.unroute('**/api/resume-section-writing')
    await this.#installModelAdapters()
    const retry = this.#page.getByRole('alert').getByRole('button', { name: 'Try again', exact: true })
    await expect(retry).toBeEnabled({ timeout: 5_000 })
    await retry.click()
    this.#completedAction = 'retried-after-wait'
  }

  async givenTooLongPostingFailure() {
    await this.givenCombinedIntake()
    await this.#page.route('**/api/explainable-job-posting-extraction', (route) => route.fulfill({ status: 413,
      json: { ok: false, error: { type: 'input-too-large' } } }))
    await this.generateResume()
    await expect(this.#page.getByRole('alert')).toContainText('The text is longer than the service accepts.')
  }

  async shortenInput() {
    await this.#page.getByRole('alert').getByRole('button', { name: 'Shorten my text', exact: true }).click()
    this.#completedAction = 'shortening'
  }

  async expectDocumentsToShorten() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/$/u)
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toHaveValue(postingText)
  }

  async givenUnexpectedSourceFailure() {
    await this.givenCombinedIntake()
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => route.fulfill({ status: 503,
      json: { ok: false, error: { type: 'service-misconfigured' } } }))
    await this.generateResume()
    await expect(this.#page.getByRole('alert')).toContainText('The service answered in an unexpected way.')
  }

  /** A file over 1 MB shows its size through Intl.NumberFormat, which this page can no longer build. */
  async givenPageCrashedWhileRendering() {
    const reports: string[] = []
    await this.#page.route('**/api/analytics', (route) => {
      const body = route.request().postData() ?? ''
      if (body.includes('uncaught-error-reported')) reports.push(body)
      return route.fulfill({ status: 202 })
    })
    await this.#returnToDocuments()
    await this.#page.evaluate(() => {
      Intl.NumberFormat = function () { throw new Error('Intl.NumberFormat is unavailable') } as unknown as typeof Intl.NumberFormat
    })
    await this.#page.locator('.intake-dropzone input[type="file"]').first()
      .setInputFiles({ name: 'alex-morgan.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2 * 1024 * 1024) })
    await expect(this.#page.getByRole('heading', { name: 'Something went wrong', exact: true })).toBeVisible()
    await expect(this.#page.getByRole('link', { name: 'Back to my documents', exact: true })).toHaveAttribute('href', '/')
    await expect.poll(() => reports).toContain(JSON.stringify({ name: 'uncaught-error-reported', source: 'render' }))
    expect(reports.join()).not.toContain('Intl.NumberFormat')
  }

  async reloadFromSafetyNet() {
    const reloaded = this.#page.waitForEvent('framenavigated')
    await this.#page.getByRole('button', { name: 'Reload', exact: true }).click()
    await reloaded
    this.#completedAction = 'reloaded'
  }

  async reloadPage() {
    const reloaded = this.#page.waitForEvent('framenavigated')
    await this.#page.getByRole('alert').getByRole('button', { name: 'Reload the page', exact: true }).click()
    await reloaded
    this.#completedAction = 'reloaded'
  }

  async expectInputsRestored() {
    this.#expectAction()
    await expect(this.#page.getByRole('heading', { name: 'Something went wrong', exact: true })).toHaveCount(0)
    await expect(this.#page.getByRole('textbox', { name: 'Professional text', exact: true })).toHaveValue(/Northwind/u)
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toHaveValue(postingText)
  }

  async expectFailureKeptAfterReload() {
    this.#expectAction()
    const alert = this.#page.getByRole('alert').filter({ hasText: 'Preparation could not finish.' })
    await expect(alert).toContainText('We could not analyze your resume.')
    await expect(alert).toContainText('Your inputs are kept.')
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toHaveValue(postingText)
  }

  async expectRecoveredPreview() {
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 20_000 })
    await this.#showDocumentText()
    await expect(this.#page.frameLocator('iframe').getByText('Northwind', { exact: true })).toBeVisible()
    const session = await this.#page.evaluate(() => localStorage.getItem('honest-resume:candidate-session'))
    expect(session).toContain('Northwind')
  }

  async expectNormalizedResumePdfDownloaded() {
    expect(this.#downloadPath, 'downloadCurrentResume must run first').not.toBeNull()
    if (this.#downloadPath === null) return
    const loading = getDocument({ data: new Uint8Array(await readFile(this.#downloadPath)) })
    try {
      const pdf = await loading.promise
      const pdfPage = await pdf.getPage(1)
      const text = (await pdfPage.getTextContent()).items.flatMap((item) => 'str' in item ? item.str : []).join(' ')
      expect(text).toContain('General resume – not tailored to a job')
      expect(text).toContain('Alex Morgan')
      expect(pdf.numPages).toBe(1)
    } finally { await loading.destroy() }
  }

  async removeResumeContact() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Email', exact: true }).fill('')
    await this.#page.keyboard.press('Escape')
  }

  async expectMissingContactDownloadBlocked() {
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
    await expect(this.#page.getByText('Add an email address or phone number in contact details.', { exact: true })).toBeVisible({ timeout: 20_000 })
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

  async restoreAndDeleteSession() {
    await this.#page.reload()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible()
    await this.#returnToDocuments()
    await expect(this.#page.getByText(/^Processed by .+, with nothing stored on our servers.$/)).toBeVisible()
    await this.#page.getByRole('button', { name: 'Delete my data', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Delete my data now', exact: true }).click()
    this.#completedAction = 'deleted'
  }

  async expectGroupedPreview() {
    this.#expectAction()
    await this.#showDocumentText()
    await expect(this.#page.locator('iframe')).toBeVisible()
    const preview = this.#page.frameLocator('iframe')
    const experience = preview.locator('article').filter({ has: preview.getByRole('heading', { name: 'Frontend Engineer', exact: true }) })
    await expect(experience).toContainText('Northwind')
    await expect(experience).toContainText('2021 – 2024')
    await expect(experience).toContainText('Built accessible billing screens')
    await expect(preview.locator('.skill-group')).toHaveText('Front-endReact · TypeScript')
    await expect(preview.locator('li').filter({ hasText: /^Front-end$/ })).toHaveCount(0)
    await expect(this.#page.locator('vite-error-overlay')).toHaveCount(0)
    expect(this.#errors).toEqual([])
    const contentWidth = await preview.locator('body').evaluate((body) => body.scrollWidth)
    const frameWidth = await this.#page.locator('iframe').evaluate((frame) => frame.clientWidth)
    expect(contentWidth).toBeLessThanOrEqual(frameWidth)
  }

  async expectIsolatedAmbiguityWithPreview() {
    await this.expectGroupedPreview()
    await expect(this.#page.getByText('Unclear details were left out.', { exact: false })).toBeVisible()
    await expect(this.#page.frameLocator('iframe').getByText('Customer billing team')).toHaveCount(0)
  }

  async expectCorrectedPreview() {
    this.#expectAction()
    await this.#showDocumentText()
    await expect(this.#page.locator('iframe')).toBeVisible()
    await expect(this.#page.frameLocator('iframe').getByText('React experience.')).toBeVisible()
    await expect(this.#page.getByRole('textbox', { name: 'Which skill did you use?' })).toHaveCount(0)
  }

  async expectLowCoveragePreview() {
    await this.expectGroupedPreview()
    await expect(this.#page.getByText('A low match score', { exact: false })).toBeVisible()
  }

  async expectAdjacentEvidenceNextToTheGap() {
    await this.expectGroupedPreview()
    await this.#page.getByText('Job match and the experience behind it', { exact: true }).click()
    const gaps = this.#page.getByRole('listitem').filter({ hasText: /^Java/u })
    await expect(gaps.first()).toContainText(
      'Related experience you can highlight instead (it does not meet this requirement): TypeScript')
    await this.#page.getByText('All requirements and the experience that meets them', { exact: true }).click()
    const javaDetail = this.#page.locator('.mantine-Paper-root').filter({ hasText: 'Java is required.' }).last()
    await expect(javaDetail).toContainText('Uncovered')
    await expect(javaDetail).toContainText('Nothing in your resume supports it.')
    await expect(javaDetail).toContainText('it does not meet this requirement): TypeScript')
    await expect(javaDetail.getByText('Covered', { exact: true })).toHaveCount(0)
  }

  async expectNormalizedPreview() {
    this.#expectAction()
    await expect(this.#page.getByText('Non-tailored resume ready', { exact: true })).toBeVisible()
    await this.#showDocumentText()
    await expect(this.#page.frameLocator('iframe').getByText('General resume – not tailored to a job', { exact: false })).toBeVisible()
  }

  async expectFrenchPreview() {
    this.#expectAction()
    await this.#showDocumentText()
    await expect(this.#page.locator('iframe')).toBeVisible()
    await expect(this.#page.frameLocator('iframe').getByText('Développement d’interfaces de facturation accessibles.', { exact: true })).toBeVisible()
    await expect(this.#page.frameLocator('iframe').getByText('Northwind', { exact: true })).toBeVisible()
  }

  async expectIncoherentSectionsExplained() {
    this.#expectAction()
    await expect(this.#page.getByText('Some sections repeated or contradicted one another', { exact: false })).toBeVisible()
    const keptSections = this.#page.getByRole('region', { name: 'Checked sections kept' })
    await expect(keptSections.getByText('Not prepared: Summary.', { exact: true })).toBeVisible()
    await expect(keptSections.getByRole('heading', { name: 'Experience' })).toBeVisible()
    await expect(this.#page.getByRole('heading', { name: 'Your resume is taking shape' })).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Try again' })).toBeEnabled()
  }

  async expectFailedExperienceSummarized() {
    this.#expectAction()
    const summary = this.#page.getByRole('alert').filter({ hasText: 'Preparation could not finish.' })
    const keptSections = this.#page.getByRole('region', { name: 'Checked sections kept' })
    const failedExperience = 'Experience: Software Developer – Contoso'
    await expect(keptSections.getByRole('heading', { name: 'Experience' })).toBeVisible()
    const [summaryBox, keptBox] = await Promise.all([summary.boundingBox(), keptSections.boundingBox()])
    expect(summaryBox?.y).toBeLessThan(keptBox?.y ?? 0)
    await expect(this.#page.getByRole('button', { name: 'Try again' })).toHaveCount(1)

    await summary.getByRole('link', { name: failedExperience }).click()

    await expect(keptSections.getByRole('group', { name: failedExperience })).toBeFocused()
    await expect(keptSections.getByText(`Not prepared: ${failedExperience}.`, { exact: true })).toBeVisible()
  }

  async expectUnsafeOutputRejected() {
    this.#expectAction()
    await expect(this.#page.getByText("The generated wording isn't backed by your resume", { exact: false })).toBeVisible()
    await expect(this.#page.getByTitle('Tailored resume preview')).toHaveCount(0)
  }

  async expectStablePreviewAfterFailure() {
    this.#expectAction()
    await expect(this.#page.getByRole('alert').filter({ hasText: 'Preparation could not finish.' })).toBeVisible()
    await this.expectGroupedPreview()
  }

  async expectDeletedSession() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
    await expect(this.#page.getByText('Your data was deleted from this browser.')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Generate my resume' })).toHaveCount(0)
  }

  async dropSourceFile({ name, mimeType }: Readonly<{ name: string; mimeType: string }>) {
    await this.#page.locator('.intake-dropzone input[type="file"]').first()
      .setInputFiles({ name, mimeType, buffer: Buffer.from('%PDF-1.4 synthetic') })
    this.#completedAction = 'source-file-dropped'
  }

  async expectSelectedSourceFile(name: string) {
    this.#expectAction()
    await expect(this.#page.getByText(name, { exact: true })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
    await expect(this.#page.getByRole('textbox', { name: 'Professional text', exact: true })).toHaveCount(0)
  }

  async expectRejectedSourceFile() {
    this.#expectAction()
    await expect(this.#page.getByRole('alert')).toContainText('This file cannot be used here.')
    await expect(this.#page.getByRole('textbox', { name: 'Professional text', exact: true })).toBeVisible()
  }

  async expectSinglePostingFailureAlert() {
    this.#expectAction()
    const alert = this.#page.getByRole('alert')
    await expect(alert).toHaveCount(1)
    await expect(alert).toContainText('Preparation could not finish.')
    await expect(alert).toContainText('We could not analyze the job posting.')
    await expect(alert).toContainText('Your inputs are kept.')
    await expect(alert.getByRole('button', { name: 'Try again' })).toBeEnabled()
  }

  async expectSectionRevealedBesideTheSkillsPlaceholder() {
    this.#expectAction()
    const preview = this.#page.getByRole('region', { name: 'Your resume is taking shape' })
    await expect(preview.getByRole('region', { name: 'Education' })).toContainText('Computer Science degree')
    await expect(preview.getByRole('region', { name: 'Skills' })).toContainText('Writing Skills…')
    await expect(preview.getByRole('region', { name: 'Skills' })).not.toContainText('React')
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Check page count', exact: true })).toHaveCount(0)
  }

  async expectFrenchSectionsRevealedBesideTheSkillsPlaceholder() {
    this.#expectAction()
    const preview = this.#page.getByRole('region', { name: 'Your resume is taking shape' })
    await expect(preview.getByRole('region', { name: 'Formation' })).toContainText('Computer Science degree')
    await expect(preview.getByRole('heading', { name: 'Profil', exact: true })).toHaveCount(1)
    // Consecutive experiences share one heading, as in the final document.
    await expect(preview.getByRole('heading', { name: 'Expérience', exact: true })).toHaveCount(1)
    const experiences = preview.getByRole('region', { name: 'Expérience' })
    await expect(experiences.getByText('Northwind', { exact: false })).toBeVisible()
    await expect(experiences.getByText('Contoso', { exact: false })).toBeVisible()
    // Status messages stay in the interface language; no skill is shown before validation.
    await expect(preview.getByRole('region', { name: 'Compétences' })).toContainText('Writing Skills…')
    await expect(preview.getByRole('region', { name: 'Compétences' })).not.toContainText('React')
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toHaveCount(0)
  }

  async givenHeldSkillsSectionReleased() {
    await this.expectSectionRevealedBesideTheSkillsPlaceholder()
    this.#releaseHeldSkills()
    await expect(this.#page.getByRole('region', { name: 'Your resume is taking shape' })).toHaveCount(0)
    await this.#showDocumentText()
    await expect(this.#page.frameLocator('iframe').getByText('React', { exact: false }).first()).toBeVisible()
  }

  async requestGenerationWithoutDocuments() {
    await this.#page.getByRole('button', { name: 'Generate my resume', exact: true }).click()
    this.#completedAction = 'generation-requested'
  }

  async expectEachMissingDocumentExplainedAtItsField() {
    this.#expectAction()
    const source = this.#page.getByRole('textbox', { name: 'Professional text', exact: true })
    const posting = this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })
    await expect(source).toHaveAttribute('aria-invalid', 'true')
    await expect(source).toHaveAccessibleDescription('Add your resume as a file or pasted text before continuing.')
    await expect(posting).toHaveAttribute('aria-invalid', 'true')
    await expect(posting).toHaveAccessibleDescription('Add the job posting text before continuing.')
    await expect(source).toBeFocused()
    await expect(this.#page).not.toHaveURL(/\/resume$/u)
  }

  async expectWritingPhaseAnnouncedWithItsStep() {
    this.#expectAction()
    const progress = this.#page.getByRole('region', { name: 'Progress', exact: true })
    await expect(progress).toContainText('Writing')
    await expect(progress).toContainText('Step 3 of 3')
    await expect(progress).not.toContainText('orchestration')
    await expect(this.#page.locator('.sr-only[role="status"]')).toContainText('Current step: Your tailored resume.')
  }

  async expectReadableSecondaryTextAndFocusRing() {
    this.#expectAction()
    const notice = this.#page.locator('#processing-policy-notice')
    await expect(notice).toBeVisible()
    expect(await readContrast(notice)).toBeGreaterThanOrEqual(4.5)
    expect(parseFloat(await notice.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14)
    expect(await readContrast(this.#page.getByText('PDF or DOCX, up to 5 pages and 5 MB', { exact: true })))
      .toBeGreaterThanOrEqual(4.5)
    const source = this.#page.getByRole('textbox', { name: 'Professional text', exact: true })
    await source.focus()
    await this.#page.keyboard.press('Shift+Tab')
    await this.#page.keyboard.press('Tab')
    expect(await readContrast(source, 'outlineColor')).toBeGreaterThanOrEqual(3)
  }

  async givenScreenWidth(width: number) {
    await this.#page.setViewportSize({ width, height: 800 })
  }

  async expectFileChoiceCopyFor({ touch }: Readonly<{ touch: boolean }>) {
    this.#expectAction()
    const [shown, hidden] = touch ? [chooseFileCopy, dropFileCopy] : [dropFileCopy, chooseFileCopy]
    await expect(this.#intake.getByText(shown, { exact: true })).toHaveCount(2)
    await expect(this.#intake.getByText(hidden, { exact: true })).toHaveCount(0)
  }

  async expectNoHorizontalScroll() {
    this.#expectAction()
    await expect(this.#intake).toBeVisible()
    expect(await this.#page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
      .toBeLessThanOrEqual(0)
  }

  /** The intake, then a dropzone or a text area: never a card inside a card inside a card, and text areas span the intake. */
  async expectNoNestedDocumentCards() {
    this.#expectAction()
    expect(await this.#intake.evaluate((section) => Math.max(...[...section.querySelectorAll('*')].map((element) => {
      let depth = 0
      for (let node: Element | null = element; node !== null && section.contains(node); node = node.parentElement) {
        const style = getComputedStyle(node)
        if (style.borderTopStyle !== 'none' && parseFloat(style.borderTopWidth) > 0) depth += 1
      }
      return depth
    })))).toBeLessThanOrEqual(2)
    const intakeWidth = await readContentWidth(this.#intake)
    for (const name of ['Professional text', 'Job posting text']) {
      const textArea = await this.#intake.getByRole('textbox', { name, exact: true }).boundingBox()
      expect(textArea?.width ?? 0).toBeGreaterThanOrEqual(intakeWidth - 2)
    }
  }

  /** On one line or two, the header holds the brand, its badge and the language switch, the last two side by side. */
  async expectHeaderWithinItsBar() {
    this.#expectAction()
    const banner = this.#page.getByRole('banner')
    const [header, brand, badge, locale] = await Promise.all([banner, banner.getByRole('link', { name: 'Resume Studio', exact: true }),
      banner.getByText('Private by design', { exact: true }), banner.getByRole('radiogroup', { name: 'Language', exact: true }),
    ].map((locator) => locator.boundingBox()))
    if (header == null || brand == null || badge == null || locale == null) throw new Error('The header, its brand, badge and language switch must be visible')
    for (const box of [brand, badge, locale]) {
      expect(box.y).toBeGreaterThanOrEqual(header.y)
      expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height)
    }
    expect(Math.abs((badge.y + badge.height / 2) - (locale.y + locale.height / 2))).toBeLessThanOrEqual(1)
  }

  get #intake() {
    return this.#page.getByRole('region', { name: 'Your resume and the job posting', exact: true })
  }

  async expectOneRetryActionOnTheDocuments() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(1)
    await expect(this.#page.getByRole('button', { name: 'Generate my resume', exact: true })).toHaveCount(0)
  }

  async expectIntakeLockedDuringPreparation() {
    this.#expectAction()
    await expect(this.#page.getByRole('region', { name: 'Progress', exact: true })).toBeVisible()
    await this.#page.goBack()
    await expect(this.#page.getByText('Your resume is being prepared', { exact: true })).toBeVisible()
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toBeDisabled()
    await expect(this.#page.getByRole('combobox', { name: 'Resume language', exact: true })).toBeDisabled()
  }

  async expectNoEmptyResultDisclosures() {
    this.#expectAction()
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toBeVisible()
    await expect(this.#page.getByText('Job match and the experience behind it', { exact: true })).toHaveCount(0)
    await expect(this.#page.getByText('See or add to what we took from your resume', { exact: true })).toHaveCount(0)
  }

  async expectPolicyDisclosedAtGeneration() {
    this.#expectAction()
    const generate = this.#page.getByRole('button', { name: 'Generate my resume' })
    await expect(generate).toHaveAccessibleDescription(/OpenAI/)
    await expect(generate).toBeEnabled()
    await expect(this.#page.getByRole('textbox', { name: 'Professional text' })).toBeVisible()
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text' })).toBeVisible()
  }

  async #showDocumentText() {
    const frame = this.#page.locator('iframe')
    await frame.waitFor({ state: 'attached' })
    if (await frame.isVisible()) return
    await this.#page.locator('summary').filter({ hasText: /Read the document text|Lire le texte du document/ }).click()
  }

  #expectAction() { expect(this.#completedAction, 'Perform a Candidate Journey action before reading the outcome').not.toBeNull() }
}

/**
 * WebKit reports each same-origin request it cancels while a page reloads as a page error, even when the app catches
 * the rejection. The app only calls its own origin, so this message never stands for a real access control failure.
 */
function isCancelledByLeavingPage(message: string) {
  return message.endsWith('due to access control checks.')
}

const postingText = 'Frontend Engineer. React is required. Rust is required. Java is required.'

function extractionFor(scenario: Scenario) {
  if (scenario === 'blocking-ambiguity') return { experiences: [], projects: [], education: [], languages: [], certifications: [],
    skills: [{ name: 'React', category: null }], criticalAmbiguities: [{ path: 'skills.0.name.0', question: 'Which skill did you use?' }] }
  return { ...structuredResumeSource.sourceProfile, criticalAmbiguities: scenario === 'isolated-ambiguity'
    ? [{ path: 'experiences.0.context.0', question: 'Which team?' }] : [] }
}

function requirementsFor(scenario: Scenario) {
  if (scenario !== 'low-coverage' && scenario !== 'adjacent-evidence') return structuredResumeJobMatch.requirements
  return [...structuredResumeJobMatch.requirements, ...(['Rust', 'Java'] as const).map((name) => ({
    id: `job-requirement-${name}`, value: name, sourceExcerpt: `${name} is required.`, importance: 'central',
    importanceRationale: 'Explicit requirement', capability: { dimension: 'technical-expertise', name },
  }))]
}

function matchFor(scenario: Scenario) {
  if (scenario === 'no-correspondence') return { adjacentEvidence: [], evidence: [], relevance: [] }
  const factMatch = { factId: 'source-fact-skills-0-name-0', factExcerpt: 'React', requirementExcerpt: 'React' }
  return { adjacentEvidence: scenario === 'adjacent-evidence' ? [{ requirementId: 'job-requirement-Java',
    factMatches: [{ factId: 'source-fact-skills-1-name-0', factExcerpt: 'TypeScript' }] }] : [],
  evidence: [{ requirementId: 'job-requirement-react', coverage: 'covered', factMatches: [factMatch] }],
  relevance: [{ requirementId: 'job-requirement-react', factMatch }] }
}

const dropFileCopy = 'Drop your file here or click to choose it'
const chooseFileCopy = 'Choose a file'

/** The width inside an element's padding, where its content lays out. */
function readContentWidth(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  })
}

/** The WCAG contrast ratio of an element's color, or another color property, against the white page. */
async function readContrast(locator: Locator, property: 'color' | 'outlineColor' = 'color') {
  const color = await locator.evaluate((element, name) => getComputedStyle(element)[name], property)
  const [red = 0, green = 0, blue = 0] = (color.match(/\d+(\.\d+)?/gu) ?? []).slice(0, 3).map(Number).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 1.05 / (0.2126 * red + 0.7152 * green + 0.0722 * blue + 0.05)
}
