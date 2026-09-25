// Local-run config for the end-to-end journey specs.
//
//  - channel 'chrome': this machine has Playwright 1.53.1 but not its
//    matching headless_shell binary, so use the installed Google Chrome.
//    (`npx playwright install chromium` would remove the need for this file.)
//  - headed, so the run can be watched.
//  - PW_SLOWMO=<ms> to slow it down enough to follow along, e.g.
//      PW_SLOWMO=800 npx playwright test --config=playwright.local.config.ts
import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const slowMo = Number(process.env.PW_SLOWMO || 220)

export default defineConfig({
  ...base,
  timeout: slowMo > 400 ? 300_000 : 90_000,
  projects: [{
    name: 'chromium',
    use: {
      ...base.projects![0].use,
      channel: 'chrome',
      headless: false,
      launchOptions: { slowMo, args: ['--window-position=40,40'] },
      viewport: { width: 1280, height: 900 }
    }
  }]
})
