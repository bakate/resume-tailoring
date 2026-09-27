import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { CandidateSessionPersistence } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

import { jobRequirementExtractionMaximumCharacters } from '../src/resume-tailoring/job-requirement-schemas'
import { matchAnalysisRequestSchema } from '../src/resume-tailoring/match-analysis-schemas'
import { sourceProfileExtractionMaximumCharacters } from '../src/resume-tailoring/source-profile-schemas'
import { resumeClaimWritingRequestSchema } from '../src/resume-tailoring/resume-claim-schemas'

declare global {
  interface Window {
    candidateSessionTestPersistence?: CandidateSessionPersistence
    presentedDocumentLocales: string[]
    readInstalledPersistence: () => CandidateSessionPersistence
  }
}

test('a Candidate can start a private Resume Tailoring session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  system.givenResumeTailoringIsAvailable()

  await system.startResumeTailoringSession()

  await system.expectResumeTailoringSessionToBeStoredInIndexedDb()
})

test('a Candidate can restore an unexpired session after reload', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.reloadResumeTailoringSession()

  await system.expectResumeTailoringSessionToBeReady()
})

test('deleting a Candidate session invalidates every open tab', async ({ page }) => {
  const secondPage = await page.context().newPage()
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActiveInBothTabs({ secondPage })

  await system.deleteResumeTailoringSessionInSecondTab({ secondPage })

  await system.expectResumeTailoringSessionDeletedInBothTabs({ secondPage })
})

test('expiration invalidates Candidate content in every open tab', async ({ page }) => {
  const secondPage = await page.context().newPage()
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionWillExpireInBothTabs({ secondPage })

  await system.expireResumeTailoringSessionInBothTabs({ secondPage })

  await system.expectResumeTailoringSessionDeletedInBothTabs({ secondPage })
})

test('startup removes already expired Candidate content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionAlreadyExpired()

  await system.reloadExpiredCandidateSession()

  await system.expectResumeTailoringSessionToBeNotStarted()
})

test('a late response cannot recreate a deleted Candidate session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionWasDeleted()

  await system.applyLateCandidateSessionResponse()

  system.expectLateResponseToBeDiscarded()
})

test('a late response cannot recreate an expired Candidate session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionWasExpired()

  await system.applyLateCandidateSessionResponse()

  system.expectLateResponseToBeDiscarded()
})

test('a response cannot extend the absolute Candidate session expiration', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsStored()

  await system.extendCandidateSessionExpirationFromResponse()

  system.expectSessionExpirationExtensionToBeRejected()
})

test('a Candidate can recover from an unknown page', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  system.givenUnknownRoute('/missing-route')

  await system.openUnknownPage()

  await system.expectPageNotFoundWithWorkflowLink()
})

test('explains local expiry for Candidate content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  system.givenResumeTailoringIsAvailable()

  await system.viewResumeTailoring()

  await system.expectCandidateContentRetentionExplained()
})

test('renders the Resume Tailoring interface in English', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserPrefersLanguages({ languages: ['en-US', 'fr-FR'] })

  await system.viewResumeTailoring()

  await system.expectResumeTailoringToBeInEnglish()
})

test('renders the Resume Tailoring interface in French', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserPrefersLanguages({ languages: ['fr-FR', 'en-US'] })

  await system.viewResumeTailoring()

  await system.expectResumeTailoringToBeInFrench()
  await system.expectFrenchWasFirstPresentedLocale()
})

test('falls back to English for unsupported browser languages', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenBrowserPrefersLanguages({ languages: ['de-DE'] })

  await system.viewResumeTailoring()

  await system.expectResumeTailoringToBeInEnglish()
})

test('a Candidate can switch locale without losing an active session', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()

  await system.switchResumeTailoringToFrench()

  await system.expectFrenchLocaleAndCandidateSessionToBeRetained()
})

test('a Candidate builds a Verified Source Profile from minimized PDF content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()

  await system.buildVerifiedSourceProfile()

  await system.expectVerifiedSourceProfileBuiltFromMinimizedContent()
})

test('a Candidate restores the Verified Source Profile after reload', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenVerifiedSourceProfile()

  await system.reloadVerifiedSourceProfile()

  await system.expectVerifiedSourceProfileToBeRestored()
})

