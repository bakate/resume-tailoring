import { defineConfig, devices } from '@playwright/test'

import { sourceDocumentBrowserSupportPolicy } from './src/resume-tailoring/source-document-browser-support'

const testPort = process.env.PLAYWRIGHT_TEST_PORT ?? '3000'
const testBaseUrl = `http://127.0.0.1:${testPort}`
const legacyTestPort = String(Number(testPort) + 1)
const legacyTestBaseUrl = `http://127.0.0.1:${legacyTestPort}`
const sourceDocumentCompatibilityTests = /French unreadable PDF|French browser compatibility|an unreadable PDF|recovers from an unreadable PDF|builds a Verified Source Profile from minimized PDF content|imports a valid PDF/

export default defineConfig({
  testDir: './test',
  use: {
    baseURL: testBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `pnpm exec vite dev --host 127.0.0.1 --port ${testPort}`,
      reuseExistingServer: true,
      url: testBaseUrl,
    },
    {
      command: `VITE_CANDIDATE_JOURNEY_RELEASE=legacy pnpm exec vite dev --host 127.0.0.1 --port ${legacyTestPort}`,
      reuseExistingServer: true,
      url: legacyTestBaseUrl,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testMatch: 'candidate-journey.smoke.test.ts',
      use: devices['Desktop Chrome'],
    },
    {
      name: 'legacy-chromium',
      testMatch: 'resume-tailoring.smoke.test.ts',
      use: { ...devices['Desktop Chrome'], baseURL: legacyTestBaseUrl },
    },
    {
      name: 'chromium-desktop',
      grep: sourceDocumentCompatibilityTests,
      testMatch: 'resume-tailoring.smoke.test.ts',
      use: { ...devices['Desktop Chrome'], baseURL: legacyTestBaseUrl },
    },
    {
      name: 'chromium-mobile',
      grep: sourceDocumentCompatibilityTests,
      testMatch: 'resume-tailoring.smoke.test.ts',
      use: { ...devices['Pixel 7'], baseURL: legacyTestBaseUrl },
    },
    {
      name: 'firefox-desktop',
      grep: sourceDocumentCompatibilityTests,
      testMatch: 'resume-tailoring.smoke.test.ts',
      use: { ...devices['Desktop Firefox'], baseURL: legacyTestBaseUrl },
    },
    {
      name: 'firefox-mobile',
      grep: sourceDocumentCompatibilityTests,
      testMatch: 'resume-tailoring.smoke.test.ts',
      use: {
        ...devices['Pixel 7'],
        baseURL: legacyTestBaseUrl,
        browserName: 'firefox',
        userAgent: `Mozilla/5.0 (Android 14; Mobile; rv:${String(sourceDocumentBrowserSupportPolicy.matrix.firefox.minimumMajorVersion)}.0) Gecko/${String(sourceDocumentBrowserSupportPolicy.matrix.firefox.minimumMajorVersion)}.0 Firefox/${String(sourceDocumentBrowserSupportPolicy.matrix.firefox.minimumMajorVersion)}.0`,
      },
    },
    {
      name: 'webkit-desktop',
      grep: sourceDocumentCompatibilityTests,
      testMatch: 'resume-tailoring.smoke.test.ts',
      use: { ...devices['Desktop Safari'], baseURL: legacyTestBaseUrl },
    },
    {
      name: 'webkit-mobile',
      grep: sourceDocumentCompatibilityTests,
      testMatch: 'resume-tailoring.smoke.test.ts',
      use: {
        ...devices['iPhone 13'],
        baseURL: legacyTestBaseUrl,
        userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${String(sourceDocumentBrowserSupportPolicy.matrix.webkit.minimumMajorVersion)}_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${String(sourceDocumentBrowserSupportPolicy.matrix.webkit.minimumMajorVersion)}.0 Mobile/15E148 Safari/604.1`,
      },
    },
  ],
})
