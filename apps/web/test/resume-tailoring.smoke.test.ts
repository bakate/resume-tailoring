import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test('a Candidate can open the Resume Tailoring workflow', async ({ page }) => {
  const system = createSystemUnderTest({ page })

  system.givenResumeTailoringIsAvailable()

  await system.openResumeTailoring()

  await system.expectResumeTailoringToBeReady()
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

function createSystemUnderTest({ page }: Readonly<{ page: Page }>) {
  let unknownRoute: string | undefined
  let completedAction:
    | 'resume-tailoring-opened'
    | 'resume-tailoring-viewed'
    | 'unknown-page-opened'
    | undefined

  return {
    givenResumeTailoringIsAvailable() {},
    givenUnknownRoute(route: string) {
      unknownRoute = route
    },
    async openResumeTailoring() {
      await page.goto('/')
      await page.getByRole('button', { name: 'Start tailoring' }).click()
      completedAction = 'resume-tailoring-opened'
    },
    async openUnknownPage() {
      await page.goto(readUnknownRoute())
      completedAction = 'unknown-page-opened'
    },
    async viewResumeTailoring() {
      await page.goto('/')
      completedAction = 'resume-tailoring-viewed'
    },
    async expectResumeTailoringToBeReady() {
      expectCompletedAction('resume-tailoring-opened')
      await expect(page.getByText('Workflow opened')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Start tailoring' })).toBeDisabled()
    },
    async expectPageNotFoundWithWorkflowLink() {
      expectCompletedAction('unknown-page-opened')
      await expect(page).toHaveTitle('Honest Resume')
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Return to the workflow' })).toHaveAttribute(
        'href',
        '/',
      )
    },
    async expectCandidateContentRetentionExplained() {
      expectCompletedAction('resume-tailoring-viewed')
      await expect(
        page.getByText(
          'Candidate content you add stays in this browser and expires locally after 24 hours.',
        ),
      ).toBeVisible()
    },
  }

  function readUnknownRoute() {
    if (unknownRoute === undefined) {
      throw new Error('Record an unknown route before opening it')
    }

    return unknownRoute
  }

  function expectCompletedAction(expectedAction: typeof completedAction) {
    if (completedAction !== expectedAction) {
      throw new Error(`Run ${expectedAction ?? 'the expected action'} before reading its outcome`)
    }
  }
}
