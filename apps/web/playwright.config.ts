import { defineConfig, devices } from '@playwright/test'

const testPort = process.env.PLAYWRIGHT_TEST_PORT ?? '3000'
const testBaseUrl = `http://127.0.0.1:${testPort}`

export default defineConfig({
  testDir: './test',
  // Each test opens its own browser context, so tests of one file can share the workers.
  fullyParallel: true,
  use: {
    baseURL: testBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // The production build serves a few bundles where the dev server transforms every module on each page
      // load, which nearly halves the suite's run time and tests what is deployed.
      command: `pnpm exec vite build && HOST=127.0.0.1 PORT=${testPort} node .output/server/index.mjs`,
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
