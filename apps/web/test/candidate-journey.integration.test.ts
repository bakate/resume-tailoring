import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, test } from '@playwright/test'
import type { Page, Request } from '@playwright/test'
import { structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import { routeResumeSectionModels, writeFixtureSection } from './resume-section-model-routes'

test.describe('Candidate Journey integration qualification', () => {
  test('completes consent, one generation, a supported correction and a validated download', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()
    await system.givenSupportedSummaryCorrection()

    await system.downloadCurrentResume()

    await system.expectCorrectedResumeDownloaded()
  })

  test('keeps the current preview when the editor closes without changes', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.openAndCloseEditorWithoutChanges()

    await system.expectPreviewKeptWithoutRendering()
  })

  test('renders the preview once after a save while the editor stays open', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.editSummaryWithEditorOpen()

    await system.expectOneRenderAfterEditing()
  })

  test('offers the download without editing when the resume starts with the Candidate name', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedResume()

    await system.waitForPreview()

    await system.expectExportableWithDetectedName()
  })

  test('previews a resume without a detectable name and asks for it above the download', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'unnamed' })
    await system.givenGeneratedResume()

    await system.waitForPreview()

    await system.expectPreviewBlockedOnMissingName()
  })

  test('renders once after the inline name field loses focus', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'unnamed' })
    await system.givenGeneratedPreview()

    await system.typeNameInlineAndLeaveField()

    await system.expectExportableAfterNameEntry()
  })

  test('downloads the generated preview without any optional correction', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.downloadCurrentResume()

    await system.expectGeneratedResumeDownloaded()
  })

  test('records whether the downloaded resume is usable without structural rewriting', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenDownloadedResume()

    await system.reportStructuralRewritingNeeded()

    await system.expectPrivacySafeUsabilityRecorded()
  })

  test('exports restored source content in the downloaded PDF', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenGeneratedPreview()
    await system.givenOneOmittedAchievementRestored()

    await system.downloadCurrentResume()

    system.expectRestoredAchievementDownloaded()
  })

  test('keeps restored content that crosses two measured pages and blocks export', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenGeneratedPreview()

    await system.restoreAllOmittedAchievements()

    await system.expectOverflowingDraftPreserved()
  })

  test('shortens a resume that restored content pushed over two pages in one click', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenOverflowingDraft()

    await system.shortenResume()

    await system.expectShortenedDraftExportable()
  })

  test('shows the first page of a longer resume on a phone and the others on request', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenScreenSize({ width: 375, height: 812 })
    await system.givenOverflowingDraft()
    await system.givenPagesAfterTheFirstCollapsed()

    await system.showAllPreviewPages()

    await system.expectEveryPreviewPageShown()
  })

  test('keeps Download beside a longer resume on a desktop screen', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenScreenSize({ width: 1440, height: 900 })
    await system.givenOverflowingDraft()

    await system.scrollToTheLastPreviewPage()

    await system.expectDownloadBesideThePages()
  })

  test('replaces the draft only when a condensation proposal is accepted', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenCondensationProposal()

    await system.acceptCondensationProposal()

    await system.expectCondensedDraftExportable()
  })

  test('keeps the overflowing draft when a condensation proposal is rejected', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenCondensationProposal()

    await system.rejectCondensationProposal()

    await system.expectOverflowingDraftPreserved()
  })

  test('keeps the overflowing draft when condensation fails', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense', condensation: 'unavailable' })
    await system.givenOverflowingDraft()

    await system.requestCondensationProposal()

    await system.expectFailedCondensationPreservedDraft()
  })

  test('discards a stale condensation proposal without changing the draft', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense' })
    await system.givenCondensationProposal()

    await system.changeContactAfterProposal()

    await system.expectStaleProposalDiscarded()
  })

  test('lets the Candidate choose removals when condensation cannot fit two pages', async ({ page }) => {
    const system = createSystemUnderTest({ page, source: 'dense', condensation: 'insufficient' })
    await system.givenInsufficientCondensationProposal()

    await system.hideDenseExperience()

    await system.expectCandidateRemovalExportable()
  })

  test('blocks the previous result when the Job Posting changes', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()
    await system.replaceJobPosting()

    await system.viewLatestResume()

    await system.expectPreviousResultOutdated()
  })

  test('prepares another opportunity in the same session without repeating source extraction', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenReplacedJobPosting()

    await system.regenerateForAnotherOpportunity()

    await system.expectAnotherOpportunityPreview()
  })

  test('deletes a prepared session without leaving stale output', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenDownloadedResume()

    await system.deleteCandidateSession()

    await system.expectNoStaleOutputAfterDeletion()
  })

  test('downloads a French resume with preserved employer names', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedFrenchPreview()

    await system.downloadCurrentResume()

    system.expectFrenchResumeDownloaded()
  })

  test('keeps the result page in the interface language when the resume is in French', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedFrenchPreview()

    await system.waitForPreview()

    await system.expectResultInInterfaceLanguage()
  })

  test('renders the screenshot regression fixture as a grouped document', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.downloadCurrentResume()

    await system.expectScreenshotRegressionsAbsent()
  })

  test('shows the preparation progress and then the preview on the dedicated result route', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenConsentedIntake()

    await system.generateWhileSectionWritingIsHeld()

    await system.expectProgressThenPreviewOnResultRoute()
  })

  test('restores the result after reloading the result route', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.reloadResultRoute()

    await system.expectRestoredResultRoute()
  })

  test('sends a visit to the result route without a result to the intake', async ({ page }) => {
    const system = createSystemUnderTest({ page })

    await system.visitResultRouteWithoutSession()

    await system.expectIntakeRoute()
  })

  test('links the intake to the latest resume without leaving it', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.returnToIntakeAndViewLatestResume()

    await system.expectRestoredResultRoute()
  })

  test('keeps the analyzed resume and clears the Job Posting when changing the job posting', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.changeJobPostingAndReload()

    await system.expectIntakeWithAnalyzedResumeAndNoPosting()
  })

  test('returns from the result to the documents, which offer to generate the resume again', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.returnToDocuments()

    await system.expectDocumentsOfferingRegeneration()
  })

  test('keeps the resume photo after reloading the result route', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()
    await system.givenResumePhotoChosen()

    await system.reloadResultRoute()

    await system.expectResumePhotoKept()
  })

  test('offers condensation only when the resume overflows', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedResume()

    await system.waitForPreview()

    await system.expectNoPageCountOrCondensationAction()
  })

  test('offers a way back to the documents after a failed preparation', async ({ page }) => {
    const system = createSystemUnderTest({ page, sourceExtraction: 'unavailable' })
    await system.givenConsentedIntake()

    await system.generateAndGoBackToDocuments()

    await system.expectIntakeWithDocumentsKept()
  })

  test('operates the journey by keyboard with announcements and reduced motion', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenReducedMotionIntake()

    await system.generateResumeByKeyboard()

    await system.expectAccessibleKeyboardJourney()
  })

  test('explains why the download is unavailable to assistive technology', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.clearCandidateName()

    await system.expectDownloadUnavailabilityExplained()
  })

  test('exposes whether the source profile details are shown', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedResume()
    await system.returnToDocuments()

    await system.toggleSourceProfileByKeyboard()

    await system.expectSourceProfileToggleExposed()
  })

  test('announces once that a rate-limit wait is over', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenConsentedIntake()

    await system.generateWhileRateLimited()

    await system.expectWaitEndAnnouncedOnce()
  })
})

