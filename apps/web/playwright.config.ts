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
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
  ],
})
