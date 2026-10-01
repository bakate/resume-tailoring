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

  test('asks only for the locally entered name before the first export', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedResume()

    await system.enterRequiredName()

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

  test('renders the screenshot regression fixture as a grouped document', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenGeneratedPreview()

    await system.downloadCurrentResume()

    await system.expectScreenshotRegressionsAbsent()
  })

  test('operates the journey by keyboard with announcements and reduced motion', async ({ page }) => {
    const system = createSystemUnderTest({ page })
    await system.givenReducedMotionIntake()

    await system.generateResumeByKeyboard()

    await system.expectAccessibleKeyboardJourney()
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

function createSystemUnderTest({ page, source = 'standard', condensation = 'shorter' }: Readonly<{
  page: Page; source?: SourceScenario; condensation?: CondensationScenario
}>) {
  return new CandidateJourneyIntegrationSystem({ page, source, condensation })
}

type SourceScenario = 'standard' | 'dense'
type CondensationScenario = 'shorter' | 'insufficient' | 'unavailable'
type AnalyticsEvent = Readonly<Record<string, unknown>>

class CandidateJourneyIntegrationSystem {
  readonly #page: Page
  readonly #source: SourceScenario
  readonly #condensation: CondensationScenario
  readonly #errors: string[] = []
  readonly #analytics: AnalyticsEvent[] = []
  readonly #modelRequests: string[] = []
  #posting = firstPosting
  #pdfText: string | null = null
  #pdfPageCount = 0
  #completedAction: string | null = null

  constructor({ page, source, condensation }: Readonly<{ page: Page; source: SourceScenario; condensation: CondensationScenario }>) {
    this.#page = page; this.#source = source; this.#condensation = condensation
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
    await this.enterRequiredName()
    await this.#expectCurrentPreview()
  }

  async givenGeneratedFrenchPreview() {
    await this.#openConsentedIntake()
    await this.#page.getByRole('combobox', { name: 'Resume language', exact: true }).click()
    await this.#page.getByRole('option', { name: 'Français', exact: true }).click()
    await this.#generate()
    await this.#expectGeneratedResume()
    await this.enterRequiredName()
    await this.#expectCurrentPreview()
  }

  async enterRequiredName() {
    await expect(this.#page.getByRole('alert').filter({ hasText: /Add your full name|Ajoute ton nom complet/ })).toBeVisible({ timeout: 30_000 })
    await this.#page.getByRole('button', { name: /^(Edit resume|Modifier le CV)$/ }).click()
    await this.#page.getByRole('textbox', { name: /^(Name|Nom)$/ }).fill('Alex Morgan')
    await this.#closeEditor()
    this.#completedAction = 'name-entered'
  }

  async givenReducedMotionIntake() {
    await this.#page.emulateMedia({ reducedMotion: 'reduce' })
    await this.#installModelAdapters()
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Start a Candidate Session' }).focus()
    await this.#page.keyboard.press('Enter')
    await this.#fillIntake()
  }

  async givenSupportedSummaryCorrection() {
    await this.#openEditor()
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Resume Field', exact: true }).first().fill(correctedSummary)
    await this.#page.getByRole('button', { name: 'Save wording', exact: true }).first().click()
    await expect(this.#page.getByRole('dialog').getByRole('status').filter({ hasText: 'Resume updated.' })).toBeVisible()
    await this.#closeEditor()
  }

  async givenMobileSectionCorrection() {
    await this.#openEditor()
    const dialog = this.#page.getByRole('dialog')
    const box = await dialog.boundingBox()
    expect(box?.width, 'The section editor fills the small screen').toBeGreaterThanOrEqual(400)
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Resume Field', exact: true }).first().fill(correctedSummary)
    await this.#page.getByRole('button', { name: 'Save wording', exact: true }).first().click()
    await expect(dialog.getByRole('status').filter({ hasText: 'Resume updated.' })).toBeVisible()
    await this.#page.getByRole('button', { name: 'Close editor', exact: true }).click()
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
  }

  async givenDownloadedResume() {
    await this.givenGeneratedPreview()
    await this.downloadCurrentResume()
  }

  async givenOneOmittedAchievementRestored() {
    await this.#openEditor()
    await this.#page.getByRole('tab', { name: 'Restore content', exact: true }).click()
    await this.#page.getByRole('dialog').getByText(denseAchievements[2] ?? '', { exact: true }).locator('..')
      .getByRole('button', { name: 'Restore source content', exact: true }).click()
    await this.#closeEditor()
  }

  async givenOverflowingDraft() {
    await this.givenGeneratedPreview()
    await this.restoreAllOmittedAchievements()
    await this.#expectOverflow()
  }

  async givenCondensationProposal() {
    await this.givenOverflowingDraft()
    await this.requestCondensationProposal()
    await expect(this.#page.getByRole('heading', { name: 'Shorter version proposal' })).toBeVisible({ timeout: 30_000 })
    await expect(this.#page.getByText('The current version fits within two pages.', { exact: true }).last()).toBeVisible({ timeout: 30_000 })
  }

  async givenInsufficientCondensationProposal() {
    await this.givenOverflowingDraft()
    await this.requestCondensationProposal()
    await expect(this.#page.getByRole('heading', { name: 'Shorter version proposal' })).toBeVisible({ timeout: 30_000 })
    await expect(this.#proposal().getByText('This version exceeds two pages.', { exact: false })).toBeVisible({ timeout: 30_000 })
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
    await this.#page.getByRole('tab', { name: 'Restore content', exact: true }).click()
    const restore = this.#page.getByRole('dialog').getByRole('button', { name: 'Restore source content', exact: true })
    while (await restore.count() > 0) {
      const remaining = await restore.count()
      await restore.first().click()
      await expect(restore).toHaveCount(remaining - 1)
    }
    await this.#closeEditor()
    this.#completedAction = 'restored'
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
    await this.#page.getByRole('tab', { name: 'Experience', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Hide experience', exact: true }).first().click()
    await this.#closeEditor()
    this.#completedAction = 'experience-hidden'
  }

  async replaceJobPosting() {
    this.#posting = secondPosting
    await this.#page.getByRole('textbox', { name: 'Job Posting text', exact: true }).fill(secondPosting)
    this.#completedAction = 'posting-replaced'
  }

  async regenerateForAnotherOpportunity() {
    await this.#page.getByRole('button', { name: 'Generate my resume', exact: true }).click()
    await this.#page.getByRole('button', { name: 'Replace and regenerate', exact: true }).click()
    this.#completedAction = 'regenerated'
  }

  async deleteCandidateSession() {
    await this.#page.getByRole('button', { name: 'Delete Candidate Session' }).click()
    await this.#page.getByRole('button', { name: 'Delete session now' }).click()
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

  async expectExportableAfterNameEntry() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeEnabled({ timeout: 30_000 })
    await expect(this.#page.locator('.resume-pdf-pages canvas').first()).toBeVisible()
    await expect(this.#page.getByRole('alert')).toHaveCount(0)
    await this.#expectDocumentTextContains('alex@example.com')
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
    await this.#page.getByRole('tab', { name: 'Restore content', exact: true }).click()
    await expect(this.#page.getByRole('button', { name: 'Restore experience', exact: true })).toBeVisible()
  }

  async expectPreviousResultOutdated() {
    this.#expectAction()
    await expect(this.#page.getByRole('status').filter({ hasText: 'export is paused' })).toBeVisible()
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
    await expect(this.#page.getByText('Candidate Session deleted from this browser.')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Download PDF' })).toHaveCount(0)
    await expect(this.#page.locator('iframe')).toHaveCount(0)
    expect(await this.#page.evaluate(() => localStorage.getItem('honest-resume:candidate-session'))).toBeNull()
    await this.#page.reload()
    await expect(this.#page.getByRole('button', { name: 'Start a Candidate Session' })).toBeVisible()
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
    await expect(this.#page.locator('.sr-only[aria-live="polite"]')).toContainText('Tailored Resume is validated and ready.')
    const transition = await this.#page.getByRole('button', { name: 'Edit resume', exact: true })
      .evaluate((element) => getComputedStyle(element).transitionDuration)
    expect(transition.split(',').every((duration) => parseFloat(duration) <= 0.00001)).toBe(true)
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).focus()
    await this.#page.keyboard.press('Enter')
    await expect(this.#page.getByRole('dialog')).toBeVisible()
    await this.#page.keyboard.press('Escape')
    await expect(this.#page.getByRole('button', { name: 'Edit resume', exact: true })).toBeFocused()
  }

  async expectMobileJourneyExported() {
    const text = this.#expectDownloadedText()
    expect(text).toContain(correctedSummary)
    const overflow = await this.#page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const resume = await this.#page.locator('#tailored-resume-title').boundingBox()
    const intake = await this.#page.locator('#combined-intake-title').boundingBox()
    expect(resume?.y ?? Infinity).toBeLessThan(intake?.y ?? 0)
  }

  async #openConsentedIntake() {
    await this.#installModelAdapters()
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Start a Candidate Session' }).click()
    await this.#fillIntake()
  }

  async #fillIntake() {
    await this.#page.getByRole('textbox', { name: 'Professional text', exact: true }).fill(sourceText)
    await this.#page.getByRole('textbox', { name: 'Job Posting text', exact: true }).fill(this.#posting)
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
    await expect(this.#page.getByRole('alert').filter({ hasText: 'This document exceeds two pages.' })).toBeVisible({ timeout: 30_000 })
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled()
  }

  async #expectNoNormalPathCheckpoint() {
    await expect(this.#page.locator('details').filter({ hasText: 'Match Analysis and supporting evidence' }).first()).not.toHaveAttribute('open')
    await expect(this.#page.getByRole('button', { name: /Approve|Confirm analysis|Continue to/ })).toHaveCount(0)
    const resume = await this.#page.locator('#tailored-resume-title').boundingBox()
    const intake = await this.#page.locator('#combined-intake-title').boundingBox()
    expect(resume?.y ?? Infinity).toBeLessThan(intake?.y ?? 0)
  }

  async #expectPrivacySafeAnalytics(names: readonly string[]) {
    await expect.poll(() => names.every((name) => this.#analytics.some((event) => event.name === name))).toBe(true)
    const serialized = JSON.stringify(this.#analytics)
    for (const content of candidateContent) expect(serialized).not.toContain(content)
  }

  async #openEditor() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await expect(this.#page.getByRole('dialog')).toBeVisible()
  }

  async #closeEditor() {
    await this.#page.keyboard.press('Escape')
    await expect(this.#page.getByRole('dialog')).toHaveCount(0)
  }

  async #openDocumentText() {
    const frame = this.#page.getByTitle('Tailored Resume preview')
    if (!await frame.isVisible()) await this.#page.locator('summary').filter({ hasText: 'Read the document text' }).click()
    return this.#page.frameLocator('iframe[title="Tailored Resume preview"]')
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
  }

  async #installModelAdapters() {
    await this.#page.route('**/api/analytics', async (route) => {
      this.#analytics.push(route.request().postDataJSON() as AnalyticsEvent)
      await route.fulfill({ status: 204, body: '' })
    })
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => route.fulfill({ json: {
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
      if (this.#condensation === 'unavailable') return route.fulfill({ json: { ok: false, error: { type: 'resume-claim-writing-unavailable' } } })
      const input = route.request().postDataJSON() as Readonly<{ claim: Readonly<{ segments: readonly Readonly<{ text: string; factIds: readonly string[] }>[] }> }>
      const segments = input.claim.segments.map((segment) => ({ ...segment,
        text: this.#condensation === 'insufficient' ? segment.text : condense(segment.text) }))
      return route.fulfill({ json: { ok: true, value: { claims: [{ segments }] } } })
    })
  }
}

const sourceText = 'Alex Morgan\nalex@example.com\nFrontend Engineer at Northwind. Built accessible billing screens. React and TypeScript.'
const firstPosting = 'Frontend Engineer. React is required.'
const secondPosting = 'Accessibility Lead. React is required. Inclusive product delivery matters.'
const correctedSummary = 'Built accessible billing screens with React.'
const candidateContent = ['Northwind', 'Contoso', 'billing', 'Alex', 'Morgan', 'example.com', 'Frontend', 'Accessibility'] as const
const reactMatch = { factId: 'source-fact-skills-0-name-0', factExcerpt: 'React', requirementExcerpt: 'React' } as const

const denseTopics = ['checkout', 'invoicing', 'refunds', 'onboarding', 'reporting', 'search', 'navigation', 'settings',
  'notifications', 'permissions', 'exports', 'imports', 'dashboards', 'forms', 'tables', 'charts', 'filters', 'tooltips',
  'dialogs', 'menus', 'carousels', 'uploads', 'downloads', 'profiles', 'messaging', 'calendars', 'payments', 'subscriptions',
  'discounts', 'receipts', 'audits', 'translations', 'themes', 'layouts', 'typography', 'icons', 'errors', 'loading states']
const denseAchievements = denseTopics.map((topic) => `Coordinated the ${topic} interface workstream with product, design and support partners, documenting accessible interaction patterns, reviewing keyboard behaviour and publishing guidance that other delivery teams reused`)
const denseSourceProfile = { ...structuredResumeSource.sourceProfile,
  experiences: structuredResumeSource.sourceProfile.experiences.map((experience, index) => index === 0
    ? { ...experience, achievements: denseAchievements } : experience) }

function condense(text: string) { return `${text.split(' ').slice(0, 5).join(' ').replace(/,$/, '')}.` }

function denseAchievementFields() {
  return denseAchievements.slice(0, 2).map((text, index) => ({ id: `dense-achievement-${String(index)}`, text,
    factIds: [`source-fact-experiences-0-achievements-${String(index)}` as const] }))
}