test.describe('Candidate Journey mobile integration', () => {
  test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })

  test('completes intake, preview, section editing and export on a small screen', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()
    await system.givenMobileSectionCorrection()

    await system.downloadCurrentResume()

    await system.expectMobileJourneyExported()
  })
})

function createSystemUnderTest({ page, source = 'standard', condensation = 'shorter', sourceExtraction = 'available' }: Readonly<{
  page: Page; source?: SourceScenario; condensation?: CondensationScenario; sourceExtraction?: SourceExtractionScenario
}>) {
  return new CandidateJourneyIntegrationSystem({ page, source, condensation, sourceExtraction })
}

type SourceScenario = 'standard' | 'dense' | 'unnamed'
type CondensationScenario = 'shorter' | 'insufficient' | 'unavailable'
type SourceExtractionScenario = 'available' | 'unavailable'
type AnalyticsEvent = Readonly<Record<string, unknown>>

class CandidateJourneyIntegrationSystem {
  readonly #page: Page
  readonly #source: SourceScenario
  readonly #condensation: CondensationScenario
  readonly #sourceExtraction: SourceExtractionScenario
  readonly #errors: string[] = []
  readonly #analytics: AnalyticsEvent[] = []
  readonly #modelRequests: string[] = []
  readonly #modelRequestBodies: string[] = []
  #posting = firstPosting
  #pdfText: string | null = null
  #pdfPageCount = 0
  #completedAction: string | null = null
  #rendersBeforeAction = 0
  #releaseWriting: () => void = () => undefined