test('a Candidate reviews classified atomic Job Requirements from minimized content', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenJobRequirementExtractionIsAvailable()

  await system.extractRequirementsFromMinimizedJobPosting()

  await system.expectAtomicJobRequirementsWithSourceProvenance()
})

test('a Candidate sees an evidence-backed Match Score and Gap Analysis', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()

  await system.analyzeMatch()

  await system.expectEvidenceBackedMatchScoreAndGapAnalysis()
})

test('a Candidate generates validated provenance-backed Resume Claims', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.givenStructuredExtractionIsAvailable()
  await system.givenJobRequirementExtractionIsAvailable()
  await system.givenMatchAnalysisIsAvailable()
  await system.givenResumeClaimServicesAreAvailable()
  await system.buildVerifiedSourceProfile()
  await system.extractRequirementsFromMinimizedJobPosting()
  await system.analyzeMatch()

  await system.generateResumeClaims()

  await system.expectValidatedResumeClaimsWithoutFreeEditing()
})

test('a Candidate restores provenance-backed Resume Claims after reload', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()

  await system.reloadTailoredResume()

  await system.expectTailoredResumeToBeRestored()
})

test('a Candidate previews and downloads the same validated one-page resume', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenTailoredResumeIsStored()
  await system.givenValidatedResumePdfExportIsAvailable()

  await system.downloadTailoredResumePdf()

  await system.expectPreviewAndPdfToUseTheSameRetainedClaims()
})

test('localizes sensitive labels and preserves legitimate French words', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  await system.givenCandidateSessionIsActive()
  await system.switchResumeTailoringToFrench()

  await system.reviewFrenchJobPostingWithPhoneNumber()

  await system.expectFrenchSensitiveLabelAndIntactJobPosting()
})

test('rejects oversized professional content before model processing', async ({ page }) => {
  await page.goto('/')

  const responseStatus = await page.evaluate(async (maximumCharacters) => {
    const response = await fetch('/api/source-profile-extraction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professionalContent: 'x'.repeat(maximumCharacters + 1) }),
    })
    return response.status
  }, sourceProfileExtractionMaximumCharacters)

  expect(responseStatus).toBe(413)
})

test('rejects an oversized Job Posting before model processing', async ({ page }) => {
  await page.goto('/')

  const responseStatus = await page.evaluate(async (maximumCharacters) => {
    const response = await fetch('/api/job-requirement-extraction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobPostingContent: 'x'.repeat(maximumCharacters + 1) }),
    })
    return response.status
  }, jobRequirementExtractionMaximumCharacters)

  expect(responseStatus).toBe(413)
})

function createSystemUnderTest({ page }: Readonly<{ page: Page }>) {
  return new ResumeTailoringBrowserTestSystem(page)
}

type CompletedAction =
  | 'candidate-session-expired'
  | 'candidate-session-reloaded'
  | 'candidate-session-response-applied'
  | 'candidate-session-synchronized'
  | 'expiration-extension-attempted'
  | 'job-requirements-extracted'
  | 'job-posting-reviewed'
  | 'match-analyzed'
  | 'resume-tailoring-opened'
  | 'resume-tailoring-viewed'
  | 'resume-claims-generated'
  | 'resume-claims-reloaded'
  | 'resume-pdf-downloaded'
  | 'source-profile-built'
  | 'source-profile-reloaded'
  | 'unknown-page-opened'

class ResumeTailoringBrowserTestSystem {
  readonly #page: Page
  #completedAction: CompletedAction | undefined
  #lateResponseOutcome: unknown
  #extractionRequestContent: string | undefined
  #jobPostingRequestContent: string | undefined
  #resumePdfRequest: unknown
  #unknownRoute: string | undefined

  constructor(page: Page) {
    this.#page = page
  }

  givenResumeTailoringIsAvailable() {}

  givenUnknownRoute(route: string) {
    this.#unknownRoute = route
  }

  async givenCandidateSessionIsActive() {
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Start tailoring' }).click()
    await this.#page.getByText('Workflow opened').waitFor()
  }

