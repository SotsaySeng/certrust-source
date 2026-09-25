import type { ConfigOptions } from '@nuxt/test-utils/playwright'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// E2E_BASE_URL: run against a frontend on another port (e.g. when 3000 is
// taken by another dev server). Pair with E2E_API_URL in e2e/support/journey.ts.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'

export default defineConfig<ConfigOptions>({
  testDir: './e2e',
  use: {
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url))
    },
    baseURL
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
  ]
})