  constructor({ page, source, condensation, sourceExtraction }: Readonly<{
    page: Page; source: SourceScenario; condensation: CondensationScenario; sourceExtraction: SourceExtractionScenario
  }>) {
    this.#page = page; this.#source = source; this.#condensation = condensation; this.#sourceExtraction = sourceExtraction
    page.on('pageerror', (error) => { this.#errors.push(error.message) })
    page.on('request', (request) => { this.#recordModelRequest(request) })
  }

  async givenGeneratedResume() {
    await this.#openConsentedIntake()
    await this.#generate()
    await this.#expectGeneratedResume()
  }

  async givenGeneratedPreview() {
    await this.givenGeneratedResume()
    await this.#expectCurrentPreview()
  }

  async givenGeneratedFrenchPreview() {
    await this.#openConsentedIntake()
    await this.#page.getByRole('combobox', { name: 'Resume language', exact: true }).click()
    await this.#page.getByRole('option', { name: 'Français', exact: true }).click()
    await this.#generate()
    await this.#expectCurrentPreview()
  }

  async waitForPreview() {
    await this.#expectCurrentPreview()
    this.#completedAction = 'preview-rendered'
  }

  async typeNameInlineAndLeaveField() {
    this.#countRendersFromHere()
    const field = this.#page.getByRole('textbox', { name: 'Full name', exact: true })
    await field.pressSequentially('Alex Morgan', { delay: 50 })
    await this.#page.waitForTimeout(1_000)
    expect(this.#renderRequestsSinceAction(), 'Typing the name does not render on each keystroke').toBe(0)
    await field.blur()
    this.#completedAction = 'name-entered'
  }

  async givenReducedMotionIntake() {
    await this.#page.emulateMedia({ reducedMotion: 'reduce' })
    await this.#installModelAdapters()
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Get started', exact: true }).focus()
    await this.#page.keyboard.press('Enter')
    await this.#fillIntake()
  }

  async givenConsentedIntake() {
    await this.#openConsentedIntake()
  }

  async generateWhileSectionWritingIsHeld() {
    const held = new Promise<void>((resolve) => { this.#releaseWriting = resolve })
    await this.#page.route('**/api/resume-section-writing', (route) => held.then(() => route.fallback()))
    await this.#generate()
    this.#completedAction = 'generated-while-writing-held'
  }

  async reloadResultRoute() {
    await expect(this.#page).toHaveURL(/\/resume$/u)
    await this.#page.reload()
    this.#completedAction = 'result-reloaded'
  }

  async visitResultRouteWithoutSession() {
    await this.#installModelAdapters()
    await this.#page.goto('/resume')
    this.#completedAction = 'result-visited-without-session'
  }

  async returnToIntakeAndViewLatestResume() {
    await this.#page.goBack()
    await expect(this.#page).toHaveURL(/\/$/u)
    await expect(this.#page.getByText('Your latest resume is ready', { exact: true })).toBeVisible()
    await this.#page.getByRole('link', { name: 'View', exact: true }).click()
    this.#completedAction = 'latest-resume-viewed'
  }

  async changeJobPosting() {
    await this.#page.getByRole('button', { name: 'Change job posting', exact: true }).click()
    this.#completedAction = 'job-posting-changed'
  }

  async changeJobPostingAndReload() {
    await this.changeJobPosting()
    await expect(this.#page).toHaveURL(/\/$/u)
    await this.#page.reload()
  }

  async returnToDocuments() {
    await this.#page.getByRole('link', { name: 'Back to my documents', exact: true }).click()
    this.#completedAction = 'returned-to-documents'
  }

  async expectDocumentsOfferingRegeneration() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/$/u)
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toHaveValue(firstPosting)
    await expect(this.#page.getByRole('button', { name: 'Regenerate my resume', exact: true })).toBeEnabled()
    await expect(this.#page.getByRole('button', { name: 'Generate my resume', exact: true })).toHaveCount(0)
  }

  async givenResumePhotoChosen() {
    await this.#page.locator('input[type="file"][accept^="image/"]').setInputFiles({ name: 'portrait.png', mimeType: 'image/png',
      buffer: Buffer.from(onePixelPng, 'base64') })
    await expect(this.#page.getByText('portrait.png', { exact: true })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
  }

  async generateAndGoBackToDocuments() {
    await this.#generate()
    await expect(this.#page).toHaveURL(/\/resume$/u)
    await this.#page.getByRole('alert').getByRole('button', { name: 'Back to my documents', exact: true }).click()
    this.#completedAction = 'returned-to-documents'
  }

  async expectProgressThenPreviewOnResultRoute() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/resume$/u)
    await expect(this.#page.getByRole('region', { name: 'Progress', exact: true })).toBeVisible()
    await expect(this.#page.locator('#combined-intake-title')).toHaveCount(0)
    await expect(this.#page.locator('.sr-only[aria-live="polite"]')).toContainText('Writing')
    await expect(this.#page.locator('.sr-only[aria-live="polite"]')).not.toContainText('last stable result')
    this.#releaseWriting()
    await this.#expectCurrentPreview()
    await expect(this.#page.getByRole('region', { name: 'Progress', exact: true })).toHaveCount(0)
    await expect(this.#page).toHaveURL(/\/resume$/u)
  }

  async expectRestoredResultRoute() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/resume$/u)
    await this.#expectCurrentPreview()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    await expect(this.#page.locator('#combined-intake-title')).toHaveCount(0)
  }

  async expectResultInInterfaceLanguage() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeVisible()
    await expect(this.#page.getByRole('textbox', { name: 'Full name', exact: true })).toBeVisible()
    await expect(this.#page.getByText(/Télécharger|Nom complet|Aperçu et export|Lire le texte/u)).toHaveCount(0)
    await expect(this.#page.getByRole('heading', { name: 'Preview and export' })).toHaveCount(0)
    await this.#expectDocumentTextContains('Compétences')
  }

  async expectIntakeRoute() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/$/u)
    await expect(this.#page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
  }

  async expectIntakeWithAnalyzedResumeAndNoPosting() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/$/u)
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toHaveValue('')
    await expect(this.#page.getByRole('textbox', { name: 'Professional text', exact: true })).toHaveCount(0)
    await expect(this.#page.getByText('Your latest resume is ready', { exact: true })).toBeVisible()
  }

  async expectResumePhotoKept() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/resume$/u)
    await expect(this.#page.getByText('portrait.png', { exact: true })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Change photo', exact: true })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
  }

  async expectNoPageCountOrCondensationAction() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    await expect(this.#page.getByRole('button', { name: 'Check page count', exact: true })).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Propose a shorter version', exact: true })).toHaveCount(0)
  }

  async expectIntakeWithDocumentsKept() {
    this.#expectAction()
    await expect(this.#page).toHaveURL(/\/$/u)
    await expect(this.#page.getByRole('textbox', { name: 'Job posting text', exact: true })).toHaveValue(firstPosting)
    await expect(this.#page.getByRole('button', { name: 'Try again', exact: true })).toBeEnabled()
  }

  async givenSupportedSummaryCorrection() {
    await this.#openEditor()
    await this.#saveCorrectedSummary()
    await this.#closeEditor()
  }

  async givenMobileSectionCorrection() {
    await this.#openEditor()
    const dialog = this.#page.getByRole('dialog', { name: 'Edit resume' })
    const box = await dialog.boundingBox()
    expect(box?.width, 'The section editor fills the small screen').toBeGreaterThanOrEqual(400)
    await this.#page.getByRole('tab', { name: 'Content', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Summary', exact: true }).fill(correctedSummary)
    await this.#page.getByRole('button', { name: 'Save Summary', exact: true }).click()
    await expect(dialog.getByRole('status').filter({ hasText: 'Resume updated.' })).toBeVisible()
    await this.#page.getByRole('button', { name: 'Close editor', exact: true }).click()
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
  }

  async openAndCloseEditorWithoutChanges() {
    this.#countRendersFromHere()
    await this.#openEditor()
    await this.#expectPreviewVisibleWhileEditing()
    await this.#closeEditor()
    this.#completedAction = 'editor-toggled'
  }

  async editSummaryWithEditorOpen() {
    this.#countRendersFromHere()
    await this.#openEditor()
    await this.#saveCorrectedSummary()
    this.#completedAction = 'summary-edited'
  }

  async expectPreviewKeptWithoutRendering() {
    this.#expectAction()
    await this.#page.waitForTimeout(1_000)
    expect(this.#renderRequestsSinceAction(), 'Closing an unchanged editor must not render').toBe(0)
    await expect(this.#page.locator('.resume-pdf-pages canvas').first()).toBeVisible()
  }

  /** The preview beside the open editor shows the saved edit, and closing the editor renders nothing more. */
  async expectOneRenderAfterEditing() {
    this.#expectAction()
    await expect.poll(() => this.#renderRequestsSinceAction(), { timeout: 30_000 }).toBe(1)
    await expect(this.#editor()).toBeVisible()
    await expect(this.#page.locator('.resume-pdf-pages canvas').first()).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    await this.#closeEditor()
    await this.#page.waitForTimeout(1_000)
    expect(this.#renderRequestsSinceAction(), 'One edit renders exactly once').toBe(1)
  }

  #countRendersFromHere() { this.#rendersBeforeAction = this.#renderRequests() }

  async #expectPreviewVisibleWhileEditing() {
    await this.#page.waitForTimeout(1_000)
    await expect(this.#page.locator('.resume-pdf-pages canvas').first()).toBeVisible()
    expect(this.#renderRequestsSinceAction(), 'An open editor must not render').toBe(0)
  }

  async #saveCorrectedSummary() {
    await this.#page.getByRole('tab', { name: 'Content', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Summary', exact: true }).fill(correctedSummary)
    await this.#page.getByRole('button', { name: 'Save Summary', exact: true }).click()
    await expect(this.#editor().getByRole('status').filter({ hasText: 'Resume updated.' })).toBeVisible()
  }

  #renderRequests() { return this.#modelRequests.filter((path) => path === '/api/resume-document').length }

  #renderRequestsSinceAction() { return this.#renderRequests() - this.#rendersBeforeAction }

  async givenDownloadedResume() {
    await this.givenGeneratedPreview()
    await this.downloadCurrentResume()
  }

  async givenOneOmittedAchievementRestored() {
    await this.#openEditor()
    await this.#page.getByRole('tab', { name: 'Content', exact: true }).click()
    await this.#editor().getByText(denseAchievements[2] ?? '', { exact: true }).locator('..')
      .getByRole('button', { name: 'Add to the resume', exact: true }).click()
    await this.#closeEditor()
  }

  async givenOverflowingDraft() {
    await this.givenGeneratedPreview()
    await this.restoreAllOmittedAchievements()
    await this.#expectOverflow()
  }

  async givenScreenSize(size: Readonly<{ width: number; height: number }>) {
    await this.#page.setViewportSize(size)
  }

  async givenPagesAfterTheFirstCollapsed() {
    await expect(this.#page.locator('.resume-pdf-pages figure').nth(1)).toBeHidden()
  }

  async scrollToTheLastPreviewPage() {
    await this.#page.locator('.resume-pdf-pages figure').last().scrollIntoViewIfNeeded()
    await this.#page.waitForFunction(() => window.scrollY > 0)
    this.#completedAction = 'scrolled-to-last-page'
  }

  async expectDownloadBesideThePages() {
    this.#expectAction()
    expect(await this.#page.locator('.resume-pdf-pages figure').count()).toBeGreaterThan(1)
    const download = this.#page.getByRole('button', { name: 'Download PDF', exact: true })
    await expect(download).toBeInViewport({ ratio: 1 })
    await expect(this.#page.getByRole('alert').filter({ hasText: overflowStatus })).toBeInViewport()
  }

  async showAllPreviewPages() {
    await this.#page.getByRole('button', { name: /^See all \d+ pages$/u }).click()
    this.#completedAction = 'pages-expanded'
  }

  async expectEveryPreviewPageShown() {
    this.#expectAction()
    const pages = this.#page.locator('.resume-pdf-pages figure')
    expect(await pages.count()).toBeGreaterThan(1)
    for (const figure of await pages.all()) await expect(figure).toBeVisible()
    await expect(this.#page.getByRole('button', { name: /^See all \d+ pages$/u })).toHaveCount(0)
  }

  async givenCondensationProposal() {
    await this.givenOverflowingDraft()
    await this.requestCondensationProposal()
    await expect(this.#page.getByRole('heading', { name: 'Shorter version proposal' })).toBeVisible({ timeout: 30_000 })
    await expect(this.#proposal().getByText(/^Fits on (one page|two pages)\.$/u)).toBeVisible({ timeout: 30_000 })
  }

  async givenInsufficientCondensationProposal() {
    await this.givenOverflowingDraft()
    await this.requestCondensationProposal()
    await expect(this.#page.getByRole('heading', { name: 'Shorter version proposal' })).toBeVisible({ timeout: 30_000 })
    await expect(this.#proposal().getByText('This proposal still runs over two pages.', { exact: true })).toBeVisible({ timeout: 30_000 })
  }

  async givenReplacedJobPosting() {
    await this.givenGeneratedPreview()
    await this.replaceJobPosting()
  }

  async downloadCurrentResume() {
    const download = this.#page.waitForEvent('download')
    await this.#page.getByRole('button', { name: /^(Download PDF|Télécharger le PDF)$/ }).click({ timeout: 30_000 })
    const path = await (await download).path()
    const loading = getDocument({ data: new Uint8Array(await readFile(path)) })
    try {
      const pdf = await loading.promise
      this.#pdfPageCount = pdf.numPages
      const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_value, index) => {
        const pdfPage = await pdf.getPage(index + 1)
        return (await pdfPage.getTextContent()).items.flatMap((item) => 'str' in item ? item.str : []).join(' ')
      }))
      this.#pdfText = pages.join(' ').replace(/\s+/g, ' ')
    } finally { await loading.destroy() }
    this.#completedAction = 'downloaded'
  }

  async reportStructuralRewritingNeeded() {
    await this.#page.getByRole('group', { name: 'Can you apply with this PDF without restructuring it?' })
      .getByRole('button', { name: 'No, it needs structural rewriting', exact: true }).click()
    this.#completedAction = 'usability-reported'
  }

  async restoreAllOmittedAchievements() {
    await this.#openEditor()
    await this.#page.getByRole('tab', { name: 'Content', exact: true }).click()
    const restore = this.#editor().getByRole('button', { name: 'Add to the resume', exact: true })
    while (await restore.count() > 0) {
      const remaining = await restore.count()
      await restore.first().click()
      await expect(restore).toHaveCount(remaining - 1)
    }
    await this.#closeEditor()
    this.#completedAction = 'restored'
  }

  async shortenResume() {
    await this.#page.getByRole('button', { name: 'Shorten the resume', exact: true }).click()
    this.#completedAction = 'shortened'
  }

  async requestCondensationProposal() {
    await this.#page.getByRole('button', { name: 'Propose a shorter version', exact: true }).click()
    this.#completedAction = 'condensation-requested'
  }

  async acceptCondensationProposal() {
    await this.#page.getByRole('button', { name: 'Accept shorter version', exact: true }).click()
    this.#completedAction = 'condensation-accepted'
  }

  async rejectCondensationProposal() {
    await this.#page.getByRole('button', { name: 'Keep current version', exact: true }).click()
    this.#completedAction = 'condensation-rejected'
  }

  async changeContactAfterProposal() {
    await this.#openEditor()
    await this.#page.getByRole('textbox', { name: 'Phone', exact: true }).fill('+33 1 23 45 67 89')
    await this.#closeEditor()
    this.#completedAction = 'contact-changed'
  }

  async hideDenseExperience() {
    await this.#openEditor()
    await this.#page.getByRole('tab', { name: 'Content', exact: true }).click()
    await this.#page.getByRole('button', { name: /^Hide experience / }).first().click()
    await this.#closeEditor()
    this.#completedAction = 'experience-hidden'
  }

  async replaceJobPosting() {
    this.#posting = secondPosting
    await this.changeJobPosting()
    await this.#page.getByRole('textbox', { name: 'Job posting text', exact: true }).fill(secondPosting)
    this.#completedAction = 'posting-replaced'
  }

  async regenerateForAnotherOpportunity() {
    await this.#page.getByRole('button', { name: 'Regenerate my resume', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Replace and regenerate', exact: true }).click()
    this.#completedAction = 'regenerated'
  }

  async deleteCandidateSession() {
    await this.#page.getByRole('link', { name: 'Resume Studio', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Delete my data', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Delete my data now', exact: true }).click()
    this.#completedAction = 'deleted'
  }

  async generateResumeByKeyboard() {
    await this.#page.getByRole('button', { name: 'Generate my resume', exact: true }).focus()
    await this.#page.keyboard.press('Enter')
    this.#completedAction = 'generated-by-keyboard'
  }

  async expectCorrectedResumeDownloaded() {
    const text = this.#expectDownloadedText()
    expect(text).toContain(correctedSummary)
    expect(text).not.toContain('Accessible billing interfaces backed by React experience.')
    expect(this.#pdfPageCount).toBe(1)
    await this.#expectNoNormalPathCheckpoint()
    await this.#expectPrivacySafeAnalytics(['resume-tailoring-opened', 'candidate-journey-phase-reached',
      'resume-correction-recorded', 'resume-downloaded'])
  }

  async expectExportableWithDetectedName() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    const field = this.#page.getByRole('textbox', { name: 'Full name', exact: true })
    await expect(field).toHaveValue('Alex Morgan')
    await expect(field).toHaveAccessibleDescription(/Taken from your resume, check the spelling/u)
    await expect(this.#page.getByRole('alert')).toHaveCount(0)
    this.#expectNameKeptFromModels()
  }

  async expectPreviewBlockedOnMissingName() {
    this.#expectAction()
    await expect(this.#page.locator('.resume-pdf-pages canvas').first()).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
    const field = this.#page.getByRole('textbox', { name: 'Full name', exact: true })
    await expect(field).toHaveValue('')
    await expect(field).toHaveAccessibleDescription(/Add your full name to download the PDF/u)
    await expect(this.#page.getByRole('alert')).toHaveCount(0)
    await expect(this.#page.getByText(/could not be (?:rendered|produced)/u)).toHaveCount(0)
  }

  async expectExportableAfterNameEntry() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    await this.#page.waitForTimeout(1_000)
    expect(this.#renderRequestsSinceAction(), 'Committing the name renders exactly once').toBe(1)
    await expect(this.#page.locator('.resume-pdf-pages canvas').first()).toBeVisible()
    await expect(this.#page.getByRole('alert')).toHaveCount(0)
    await this.#expectDocumentTextContains('Alex Morgan')
  }

  async expectGeneratedResumeDownloaded() {
    const text = this.#expectDownloadedText()
    expect(text).toContain('Accessible billing interfaces backed by React experience.')
    expect(text).toContain('Alex Morgan')
    expect(text).toContain('alex@example.com')
    await expect(this.#page.locator('.resume-pdf-pages canvas')).toHaveCount(this.#pdfPageCount)
    await this.#expectPrivacySafeAnalytics(['resume-downloaded'])
  }

  async expectPrivacySafeUsabilityRecorded() {
    this.#expectAction()
    await expect(this.#page.getByRole('status').filter({ hasText: 'Only your answer was recorded' })).toBeVisible()
    await expect.poll(() => this.#analytics.filter(({ name }) => name === 'resume-usefulness-rated'))
      .toEqual([{ name: 'resume-usefulness-rated', hasComment: false, matchScoreBand: '75-100', useful: false }])
    await this.#expectPrivacySafeAnalytics(['resume-usefulness-rated'])
  }

  expectRestoredAchievementDownloaded() {
    const text = this.#expectDownloadedText()
    expect(text).toContain(denseAchievements[2])
    expect(text).not.toContain(denseAchievements[3])
    expect(this.#pdfPageCount).toBeLessThanOrEqual(2)
  }

  async expectOverflowingDraftPreserved() {
    this.#expectAction()
    await this.#expectOverflow()
    await expect(this.#page.getByRole('heading', { name: 'Shorter version proposal' })).toHaveCount(0)
    await this.#expectDocumentTextContains(denseAchievements.at(-1) ?? '')
  }

  async expectShortenedDraftExportable() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    await expect(this.#page.getByRole('status').filter({ hasText: / hidden to fit (one page|two pages)\.$/u })).toBeVisible()
    await expect(this.#page.getByRole('alert').filter({ hasText: overflowStatus })).toHaveCount(0)
  }

  async expectCondensedDraftExportable() {
    this.#expectAction()
    await expect(this.#page.getByRole('heading', { name: 'Shorter version proposal' })).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    const pages = await this.#page.locator('.resume-pdf-pages canvas').count()
    expect(pages).toBeGreaterThan(0)
    expect(pages).toBeLessThanOrEqual(2)
    await this.#expectDocumentTextContains(condense(denseAchievements.at(-1) ?? ''))
    await this.#expectDocumentTextLacks(denseAchievements.at(-1) ?? '')
  }

  async expectFailedCondensationPreservedDraft() {
    this.#expectAction()
    await expect(this.#page.getByRole('alert').filter({ hasText: 'The operation could not complete. Your current content is preserved.' }))
      .toBeVisible({ timeout: 30_000 })
    await this.expectOverflowingDraftPreserved()
  }

  async expectStaleProposalDiscarded() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Accept shorter version', exact: true })).toHaveCount(0)
    await this.#expectOverflow()
    await this.#expectDocumentTextContains(denseAchievements.at(-1) ?? '')
    await this.#expectDocumentTextContains('+33 1 23 45 67 89')
  }

  async expectCandidateRemovalExportable() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    await this.#expectDocumentTextLacks(denseAchievements.at(-1) ?? '')
    await this.#openEditor()
    await this.#page.getByRole('tab', { name: 'Content', exact: true }).click()
    await expect(this.#page.getByRole('button', { name: /^Restore experience / })).toBeVisible()
  }

  async viewLatestResume() {
    await this.#page.getByRole('link', { name: 'View', exact: true }).click()
    this.#completedAction = 'latest-resume-viewed'
  }

  async expectPreviousResultOutdated() {
    this.#expectAction()
    await expect(this.#page.getByRole('status').filter({ hasText: 'Your documents changed' })).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
    await expect(this.#page.locator('.resume-pdf-pages canvas')).toHaveCount(0)
  }

  async expectAnotherOpportunityPreview() {
    this.#expectAction()
    await this.#expectCurrentPreview()
    await this.#expectDocumentTextContains('Accessibility Lead')
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    expect(this.#modelRequests.filter((path) => path.endsWith('/api/structured-source-profile-extraction'))).toHaveLength(1)
    expect(this.#modelRequests.filter((path) => path.endsWith('/api/explainable-job-posting-extraction'))).toHaveLength(2)
  }

  async expectNoStaleOutputAfterDeletion() {
    this.#expectAction()
    await expect(this.#page.getByText('Your data was deleted from this browser.')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF' })).toHaveCount(0)
    await expect(this.#page.locator('iframe')).toHaveCount(0)
    expect(await this.#page.evaluate(() => localStorage.getItem('honest-resume:candidate-session'))).toBeNull()
    await this.#page.reload()
    await expect(this.#page.getByRole('button', { name: 'Get started', exact: true })).toBeVisible()
    await expect(this.#page.getByText('Northwind')).toHaveCount(0)
    await this.#expectPrivacySafeAnalytics(['candidate-session-deleted'])
  }

  expectFrenchResumeDownloaded() {
    const text = this.#expectDownloadedText()
    expect(text).toMatch(/Développement d\s*[’ʼ']\s*interfaces de facturation accessibles\./u)
    expect(text).toContain('Northwind')
    expect(text).toContain('Compétences')
  }

  async expectScreenshotRegressionsAbsent() {
    const text = this.#expectDownloadedText()
    expect(text.match(/Front-end/g)).toHaveLength(1)
    expect(text).toMatch(/Frontend Engineer .*Northwind.*2021 – 2024.*Built accessible billing screens/)
    const preview = await this.#openDocumentText()
    await expect(preview.locator('li').filter({ hasText: /^(Northwind|Contoso|2021 – 2024|2018 – 2021|Front-end)$/ })).toHaveCount(0)
    await expect(preview.locator('li').filter({ hasText: 'Accessible billing interfaces backed by React experience.' })).toHaveCount(0)
    await expect(preview.locator('p').filter({ hasText: 'Accessible billing interfaces backed by React experience.' })).toHaveCount(1)
    await this.#expectNoNormalPathCheckpoint()
  }

  async expectAccessibleKeyboardJourney() {
    this.#expectAction()
    await this.#expectGeneratedResume()
    await this.#expectResultRouteOnly()
    await expect(this.#page.locator('.sr-only[aria-live="polite"]')).toContainText('Ready: your tailored resume.')
    const transition = await this.#page.getByRole('button', { name: 'Edit resume', exact: true })
      .evaluate((element) => getComputedStyle(element).transitionDuration)
    expect(transition.split(',').every((duration) => parseFloat(duration) <= 0.00001)).toBe(true)
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).focus()
    await this.#page.keyboard.press('Enter')
    await expect(this.#editor()).toBeVisible()
    await this.#page.keyboard.press('Escape')
    await expect(this.#editor()).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Edit resume', exact: true })).toBeFocused()
    await this.#expectNamedEditorControls()
  }

  async #expectNamedEditorControls() {
    await this.#openEditor()
    await this.#page.getByRole('tab', { name: 'Content', exact: true }).click()
    await expect(this.#page.getByRole('button', { name: 'Move Experience: Northwind up', exact: true }).first()).toBeVisible()
    await this.#page.getByRole('tab', { name: 'Layout', exact: true }).click()
    await expect(this.#page.getByRole('button', { name: 'Move Summary up', exact: true })).toBeDisabled()
    await expect(this.#page.getByRole('button', { name: 'Move Experience up', exact: true })).toBeEnabled()
    await this.#closeEditor()
  }

  async clearCandidateName() {
    const field = this.#page.getByRole('textbox', { name: 'Full name', exact: true })
    await field.fill('')
    await field.blur()
    this.#completedAction = 'name-cleared'
  }

  async expectDownloadUnavailabilityExplained() {
    this.#expectAction()
    const download = this.#page.getByRole('button', { name: 'Download PDF', exact: true })
    await expect(download).toBeDisabled({ timeout: 30_000 })
    await expect(download).toHaveAccessibleDescription('Add your full name to download the PDF.', { timeout: 30_000 })
  }

  async toggleSourceProfileByKeyboard() {
    await this.#page.getByText('See or add to what we took from your resume', { exact: true }).click()
    await this.#page.getByRole('button', { name: 'See what we took from your resume', exact: true }).focus()
    await this.#page.keyboard.press('Enter')
    this.#completedAction = 'source-profile-toggled'
  }

  async expectSourceProfileToggleExposed() {
    this.#expectAction()
    const toggle = this.#page.getByRole('button', { name: 'Hide what we took from your resume', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const details = this.#page.getByRole('region', { name: 'What we took from your resume', exact: true })
    await expect(details).toHaveAttribute('id', await toggle.getAttribute('aria-controls') ?? 'missing aria-controls')
    await this.#page.keyboard.press('Enter')
    await expect(this.#page.getByRole('button', { name: 'See what we took from your resume', exact: true }))
      .toHaveAttribute('aria-expanded', 'false')
    await expect(details).toHaveCount(0)
  }

  async generateWhileRateLimited() {
    await this.#page.route('**/api/resume-section-writing', (route) => route.fulfill({ status: 429,
      headers: { 'Retry-After': '2' }, json: { ok: false, error: { type: 'rate-limited', retryAfterSeconds: 2 } } }))
    await this.#generate()
    this.#completedAction = 'rate-limited'
  }

  async expectWaitEndAnnouncedOnce() {
    this.#expectAction()
    const alert = this.#page.getByRole('alert').filter({ hasText: 'Preparation could not finish.' })
    const retry = alert.getByRole('button', { name: 'Try again', exact: true })
    await expect(retry).toBeDisabled()
    await expect(retry).toHaveText(/^Try again in \d s/u)
    await expect(retry).not.toHaveAttribute('aria-live')
    const announcement = this.#page.getByRole('status').filter({ hasText: 'The wait is over. You can try again.' })
    await expect(announcement).toHaveCount(0)
    await expect(retry).toBeEnabled({ timeout: 5_000 })
    await expect(announcement).toHaveCount(1)
    await expect(alert.getByText('The wait is over. You can try again.')).toHaveCount(0)
  }

  async expectMobileJourneyExported() {
    const text = this.#expectDownloadedText()
    expect(text).toContain(correctedSummary)
    const overflow = await this.#page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await this.#expectResultRouteOnly()
  }

  async #openConsentedIntake() {
    await this.#installModelAdapters()
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Get started', exact: true }).click()
    await this.#fillIntake()
  }

  async #fillIntake() {
    await this.#page.getByRole('textbox', { name: 'Professional text', exact: true }).fill(this.#source === 'unnamed' ? unnamedSourceText : sourceText)
    await this.#page.getByRole('textbox', { name: 'Job posting text', exact: true }).fill(this.#posting)
  }

  async #generate() {
    await this.#page.getByRole('button', { name: 'Generate my resume', exact: true }).click()
  }

  async #expectGeneratedResume() {
    await expect(this.#page.getByRole('button', { name: /^(Edit resume|Modifier le CV)$/ })).toBeEnabled({ timeout: 30_000 })
  }

  async #expectCurrentPreview() {
    await this.#expectGeneratedResume()
    await expect(this.#page.locator('.resume-pdf-pages canvas').first()).toBeVisible({ timeout: 30_000 })
  }

  async #expectOverflow() {
    await expect(this.#page.getByRole('alert').filter({ hasText: overflowStatus })).toBeVisible({ timeout: 30_000 })
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toHaveAccessibleDescription(overflowStatus)
    await expect(this.#page.getByRole('button', { name: 'Shorten the resume', exact: true })).toBeEnabled()
  }

  async #expectNoNormalPathCheckpoint() {
    await expect(this.#page.locator('details').filter({ hasText: 'Job match and the experience behind it' }).first()).not.toHaveAttribute('open')
    await expect(this.#page.getByRole('button', { name: /Approve|Confirm analysis|Continue to/ })).toHaveCount(0)
    await this.#expectResultRouteOnly()
  }

  async #expectResultRouteOnly() {
    await expect(this.#page).toHaveURL(/\/resume$/u)
    await expect(this.#page.locator('#tailored-resume-title')).toBeVisible()
    await expect(this.#page.locator('#combined-intake-title')).toHaveCount(0)
  }

  #expectNameKeptFromModels() {
    expect(this.#modelRequestBodies.length, 'The source was sent for extraction').toBeGreaterThan(0)
    for (const body of this.#modelRequestBodies) expect(body).not.toMatch(/Alex Morgan/iu)
  }

  async #expectPrivacySafeAnalytics(names: readonly string[]) {
    await expect.poll(() => names.every((name) => this.#analytics.some((event) => event.name === name))).toBe(true)
    const serialized = JSON.stringify(this.#analytics)
    for (const content of candidateContent) expect(serialized).not.toContain(content)
  }

  async #openEditor() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await expect(this.#editor()).toBeVisible()
  }

  async #closeEditor() {
    await this.#page.keyboard.press('Escape')
    await expect(this.#editor()).toHaveCount(0)
  }

  /** The editor: a panel beside the preview on a desktop, a sheet over it on a smaller screen. */
  #editor() {
    return this.#page.getByRole('region', { name: 'Edit resume', exact: true }).or(this.#page.getByRole('dialog', { name: 'Edit resume' }))
  }

  async #openDocumentText() {
    const frame = this.#page.getByTitle('Tailored resume preview')
    if (!await frame.isVisible()) await this.#page.locator('summary').filter({ hasText: 'Read the document text' }).click()
    return this.#page.frameLocator('iframe[title="Tailored resume preview"]')
  }

  async #expectDocumentTextContains(text: string) {
    const preview = await this.#openDocumentText()
    await expect(preview.locator('body')).toContainText(text)
  }

  async #expectDocumentTextLacks(text: string) {
    const preview = await this.#openDocumentText()
    await expect(preview.locator('body')).not.toContainText(text)
  }

  #proposal() { return this.#page.locator('.mantine-Paper-root').filter({ has: this.#page.getByRole('heading', { name: 'Shorter version proposal' }) }).last() }

  #expectDownloadedText() {
    this.#expectAction()
    expect(this.#pdfText, 'Download the current resume before reading the PDF').not.toBeNull()
    expect(this.#errors).toEqual([])
    return this.#pdfText ?? ''
  }

  #expectAction() { expect(this.#completedAction, 'Perform a Candidate Journey action before reading the outcome').not.toBeNull() }

  #recordModelRequest(request: Request) {
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/')) this.#modelRequests.push(path)
    if (path.startsWith('/api/') && path !== '/api/resume-document' && path !== '/api/analytics') {
      this.#modelRequestBodies.push(request.postData() ?? '')
    }
  }

  async #installModelAdapters() {
    await this.#page.route('**/api/analytics', async (route) => {
      this.#analytics.push(route.request().postDataJSON() as AnalyticsEvent)
      await route.fulfill({ status: 204, body: '' })
    })
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => route.fulfill(this.#sourceExtraction === 'unavailable'
      ? { status: 502, json: { ok: false, error: { type: 'provider-unavailable' } } } : { json: {
      ok: true, value: { ...(this.#source === 'dense' ? denseSourceProfile : structuredResumeSource.sourceProfile), criticalAmbiguities: [] },
    } }))
    await this.#page.route('**/api/explainable-job-posting-extraction', (route) => {
      const title = this.#posting.split('.')[0] ?? ''
      return route.fulfill({ json: { ok: true, value: { targetRole: { value: title, sourceExcerpt: `${title}.` },
        practicalConstraints: [], requirements: structuredResumeJobMatch.requirements } } })
    })
    await this.#page.route('**/api/explainable-match-evidence', (route) => route.fulfill({ json: {
      ok: true, value: { adjacentEvidence: [], evidence: [{ requirementId: 'job-requirement-react', coverage: 'covered', factMatches: [reactMatch] }],
        relevance: [{ requirementId: 'job-requirement-react', factMatch: reactMatch }] },
    } }))
    await routeResumeSectionModels(this.#page, { write: (input) => writeFixtureSection(input,
      this.#source === 'dense' ? denseAchievementFields() : undefined) })
    await this.#page.route('**/api/resume-claim-validation', (route) => route.fulfill({ json: {
      ok: true, value: { supported: true, feedback: [] },
    } }))
    await this.#page.route('**/api/resume-claim-writing', (route) => {
      if (this.#condensation === 'unavailable') return route.fulfill({ status: 502, json: { ok: false, error: { type: 'provider-unavailable' } } })
      const input = route.request().postDataJSON() as Readonly<{ claim: Readonly<{ segments: readonly Readonly<{ text: string; factIds: readonly string[] }>[] }> }>
      const segments = input.claim.segments.map((segment) => ({ ...segment,
        text: this.#condensation === 'insufficient' ? segment.text : condense(segment.text) }))
      return route.fulfill({ json: { ok: true, value: { claims: [{ segments }] } } })
    })
  }
}

const sourceText = 'Alex Morgan\nalex@example.com\nFrontend Engineer at Northwind. Built accessible billing screens. React and TypeScript.'
const unnamedSourceText = 'alex@example.com\nFrontend Engineer at Northwind. Built accessible billing screens. React and TypeScript.'
const firstPosting = 'Frontend Engineer. React is required.'
const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
const secondPosting = 'Accessibility Lead. React is required. Inclusive product delivery matters.'
const correctedSummary = 'Built accessible billing screens with React.'
const candidateContent = ['Northwind', 'Contoso', 'billing', 'Alex', 'Morgan', 'example.com', 'Frontend', 'Accessibility'] as const
const reactMatch = { factId: 'source-fact-skills-0-name-0', factExcerpt: 'React', requirementExcerpt: 'React' } as const

const overflowStatus = /^Your resume runs to \d+ pages, two at most\.$/u

/** Enough to overflow two pages in full (from 16), few enough that the condensed experience still fits whole (up to 28). */
const denseTopics = ['checkout', 'invoicing', 'refunds', 'onboarding', 'reporting', 'search', 'navigation', 'settings',
  'notifications', 'permissions', 'exports', 'imports', 'dashboards', 'forms', 'tables', 'charts', 'filters', 'tooltips',
  'dialogs', 'menus', 'carousels', 'uploads']
const denseAchievements = denseTopics.map((topic) => `Coordinated the ${topic} interface workstream with product, design and support partners, documenting accessible interaction patterns, reviewing keyboard behaviour and publishing guidance that other delivery teams reused`)
const denseSourceProfile = { ...structuredResumeSource.sourceProfile,
  experiences: structuredResumeSource.sourceProfile.experiences.map((experience, index) => index === 0
    ? { ...experience, achievements: denseAchievements } : experience) }

function condense(text: string) { return `${text.split(' ').slice(0, 5).join(' ').replace(/,$/, '')}.` }

function denseAchievementFields() {
  return denseAchievements.slice(0, 2).map((text, index) => ({ id: `dense-achievement-${String(index)}`, text,
    factIds: [`source-fact-experiences-0-achievements-${String(index)}` as const] }))
}
