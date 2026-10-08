import { expect, test as base } from '@playwright/test'

declare global {
  interface Window {
    reportContentSecurityPolicyViolation?: (violation: string) => void
  }
}

/**
 * Every page, and every frame it opens, reports what the Content-Security-Policy blocked. A test passes only when the
 * whole journey it drives ran without a single violation.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = []
    await page.exposeFunction('reportContentSecurityPolicyViolation', (violation: string) => { violations.push(violation) })
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        window.reportContentSecurityPolicyViolation?.(
          `${event.effectiveDirective} blocked ${event.blockedURI || 'inline'} in ${event.documentURI} from ${event.sourceFile}:${String(event.lineNumber)}`)
      })
    })
    await use(page)
    expect(violations, 'The Content-Security-Policy blocked part of the page').toEqual([])
  },
})

export { expect }
