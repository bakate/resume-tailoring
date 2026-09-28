import { defineConfig, devices } from '@playwright/test'

const testPort = process.env.PLAYWRIGHT_TEST_PORT ?? '3000'
const testBaseUrl = `http://127.0.0.1:${testPort}`

export default defineConfig({
  testDir: './test',
  use: {
    baseURL: testBaseUrl,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `pnpm exec vite dev --host 127.0.0.1 --port ${testPort}`,
    reuseExistingServer: true,
    url: testBaseUrl,
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: devices['Desktop Chrome'],
    },
    {
      name: 'chromium-mobile',
      use: devices['Pixel 7'],
    },
    {
      name: 'firefox-desktop',
      use: devices['Desktop Firefox'],
    },
    {
      name: 'webkit-desktop',
      use: devices['Desktop Safari'],
    },
    {
      name: 'webkit-mobile',
      use: {
        ...devices['iPhone 13'],
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      },
    },
  ],
})
