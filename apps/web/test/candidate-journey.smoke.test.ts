import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { groupedResumeDocument, structuredResumeJobMatch, structuredResumeSource } from '@resume-tailoring/application/structured-resume-fixtures'
import type { ResumeWritingInput, ResumeValidationInput } from '@resume-tailoring/application/candidate-journey'
import { readProfessionalResumeFields } from '@resume-tailoring/application/candidate-journey'

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

  test('recovers interrupted preparation after reload', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'interrupted' })
    await system.givenInterruptedPreparation()

    await system.resumePreparation()

    await system.expectGroupedPreview()
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

  test('explains a failed posting analysis in a single alert', async ({ page }) => {
    const system = createSystemUnderTest({ page, scenario: 'posting-extraction-unavailable' })
    await system.givenCombinedIntake()

    await system.generateResume()

    await system.expectSinglePostingFailureAlert()
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
  | 'unsafe-output' | 'interrupted' | 'unavailable' | 'pending-writing' | 'posting-extraction-unavailable'

class CandidateJourneyTestSystem {
  readonly #page: Page
  readonly #errors: string[] = []
  #downloadPath: string | null = null
  #scenario: Scenario
  #completedAction: string | null = null

  constructor(page: Page, scenario: Scenario) {
    this.#page = page; this.#scenario = scenario
    page.on('pageerror', (error) => { this.#errors.push(error.message) })
  }

  async #installModelAdapters() {
    await this.#page.route('**/api/resume-claim-validation', (route) => route.fulfill({ json: {
      ok: false, error: { type: 'unavailable' },
    } }))
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => route.fulfill({ json: {
      ok: true, value: extractionFor(this.#scenario),
    } }))
    await this.#page.route('**/api/explainable-job-posting-extraction', (route) => route.fulfill({ json: this.#scenario === 'posting-extraction-unavailable'
      ? { ok: false, error: 'job-posting-extraction-unavailable' } : {
      ok: true, value: { targetRole: structuredResumeJobMatch.targetRole, practicalConstraints: [], requirements: requirementsFor(this.#scenario) },
    } }))
    await this.#page.route('**/api/explainable-match-evidence', (route) => route.fulfill({ json: {
      ok: true, value: matchFor(this.#scenario),
    } }))
    await this.#page.route('**/api/resume-document-writing', (route) => {
      if (this.#scenario === 'interrupted') return route.abort()
      if (this.#scenario === 'pending-writing') return new Promise<void>(() => undefined)
      if (this.#scenario === 'unavailable') return route.fulfill({ json: { ok: false, error: { type: 'unavailable' } } })
      const input = route.request().postDataJSON() as ResumeWritingInput
      return route.fulfill({ json: { ok: true, value: writtenDocument({ input, scenario: this.#scenario }) } })
    })
    await this.#page.route('**/api/resume-document-validation', (route) => {
      const input = route.request().postDataJSON() as ResumeValidationInput
      return route.fulfill({ json: { ok: true, value: { coherent: true, languageMatches: true,
        fields: readProfessionalResumeFields(input.document).map(({ id }) => ({ fieldId: id, supported: this.#scenario !== 'unsafe-output' })),
      } } })
    })
  }

  async openUnconsentedIntake() {
    await this.#installModelAdapters()
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Start a Candidate Session' }).click()
    this.#completedAction = 'intake-opened'
  }

  async givenCombinedIntake() {
    await this.openUnconsentedIntake()
    await this.#page.getByRole('textbox', { name: 'Professional text', exact: true }).fill(
      'Alex Morgan\nalex@example.com\nFrontend Engineer at Northwind. Built accessible billing screens. React and TypeScript.')
    await this.#page.getByRole('textbox', { name: 'Job Posting text', exact: true }).fill(postingText)
  }

  async givenCombinedIntakeInFrench() {
    await this.givenCombinedIntake()
    await this.#page.getByRole('combobox', { name: 'Resume language', exact: true }).click()
    await this.#page.getByRole('option', { name: 'Français', exact: true }).click()
  }

  async generateResume() {
    await this.#page.getByRole('button', { name: 'Generate my resume', exact: true }).click()
    this.#completedAction = 'generated'
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
    await expect(this.#page.getByTitle('Tailored Resume preview')).toHaveCount(0)
  }

  async correctBlockingAmbiguity() {
    await this.#page.getByRole('textbox', { name: 'Which skill did you use?' }).fill('React')
    await this.#page.getByRole('button', { name: 'Save this answer' }).click()
    this.#completedAction = 'corrected'
  }

  async givenNoCorrespondenceResult() {
    await this.givenCombinedIntake()
    await this.generateResume()
    await expect(this.#page.getByTitle('Tailored Resume preview')).toHaveCount(0)
    await expect(this.#page.getByRole('button', { name: 'Prepare a non-tailored resume' })).toBeVisible()
  }

  async givenFailedResumeWithOptionalCorrection() {
    await this.givenCombinedIntake()
    await this.#page.route('**/api/resume-document-writing', (route) => route.fulfill({ json: { ok: false, error: { type: 'unavailable' } } }))
    await this.generateResume()
    await expect(this.#page.getByText('Preparation could not finish.', { exact: false }).first()).toBeVisible()
    await this.#page.getByText('Inspect or enrich your source evidence', { exact: true }).click()
    await this.#page.unroute('**/api/resume-document-writing')
    await this.#installModelAdapters()
    await this.#page.route('**/api/structured-source-profile-extraction', (route) => route.fulfill({ json: { ok: false, error: 'source-profile-extraction-unavailable' } }))
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
    await this.#page.getByText('Inspect or enrich your source evidence', { exact: true }).click()
    await this.#page.getByRole('button', { name: 'Inspect Source Profile', exact: true }).click()
    this.#completedAction = 'inspected'
  }

  async replacePosting() {
    await this.#page.getByRole('textbox', { name: 'Job Posting text', exact: true }).fill('Rust engineer. Rust is required.')
    this.#completedAction = 'posting-replaced'
  }

  async expectCurrentSourceEvidence() {
    this.#expectAction()
    const source = this.#page.getByRole('region', { name: 'Complete your Source Intake' })
    await expect(source.getByText('Frontend Engineer — Northwind', { exact: true })).toBeVisible()
    await expect(source.getByText('Built accessible billing screens', { exact: true })).toBeVisible()
  }

  async expectOutdatedCorrectionRemoved() {
    this.#expectAction()
    await expect(this.#page.getByRole('textbox', { name: 'Which skill did you use?' })).toHaveCount(0)
    await expect(this.#page.getByTitle('Tailored Resume preview')).toHaveCount(0)
  }

  async prepareNormalizedResume() {
    await this.#page.getByRole('button', { name: 'Prepare a non-tailored resume' }).click()
    this.#completedAction = 'normalized'
  }

  async givenInterruptedPreparation() {
    await this.givenCombinedIntake()
    await this.#page.route('**/api/resume-document-writing', async (route) => {
      await new Promise((resolve) => { setTimeout(resolve, 2_000) })
      await route.abort().catch(() => undefined)
    })
    await this.generateResume()
    await expect(this.#page.getByRole('region', { name: 'Candidate Journey progress' })).toContainText('Writing')
    await this.#page.reload()
    await expect(this.#page.getByText('Generation was interrupted.', { exact: false })).toBeVisible()
    await this.#page.unroute('**/api/resume-document-writing')
    this.#scenario = 'normal'
    await this.#installModelAdapters()
  }

  async resumePreparation() {
    await this.#page.getByRole('button', { name: 'Try again' }).click()
    this.#completedAction = 'resumed'
  }

  async regenerateWithUnavailableWriter() {
    this.#scenario = 'unavailable'
    await this.#page.getByRole('button', { name: 'Generate my resume', exact: true }).click()
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
    await this.#page.getByLabel('Resume Field', { exact: true }).first().fill('Led 100 engineers')
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
    await expect(this.#page.getByText('This professional edit is not supported by the current Candidate Facts.', { exact: true })).toBeVisible()
  }

  async expectPreviewFirstReview() {
    await expect(this.#page.getByRole('button', { name: 'Edit resume', exact: true })).toBeVisible()
    await expect(this.#page.getByLabel('Resume Field', { exact: true })).toHaveCount(0)
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
    const bytes = new Uint8Array(await readFile(this.#downloadPath))
    const loading = getDocument({ data: bytes })
    try {
      const pdf = await loading.promise
      expect(pdf.numPages).toBe(1)
      const pdfPage = await pdf.getPage(1)
      const text = (await pdfPage.getTextContent()).items.flatMap((item) => 'str' in item ? item.str : []).join(' ')
      expect(text).toContain('Alex Morgan')
      expect(text).toContain('Northwind')
      expect(text).toContain('React')
      await expect(this.#page.locator('.resume-pdf-pages canvas')).toHaveCount(pdf.numPages)
      await expect(this.#page.getByRole('status').filter({ hasText: 'PDF handed to your browser' })).toBeVisible()
      await this.#page.getByText('Read the document text', { exact: true }).click()
      await this.#page.setViewportSize({ width: 1280, height: 1800 })
      await this.#page.locator('[aria-labelledby="tailored-resume-preview-title"]').screenshot({ path: 'test-results/bak-59-preview.png' })
    } finally { await loading.destroy() }
  }

  async enterUnsupportedProfessionalText() {
    await this.#page.getByRole('button', { name: 'Edit resume', exact: true }).click()
    await this.#page.getByRole('tab', { name: 'Summary', exact: true }).click()
    await this.#page.getByRole('textbox', { name: 'Resume Field', exact: true }).first()
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
    await expect(this.#page.getByRole('button', { name: 'Attest as a new Candidate Fact', exact: true })).toBeVisible()
    await this.#page.keyboard.press('Escape')
    await expect(this.#page.getByRole('button', { name: 'Download PDF', exact: true })).toBeDisabled({ timeout: 20_000 })
    await expect(this.#page.getByText('Resolve or confirm the unsupported professional changes before downloading.', { exact: true })).toBeVisible()
  }

  async givenRenderingFails() {
    await this.#page.route('**/api/resume-document', (route) => route.fulfill({ status: 503, body: '{}' }))
  }

  async retryResumePreview() {
    await this.#page.getByRole('button', { name: 'Retry preview', exact: true }).waitFor({ state: 'visible' })
    await this.#page.unroute('**/api/resume-document')
    await this.#page.getByRole('button', { name: 'Retry preview', exact: true }).click()
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
      expect(text).toContain('Normalized Resume — not tailored')
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
    await expect(this.#page.getByText(/^Processed by .+, with nothing stored on our servers.$/)).toBeVisible()
    await this.#page.getByRole('button', { name: 'Delete Candidate Session' }).click()
    await this.#page.getByRole('button', { name: 'Delete session now' }).click()
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
    await expect(this.#page.getByText('Ambiguous evidence was left out.', { exact: false })).toBeVisible()
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
    await expect(this.#page.getByText('A low Match Score', { exact: false })).toBeVisible()
  }

  async expectAdjacentEvidenceNextToTheGap() {
    await this.expectGroupedPreview()
    await this.#page.getByText('Match Analysis and supporting evidence', { exact: true }).click()
    const gaps = this.#page.getByRole('listitem').filter({ hasText: /^Java/u })
    await expect(gaps.first()).toContainText(
      'Related experience you can highlight instead (it does not meet this requirement): TypeScript')
    await this.#page.getByText('Complete requirement-to-evidence details', { exact: true }).click()
    const javaDetail = this.#page.locator('.mantine-Paper-root').filter({ hasText: 'Java is required.' }).last()
    await expect(javaDetail).toContainText('Uncovered')
    await expect(javaDetail).toContainText('No supporting Candidate Fact.')
    await expect(javaDetail).toContainText('it does not meet this requirement): TypeScript')
    await expect(javaDetail.getByText('Covered', { exact: true })).toHaveCount(0)
  }

  async expectNormalizedPreview() {
    this.#expectAction()
    await expect(this.#page.getByText('Non-tailored resume ready', { exact: true })).toBeVisible()
    await this.#showDocumentText()
    await expect(this.#page.frameLocator('iframe').getByText('Normalized Resume', { exact: false })).toBeVisible()
  }

  async expectFrenchPreview() {
    this.#expectAction()
    await this.#showDocumentText()
    await expect(this.#page.locator('iframe')).toBeVisible()
    await expect(this.#page.frameLocator('iframe').getByText('Développement d’interfaces de facturation accessibles.', { exact: true })).toBeVisible()
    await expect(this.#page.frameLocator('iframe').getByText('Northwind', { exact: true })).toBeVisible()
  }

  async expectUnsafeOutputRejected() {
    this.#expectAction()
    await expect(this.#page.getByText('The generated wording could not be supported', { exact: false })).toBeVisible()
    await expect(this.#page.getByTitle('Tailored Resume preview')).toHaveCount(0)
  }

  async expectStablePreviewAfterFailure() {
    this.#expectAction()
    await expect(this.#page.getByRole('alert').filter({ hasText: 'Preparation could not finish.' })).toBeVisible()
    await this.expectGroupedPreview()
  }

  async expectDeletedSession() {
    this.#expectAction()
    await expect(this.#page.getByRole('button', { name: 'Start a Candidate Session' })).toBeVisible()
    await expect(this.#page.getByText('Candidate Session deleted from this browser.')).toBeVisible()
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

  async expectIntakeLockedDuringPreparation() {
    this.#expectAction()
    await expect(this.#page.getByRole('region', { name: 'Candidate Journey progress' })).toBeVisible()
    await expect(this.#page.getByRole('textbox', { name: 'Job Posting text', exact: true })).toBeDisabled()
    await expect(this.#page.getByRole('combobox', { name: 'Resume language', exact: true })).toBeDisabled()
  }

  async expectNoEmptyResultDisclosures() {
    this.#expectAction()
    await expect(this.#page.getByRole('textbox', { name: 'Job Posting text', exact: true })).toBeVisible()
    await expect(this.#page.getByText('Match Analysis and supporting evidence', { exact: true })).toHaveCount(0)
    await expect(this.#page.getByText('Inspect or enrich your source evidence', { exact: true })).toHaveCount(0)
  }

  async expectPolicyDisclosedAtGeneration() {
    this.#expectAction()
    const generate = this.#page.getByRole('button', { name: 'Generate my resume' })
    await expect(generate).toHaveAccessibleDescription(/OpenAI/)
    await expect(generate).toBeEnabled()
    await expect(this.#page.getByRole('textbox', { name: 'Professional text' })).toBeVisible()
    await expect(this.#page.getByRole('textbox', { name: 'Job Posting text' })).toBeVisible()
  }

  async #showDocumentText() {
    const frame = this.#page.locator('iframe')
    await frame.waitFor({ state: 'attached' })
    if (await frame.isVisible()) return
    await this.#page.locator('summary').filter({ hasText: /Read the document text|Lire le texte du document/ }).click()
  }

  #expectAction() { expect(this.#completedAction, 'Perform a Candidate Journey action before reading the outcome').not.toBeNull() }
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

function writtenDocument({ input, scenario }: Readonly<{ input: ResumeWritingInput; scenario: Scenario }>) {
  if (scenario === 'blocking-ambiguity') return { purpose: input.purpose, locale: input.locale,
    targetRole: input.jobMatch.targetRole, experiences: [], sections: [],
    valueProposition: { kind: 'prose', paragraphs: [{ id: 'summary-react', text: 'React experience.', factIds: ['source-fact-skills-0-name-0'] }] } }
  return { purpose: input.purpose, locale: input.locale, targetRole: input.purpose === 'normalized' ? null : input.jobMatch.targetRole,
    sections: groupedResumeDocument.sections,
    experiences: groupedResumeDocument.experiences.map((experience) => ({ ...experience,
      context: experience.context === null ? null : input.candidateFacts.some(({ id }) => id === experience.context.factIds[0])
        ? { ...experience.context, text: input.candidateFacts.find(({ id }) => id === experience.context.factIds[0])?.value ?? experience.context.text } : null })),
    valueProposition: { kind: 'prose', paragraphs: [{ id: 'summary-billing',
      text: input.locale === 'fr' ? 'Développement d’interfaces de facturation accessibles.' : 'Accessible billing interfaces backed by React experience.',
      factIds: ['source-fact-experiences-0-achievements-0', 'source-fact-skills-0-name-0'] }] },
  }
}