  async givenStructuredExtractionIsAvailable() {
    await this.#page.route('**/api/source-profile-extraction', async (route) => {
      this.#extractionRequestContent = readProfessionalContent(route.request().postData())
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: [{
            kind: 'experience',
              propositionKey: 'proposition-experience-acme-role',
            value: 'Senior FullStack Developer using React at Acme',
          }],
        }),
      })
    })
  }

  async givenJobRequirementExtractionIsAvailable() {
    await this.#page.route('**/api/job-requirement-extraction', async (route) => {
      this.#jobPostingRequestContent = readJobPostingContent(route.request().postData())
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(jobRequirementExtractionResponse),
      })
    })
  }

  async givenMatchAnalysisIsAvailable() {
    await this.#page.route('**/api/match-analysis', async (route) => {
      const matchRequest = readMatchRequest(route.request().postData())
      const preferredRequirement = matchRequest?.requirements.find(
        (requirement) => requirement.classification === 'preferred',
      )
      const [verifiedFact] = matchRequest?.verifiedFacts ?? []
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: {
            evidence: preferredRequirement === undefined || verifiedFact === undefined
              ? []
              : [{
                requirementId: preferredRequirement.id,
                factMatches: [{
                  factId: verifiedFact.id,
                  factTerm: 'React',
                  relationship: 'exact',
                  requirementTerm: 'React',
                }],
              }],
            relevantFactIds: verifiedFact === undefined ? [] : [verifiedFact.id],
          },
        }),
      })
    })
  }

  async givenResumeClaimServicesAreAvailable() {
    await this.#page.route('**/api/resume-claim-writing', async (route) => {
      const writingRequest = resumeClaimWritingRequestSchema.safeParse(
        JSON.parse(route.request().postData() ?? 'null') as unknown,
      )
      const [verifiedFact] = writingRequest.success ? writingRequest.data.verifiedFacts : []
      const claimTexts = [
        'Built React applications at Acme',
        'Worked as a FullStack Developer at Acme',
      ]
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          value: {
            claims: verifiedFact === undefined ? [] : claimTexts.map((text) => ({
              segments: [{ text, factIds: [verifiedFact.id] }],
            })),
          },
        }),
      })
    })
    await this.#page.route('**/api/resume-claim-validation', async (route) => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, value: { supported: true, feedback: [] } }),
      })
    })
  }

  async givenVerifiedSourceProfile() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.buildVerifiedSourceProfile()
  }

  async givenTailoredResumeIsStored() {
    await this.givenCandidateSessionIsActive()
    await this.givenStructuredExtractionIsAvailable()
    await this.givenJobRequirementExtractionIsAvailable()
    await this.givenMatchAnalysisIsAvailable()
    await this.givenResumeClaimServicesAreAvailable()
    await this.buildVerifiedSourceProfile()
    await this.extractRequirementsFromMinimizedJobPosting()
    await this.analyzeMatch()
    await this.generateResumeClaims()
  }

  async givenValidatedResumePdfExportIsAvailable() {
    await this.#page.route('**/api/tailored-resume-pdf', async (route) => {
      this.#resumePdfRequest = JSON.parse(route.request().postData() ?? 'null') as unknown
      await route.fulfill({
        contentType: 'application/pdf',
        headers: { 'Content-Disposition': 'attachment; filename="tailored-resume.pdf"' },
        body: Buffer.from('%PDF-validated-test'),
      })
    })
  }

  async givenBrowserPrefersLanguages({ languages }: Readonly<{ languages: readonly string[] }>) {
    await this.#page.addInitScript((browserLanguages) => {
      window.presentedDocumentLocales = []
      Object.defineProperty(navigator, 'languages', { get: () => browserLanguages })
      Object.defineProperty(navigator, 'language', { get: () => browserLanguages[0] ?? 'en-US' })
      const recordPresentedLocale = () => {
        const body = document.querySelector('body')
        if (body === null || getComputedStyle(body).visibility === 'hidden') return
        const presentedLocale = document.documentElement.lang
        if (window.presentedDocumentLocales.includes(presentedLocale)) return
        window.presentedDocumentLocales.push(presentedLocale)
      }
      new MutationObserver(recordPresentedLocale).observe(document, {
        attributes: true,
        childList: true,
        subtree: true,
      })
    }, languages)
  }

  async givenCandidateSessionIsStored() {
    await this.#page.goto('/')
    await seedCandidateSession({
      page: this.#page,
      expiresAt: lateResponseSession.expiresAt,
    })
  }

  async givenCandidateSessionIsActiveInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    await Promise.all([this.#page.goto('/'), secondPage.goto('/')])
    await this.#page.getByRole('button', { name: 'Start tailoring' }).click()
    await secondPage.getByText('Workflow opened').waitFor()
  }

  async givenCandidateSessionWillExpireInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    await Promise.all([this.#page.goto('/'), secondPage.goto('/')])
    await seedCandidateSession({ page: this.#page, expiresAt: Date.now() + 1_500 })
    await Promise.all([this.#page.reload(), secondPage.reload()])
    await Promise.all([
      this.#page.getByText('Workflow opened').waitFor(),
      secondPage.getByText('Workflow opened').waitFor(),
    ])
  }

  async givenCandidateSessionAlreadyExpired() {
    await this.#page.goto('/')
    await seedCandidateSession({ page: this.#page, expiresAt: Date.now() - 1 })
  }

  async givenCandidateSessionWasDeleted() {
    await this.#page.goto('/')
    await seedCandidateSession({ page: this.#page, expiresAt: lateResponseSession.expiresAt })
    await eraseCandidateSession(this.#page)
  }

  async givenCandidateSessionWasExpired() {
    await this.#page.goto('/')
    await seedCandidateSession({ page: this.#page, expiresAt: Date.now() - 1 })
    await this.#page.reload()
    await this.#page.getByText('Ready to begin').waitFor()
  }

  async startResumeTailoringSession() {
    await this.#page.goto('/')
    await this.#page.getByRole('button', { name: 'Start tailoring' }).click()
    this.#completedAction = 'resume-tailoring-opened'
  }

  async reloadResumeTailoringSession() {
    await this.#page.reload()
    this.#completedAction = 'candidate-session-reloaded'
  }

  async deleteResumeTailoringSessionInSecondTab({ secondPage }: Readonly<{ secondPage: Page }>) {
    await secondPage.getByRole('button', { name: 'Delete private session' }).click()
    this.#completedAction = 'candidate-session-synchronized'
  }

  async expireResumeTailoringSessionInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    await Promise.all([
      waitForStartTailoringToBeEnabled(this.#page),
      waitForStartTailoringToBeEnabled(secondPage),
    ])
    this.#completedAction = 'candidate-session-expired'
  }

  async reloadExpiredCandidateSession() {
    await this.#page.reload()
    this.#completedAction = 'candidate-session-reloaded'
  }

  async applyLateCandidateSessionResponse() {
    this.#lateResponseOutcome = await updateCandidateSession(this.#page, lateResponseSession)
    this.#completedAction = 'candidate-session-response-applied'
  }

  async extendCandidateSessionExpirationFromResponse() {
    this.#lateResponseOutcome = await extendCandidateSessionExpiration(this.#page)
    this.#completedAction = 'expiration-extension-attempted'
  }

  async openUnknownPage() {
    await this.#page.goto(this.#readUnknownRoute())
    this.#completedAction = 'unknown-page-opened'
  }

  async viewResumeTailoring() {
    await this.#page.goto('/')
    this.#completedAction = 'resume-tailoring-viewed'
  }

  async switchResumeTailoringToFrench() {
    await this.#page.getByRole('button', { name: 'Français' }).click()
    await this.#page.locator('html[lang="fr"]').waitFor()
    await this.#page.reload()
    this.#completedAction = 'resume-tailoring-viewed'
  }

  async buildVerifiedSourceProfile() {
    await this.#page.getByLabel('Choose a PDF Source Document').setInputFiles({
      name: 'resume.pdf',
      mimeType: 'application/pdf',
      buffer: createTextPdf(
        'bakate@example.com +33 6 12 34 56 78 Senior FullStack Developer using React at Acme',
      ),
    })
    await this.#page.getByLabel('Exact content that will be sent for extraction').waitFor()
    await this.#page.getByRole('button', { name: 'Confirm this processing notice' }).click()
    await this.#page.getByRole('button', { name: 'Extract professional facts' }).click()
    await this.#page.getByRole('button', { name: 'Confirm fact' }).click()
    await this.#page.getByText('Verified', { exact: true }).waitFor()
    this.#completedAction = 'source-profile-built'
  }

  async reloadVerifiedSourceProfile() {
    await this.#page.reload()
    this.#completedAction = 'source-profile-reloaded'
  }

  async reloadTailoredResume() {
    await this.#page.reload()
    this.#completedAction = 'resume-claims-reloaded'
  }

  async downloadTailoredResumePdf() {
    const downloadPromise = this.#page.waitForEvent('download')
    await this.#page.getByRole('button', { name: 'Download validated A4 PDF' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('tailored-resume.pdf')
    this.#completedAction = 'resume-pdf-downloaded'
  }

  async extractRequirementsFromMinimizedJobPosting() {
    await this.#page.getByLabel('Paste the Job Posting').fill(
      `${jobPostingExcerpt}\nContact jobs@example.com\nSalary: competitive`,
    )
    await this.#page.getByRole('button', { name: 'Review this Job Posting' }).click()
    const editor = this.#page.getByLabel('Exact Job Posting content sent for extraction')
    await editor.fill(jobPostingExcerpt)
    await this.#page.getByRole('button', { name: 'Save minimized Job Posting' }).click()
    await this.#page.getByRole('button', { name: 'Confirm Job Posting processing' }).click()
    await this.#page.getByRole('button', { name: 'Extract Job Requirements' }).click()
    await this.#page.getByRole('heading', { name: 'Review extracted Job Requirements' }).waitFor()
    this.#completedAction = 'job-requirements-extracted'
  }

  async reviewFrenchJobPostingWithPhoneNumber() {
    await this.#page.getByLabel("Colle l'Offre d'emploi").fill(
      `${legitimateFrenchJobPosting}\nTéléphone : +33 6 12 34 56 78`,
    )
    await this.#page.getByRole('button', { name: "Vérifier cette Offre d'emploi" }).click()
    await this.#page.getByLabel(
      "Contenu exact de l'Offre d'emploi envoyé pour l'extraction",
    ).waitFor()
    this.#completedAction = 'job-posting-reviewed'
  }

  async analyzeMatch() {
    await this.#page.getByRole('button', { name: 'Analyze the match' }).click()
    await this.#page.getByText('33%', { exact: true }).waitFor()
    this.#completedAction = 'match-analyzed'
  }

  async generateResumeClaims() {
    await this.#page.getByRole('button', { name: 'Generate Resume Claims' }).click()
    await this.#page.getByText('Built React applications at Acme', { exact: true }).waitFor()
    this.#completedAction = 'resume-claims-generated'
  }

  async expectResumeTailoringSessionToBeStoredInIndexedDb() {
    this.#expectCompletedAction('resume-tailoring-opened')
    await expect(this.#page.getByText('Workflow opened')).toBeVisible()
    const storage = await readBrowserStorage(this.#page)
    expect(storage.localStorageLength).toBe(0)
    expect(storage.sessionId).toMatch(/^candidate-session-/)
    expect(storage.remainingLifetime).toBeGreaterThan(24 * 60 * 60 * 1_000 - 10_000)
  }

  async expectResumeTailoringSessionToBeReady() {
    this.#expectCompletedAction('candidate-session-reloaded')
    await expect(this.#page.getByText('Workflow opened')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Delete private session' })).toBeVisible()
  }

  async expectResumeTailoringSessionDeletedInBothTabs({ secondPage }: Readonly<{ secondPage: Page }>) {
    this.#expectCandidateSessionInvalidationAction()
    await expect(this.#page.getByText('Ready to begin')).toBeVisible()
    await expect(secondPage.getByText('Ready to begin')).toBeVisible()
  }

  async expectResumeTailoringSessionToBeNotStarted() {
    this.#expectCompletedAction('candidate-session-reloaded')
    await expect(this.#page.getByText('Ready to begin')).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Start tailoring' })).toBeEnabled()
  }

  expectLateResponseToBeDiscarded() {
    this.#expectCompletedAction('candidate-session-response-applied')
    expect(this.#lateResponseOutcome).toEqual(inactiveSessionOutcome)
  }

  expectSessionExpirationExtensionToBeRejected() {
    this.#expectCompletedAction('expiration-extension-attempted')
    expect(this.#lateResponseOutcome).toEqual({
      update: inactiveSessionResult,
      currentExpiresAt: lateResponseSession.expiresAt,
    })
  }

  async expectPageNotFoundWithWorkflowLink() {
    this.#expectCompletedAction('unknown-page-opened')
    await expect(this.#page).toHaveTitle('Honest Resume')
    await expect(this.#page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
    await expect(this.#page.getByRole('link', { name: 'Return to the workflow' })).toHaveAttribute(
      'href',
      '/',
    )
  }

  async expectCandidateContentRetentionExplained() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.getByText(/expires locally after 24 hours/)).toBeVisible()
    await expect(this.#page.getByText(/Downloaded files remain on your device/)).toBeVisible()
  }

  async expectResumeTailoringToBeInEnglish() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(
      this.#page.getByRole('heading', { name: 'Tailor your resume without inventing a thing.' }),
    ).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  async expectResumeTailoringToBeInFrench() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await expect(this.#page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(
      this.#page.getByRole('heading', { name: 'Adapte ton CV sans rien inventer.' }),
    ).toBeVisible()
    await expect(this.#page.getByRole('button', { name: 'Français' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  }

  async expectFrenchWasFirstPresentedLocale() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    expect(await this.#page.evaluate(() => window.presentedDocumentLocales)).toEqual(['fr'])
  }

  async expectFrenchLocaleAndCandidateSessionToBeRetained() {
    this.#expectCompletedAction('resume-tailoring-viewed')
    await this.expectResumeTailoringToBeInFrench()
    await expect(this.#page.getByText('Parcours ouvert')).toBeVisible()
    await expect(
      this.#page.getByRole('button', { name: 'Supprimer ma session privée' }),
    ).toBeVisible()
    expect(await this.#page.evaluate(() => localStorage.getItem('honest-resume-locale'))).toBe('fr')
  }

  async expectVerifiedSourceProfileBuiltFromMinimizedContent() {
    this.#expectCompletedAction('source-profile-built')
    expect(this.#extractionRequestContent).toContain('Senior FullStack Developer using React at Acme')
    expect(this.#extractionRequestContent).not.toContain('bakate@example.com')
    expect(this.#extractionRequestContent).not.toContain('+33 6 12 34 56 78')
    await expect(this.#page.getByText('Senior FullStack Developer using React at Acme')).toBeVisible()
    await expect(this.#page.getByText('Verified', { exact: true })).toBeVisible()
  }

  async expectVerifiedSourceProfileToBeRestored() {
    this.#expectCompletedAction('source-profile-reloaded')
    await expect(this.#page.getByRole('heading', { name: 'Review extracted facts' })).toBeVisible()
    await expect(this.#page.getByText('Senior FullStack Developer using React at Acme')).toBeVisible()
    await expect(this.#page.getByText('Verified', { exact: true })).toBeVisible()
  }

  async expectAtomicJobRequirementsWithSourceProvenance() {
    this.#expectCompletedAction('job-requirements-extracted')
    expect(this.#jobPostingRequestContent).toBe(jobPostingExcerpt)
    expect(this.#jobPostingRequestContent).not.toContain('jobs@example.com')
    await expect(this.#page.getByText('Know TypeScript', { exact: true })).toBeVisible()
    await expect(this.#page.getByText('Required', { exact: true })).toBeVisible()
    await expect(this.#page.getByText('Know React', { exact: true })).toBeVisible()
    await expect(this.#page.getByText('Preferred', { exact: true })).toBeVisible()
    await expect(this.#page.getByText(jobPostingExcerpt).first()).toBeVisible()
  }

  async expectEvidenceBackedMatchScoreAndGapAnalysis() {
    this.#expectCompletedAction('match-analyzed')
    await expect(this.#page.getByText('33%', { exact: true })).toBeVisible()
    await expect(this.#page.getByText(/below 50%/)).toBeVisible()
    await expect(this.#page.getByRole('heading', {
      name: 'Covered Job Requirements and Match Evidence',
    })).toBeVisible()
    await expect(this.#page.getByText('Know React', { exact: true }).last()).toBeVisible()
    await expect(this.#page.getByRole('heading', {
      name: 'Uncovered required Job Requirements',
    })).toBeVisible()
    await expect(this.#page.getByText('Know TypeScript', { exact: true }).last()).toBeVisible()
  }

  async expectValidatedResumeClaimsWithoutFreeEditing() {
    this.#expectCompletedAction('resume-claims-generated')
    await expect(this.#page.getByText(
      'Built React applications at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByText(
      'Worked as a FullStack Developer at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByText(/Claims cannot be edited directly/).first()).toBeVisible()
  }

  async expectTailoredResumeToBeRestored() {
    this.#expectCompletedAction('resume-claims-reloaded')
    await expect(this.#page.getByText(
      'Built React applications at Acme',
      { exact: true },
    )).toBeVisible()
    await expect(this.#page.getByText(
      'Worked as a FullStack Developer at Acme',
      { exact: true },
    )).toBeVisible()
  }

  async expectPreviewAndPdfToUseTheSameRetainedClaims() {
    this.#expectCompletedAction('resume-pdf-downloaded')
    const preview = this.#page.frameLocator('iframe[title="Tailored Resume one-page preview"]')
    await expect(preview.getByText('Built React applications at Acme')).toBeVisible()
    await expect(preview.getByText('Worked as a FullStack Developer at Acme')).toBeVisible()
    await expect(this.#page.getByText(/After download, this PDF is under your control/))
      .toBeVisible()
    expect(readResumePdfClaimTexts(this.#resumePdfRequest)).toEqual([
      'Built React applications at Acme',
      'Worked as a FullStack Developer at Acme',
    ])
    expect(hasResumePdfPhoto(this.#resumePdfRequest)).toBe(false)
  }

  async expectFrenchSensitiveLabelAndIntactJobPosting() {
    this.#expectCompletedAction('job-posting-reviewed')
    await expect(this.#page.getByText('Numéro de téléphone', { exact: true })).toBeVisible()
    await expect(this.#page.getByText('phone', { exact: true })).toHaveCount(0)
    await expect(this.#page.getByLabel(
      "Contenu exact de l'Offre d'emploi envoyé pour l'extraction",
    )).toHaveValue(`${legitimateFrenchJobPosting}\nTéléphone : `)
  }

  #readUnknownRoute() {
    expect(this.#unknownRoute).toBeDefined()
    return this.#unknownRoute ?? '/missing-test-route'
  }

  #expectCompletedAction(expectedAction: CompletedAction) {
    expect(this.#completedAction).toBe(expectedAction)
  }

  #expectCandidateSessionInvalidationAction() {
    expect(
      this.#completedAction !== 'candidate-session-expired'
      && this.#completedAction !== 'candidate-session-synchronized',
    ).toBe(false)
  }
}

const lateResponseSession = {
  status: 'ready',
  sessionId: 'candidate-session-late-response',
  expiresAt: Date.now() + 60_000,
} as const

const inactiveSessionResult = {
  ok: false,
  error: { type: 'candidate-session-inactive' },
} as const

const inactiveSessionOutcome = {
  update: inactiveSessionResult,
  current: { ok: true, value: { status: 'not-started' } },
} as const

const legitimateFrenchJobPosting = "ASTORM bénéficie d'un référencement auprès de clients."

async function seedCandidateSession({ page, expiresAt }: Readonly<{ page: Page; expiresAt: number }>) {
  await installCandidateSessionTestPersistence(page)
  await page.evaluate(async ({ expirationTimestamp, sessionId }) => {
    const persistence = window.readInstalledPersistence()
    await persistence.create({ status: 'ready', sessionId, expiresAt: expirationTimestamp })
  }, { expirationTimestamp: expiresAt, sessionId: lateResponseSession.sessionId })
}

async function eraseCandidateSession(page: Page) {
  await installCandidateSessionTestPersistence(page)
  await page.evaluate(async (sessionId) => {
    await window.readInstalledPersistence().erase({ sessionId })
  }, lateResponseSession.sessionId)
}

async function updateCandidateSession(page: Page, state: typeof lateResponseSession) {
  await installCandidateSessionTestPersistence(page)
  return page.evaluate(async (session) => {
    const persistence = window.readInstalledPersistence()
    const update = await persistence.update({ sessionId: session.sessionId, state: session })
    return { update, current: await persistence.read() }
  }, state)
}

async function extendCandidateSessionExpiration(page: Page) {
  await installCandidateSessionTestPersistence(page)
  return page.evaluate(async (session) => {
    const persistence = window.readInstalledPersistence()
    const update = await persistence.update({
      sessionId: session.sessionId,
      state: { ...session, expiresAt: session.expiresAt + 60_000 },
    })
    const current = await persistence.read()
    return {
      update,
      currentExpiresAt: current.ok && current.value.status === 'ready'
        ? current.value.expiresAt
        : null,
    }
  }, lateResponseSession)
}

async function readBrowserStorage(page: Page) {
  await installCandidateSessionTestPersistence(page)
  const storedState = await page.evaluate(async () => window.readInstalledPersistence().read())
  expect(storedState.ok).toBe(true)
  if (!storedState.ok) return unavailableBrowserStorage
  expect(storedState.value.status).toBe('ready')
  if (storedState.value.status !== 'ready') return unavailableBrowserStorage

  return {
    localStorageLength: await page.evaluate(() => localStorage.length),
    remainingLifetime: storedState.value.expiresAt - Date.now(),
    sessionId: storedState.value.sessionId,
  }
}

const unavailableBrowserStorage = {
  localStorageLength: -1,
  remainingLifetime: -1,
  sessionId: 'candidate-session-unavailable',
} as const

async function installCandidateSessionTestPersistence(page: Page) {
  await page.addScriptTag({
    type: 'module',
    content: `
      import { createBrowserCandidateSessionPersistence } from '/src/resume-tailoring/browser-adapters.ts'
      window.candidateSessionTestPersistence = createBrowserCandidateSessionPersistence()
      window.readInstalledPersistence = () => window.candidateSessionTestPersistence
    `,
  })
  await page.waitForFunction(() => window.candidateSessionTestPersistence !== undefined)
}

async function waitForStartTailoringToBeEnabled(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector<HTMLButtonElement>('.primary-action')
    return button?.disabled === false
  })
}

function readProfessionalContent(requestBody: string | null) {
  if (requestBody === null) return undefined
  const value = JSON.parse(requestBody) as unknown
  return isRecord(value) && typeof value.professionalContent === 'string'
    ? value.professionalContent
    : undefined
}

function readJobPostingContent(requestBody: string | null) {
  if (requestBody === null) return undefined
  const value = JSON.parse(requestBody) as unknown
  return isRecord(value) && typeof value.jobPostingContent === 'string'
    ? value.jobPostingContent
    : undefined
}

function readMatchRequest(requestBody: string | null) {
  if (requestBody === null) return undefined
  const value = JSON.parse(requestBody) as unknown
  const result = matchAnalysisRequestSchema.safeParse(value)
  return result.success ? result.data : undefined
}

function readResumePdfClaimTexts(value: unknown) {
  if (!isRecord(value) || !isRecord(value.document) || !Array.isArray(value.document.items)) {
    return []
  }
  return value.document.items.flatMap((item) =>
    isRecord(item) && typeof item.text === 'string' ? [item.text] : [])
}

function hasResumePdfPhoto(value: unknown) {
  return isRecord(value) && 'photoDataUrl' in value
}

const jobPostingExcerpt = 'You must know TypeScript and preferably React.'
const jobRequirementExtractionResponse = {
  ok: true,
  value: [
    {
      classification: 'required',
      sourceExcerpt: jobPostingExcerpt,
      value: 'Know TypeScript',
    },
    {
      classification: 'preferred',
      sourceExcerpt: jobPostingExcerpt,
      value: 'Know React',
    },
  ],
} as const

function createTextPdf(text: string) {
  const escapedText = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')
  const content = `BT /F1 12 Tf 72 720 Td (${escapedText}) Tj ET`
  const document = appendPdfObjects({ objects: createPdfObjects({ content }) })
  const crossReferenceOffset = Buffer.byteLength(document.pdf, 'ascii')
  const entries = document.offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  const trailer = `xref\n0 6\n0000000000 65535 f \n${entries}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${String(crossReferenceOffset)}\n%%EOF`
  return Buffer.from(`${document.pdf}${trailer}`, 'ascii')
}

function createPdfObjects({ content }: Readonly<{ content: string }>) {
  return [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
}

function appendPdfObjects({ objects }: Readonly<{ objects: readonly string[] }>) {
  return objects.reduce((document, object, objectIndex) => ({
    offsets: [...document.offsets, Buffer.byteLength(document.pdf, 'ascii')],
    pdf: `${document.pdf}${String(objectIndex + 1)} 0 obj\n${object}\nendobj\n`,
  }), { offsets: [] as readonly number[], pdf: '%PDF-1.4\n' })
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null
}
