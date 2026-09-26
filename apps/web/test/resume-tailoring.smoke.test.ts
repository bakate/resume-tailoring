import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { CandidateSessionPersistence } from '@resume-tailoring/application/resume-tailoring-workflow-ports'

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

function createSystemUnderTest({ page }: Readonly<{ page: Page }>) {
  return new ResumeTailoringBrowserTestSystem(page)
}

type CompletedAction =
  | 'candidate-session-expired'
  | 'candidate-session-reloaded'
  | 'candidate-session-response-applied'
  | 'candidate-session-synchronized'
  | 'expiration-extension-attempted'
  | 'resume-tailoring-opened'
  | 'resume-tailoring-viewed'
  | 'unknown-page-opened'

class ResumeTailoringBrowserTestSystem {
  readonly #page: Page
  #completedAction: CompletedAction | undefined
  #lateResponseOutcome: unknown
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
    await expect(this.#page.getByRole('button', { name: 'Start tailoring' })).toBeDisabled()
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
      this.#page.getByRole('button', { name: 'Commencer à adapter mon CV' }),
    ).toBeDisabled()
    expect(await this.#page.evaluate(() => localStorage.getItem('honest-resume-locale'))).toBe('fr')
  }

  #readUnknownRoute() {
    if (this.#unknownRoute === undefined) throw new Error('Record an unknown route before opening it')
    return this.#unknownRoute
  }

  #expectCompletedAction(expectedAction: CompletedAction) {
    if (this.#completedAction !== expectedAction) {
      throw new Error(`Run ${expectedAction} before reading its outcome`)
    }
  }

  #expectCandidateSessionInvalidationAction() {
    if (
      this.#completedAction !== 'candidate-session-expired'
      && this.#completedAction !== 'candidate-session-synchronized'
    ) {
      throw new Error('Delete or expire the Candidate session before reading its outcome')
    }
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
  if (!storedState.ok || storedState.value.status !== 'ready') {
    throw new Error('Expected an active Candidate session in IndexedDB')
  }

  return {
    localStorageLength: await page.evaluate(() => localStorage.length),
    remainingLifetime: storedState.value.expiresAt - Date.now(),
    sessionId: storedState.value.sessionId,
  }
}

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
