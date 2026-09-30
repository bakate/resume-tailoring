import { defineConfig, devices } from '@playwright/test'

const testPort = process.env.PLAYWRIGHT_TEST_PORT ?? '3000'
const testBaseUrl = `http://127.0.0.1:${testPort}`

export default defineConfig({
  testDir: './test',
  use: {
    baseURL: testBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: `VITE_E2E=1 pnpm exec vite dev --host 127.0.0.1 --port ${testPort}`,
      reuseExistingServer: true,
      url: testBaseUrl,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testMatch: ['candidate-journey.smoke.test.ts', 'candidate-journey.integration.test.ts'],
      use: devices['Desktop Chrome'],
    },
    {
      name: 'chromium-desktop',
      testMatch: 'candidate-journey.smoke.test.ts',
      use: devices['Desktop Chrome'],
    },
    {
      name: 'chromium-mobile',
      testMatch: 'candidate-journey.smoke.test.ts',
      use: devices['Pixel 7'],
    },
    {
      name: 'firefox-desktop',
      testMatch: 'candidate-journey.smoke.test.ts',
      use: devices['Desktop Firefox'],
    },
    {
      name: 'firefox-mobile',
      testMatch: 'candidate-journey.smoke.test.ts',
      use: { ...devices['Pixel 7'], browserName: 'firefox' },
    },
    {
      name: 'webkit-desktop',
      testMatch: 'candidate-journey.smoke.test.ts',
      use: devices['Desktop Safari'],
    },
    {
      name: 'webkit-mobile',
      testMatch: 'candidate-journey.smoke.test.ts',
      use: devices['iPhone 13'],
    },
  ],
})
