import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe('Candidate Journey', () => {
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
})

function createSystemUnderTest({ page }: Readonly<{ page: Page }>) {
  return new CandidateJourneyTestSystem(page)
}

class CandidateJourneyTestSystem {
  readonly #page: Page
  #completedAction: CandidateJourneyAction | null = null

  constructor(page: Page) {
    this.#page = page
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
  | 'candidate-journey-opened'
  | 'candidate-session-deleted'
  | 'candidate-session-restored'
  | 'candidate-session-started'
  | 'critical-ambiguity-answered'
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
    skills: [{ category: 'Programming language', name: 'TypeScript' }],
  },
} as const

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
