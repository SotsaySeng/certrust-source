/**
 * The public "Developers" menu and the integration manuals behind it.
 * No sign-in: a prospect or an institution's IT team must be able to read
 * every manual and fetch the downloads.
 */
import { expect, test } from '@playwright/test'
import { waitForHydration } from './support/journey'

const MANUALS = [
  { label: 'Integrations overview', path: '/integrations', heading: 'Issue credentials from the systems you already use' },
  { label: 'Google Sheets', path: '/integrations/google-sheets', heading: 'Add a row, issue a certificate' },
  { label: 'Google Forms', path: '/integrations/google-forms', heading: 'Submit a form, receive a certificate' },
  { label: 'Universities and colleges', path: '/integrations/student-records', heading: 'Connect your student records system' },
  { label: 'API guide', path: '/integrations/guide', heading: 'Connect your systems to Certrust' },
]

test.describe('developers menu and integration manuals', () => {
  test('a signed-out visitor reaches every manual from the Developers menu', async ({ page }) => {
    for (const manual of MANUALS) {
      await page.goto('/')
      await waitForHydration(page)
      await page.getByTestId('developers-menu-button').click()
      await page.locator('#developers-menu-panel').getByRole('link', { name: manual.label, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${manual.path}$`))
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(manual.heading)
    }
  })

  test('the homepage shows the integrations section and its cards lead to the manuals', async ({ page }) => {
    await page.goto('/')
    await waitForHydration(page)
    const section = page.getByTestId('home-integrations')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByRole('heading', { level: 2 })).toBeVisible()
    const cards = section.getByTestId('home-integration')
    await expect(cards).toHaveCount(4)
    // The cards fade in when scrolled into view; they must end up fully shown.
    for (let i = 0; i < 4; i++) {
      await expect(cards.nth(i)).toHaveCSS('opacity', '1', { timeout: 10000 })
    }
    expect(await cards.evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual([
      '/integrations/google-sheets',
      '/integrations/google-forms',
      '/integrations/student-records',
      '/integrations/guide',
    ])
    if (process.env.E2E_SCREENSHOT_DIR) {
      await section.screenshot({ path: `${process.env.E2E_SCREENSHOT_DIR}/home-integrations.png` })
    }
    await cards.first().click()
    await expect(page).toHaveURL(/\/integrations\/google-sheets$/)
  })

  test('the overview links to all four manuals', async ({ page }) => {
    await page.goto('/integrations')
    const cards = page.getByTestId('manual-card')
    await expect(cards).toHaveCount(4)
    expect(await cards.evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual([
      '/integrations/google-sheets',
      '/integrations/google-forms',
      '/integrations/student-records',
      '/integrations/guide',
    ])
  })

  test('the Google Sheets script and the sync example can be downloaded', async ({ request }) => {
    const script = await request.get('/downloads/certrust-google-sheets.gs')
    expect(script.status()).toBe(200)
    expect(await script.text()).toContain('function onOpen()')

    const example = await request.get('/downloads/certrust-sync-example.py')
    expect(example.status()).toBe(200)
    expect(await example.text()).toContain('/api/issuance-jobs')
  })

  test('the Copy the script button copies the whole script', async ({ page }) => {
    // Stubbed: reading the real clipboard would return whatever the person
    // running the suite last copied.
    await page.addInitScript(() => {
      (window as any).__copied = null
      navigator.clipboard.writeText = async (text: string) => {
        (window as any).__copied = text
      }
    })
    await page.goto('/integrations/google-sheets')
    await waitForHydration(page)
    await page.getByTestId('copy-script').click()
    await expect(page.getByTestId('copy-script')).toHaveText('Copied')
    expect(await page.evaluate(() => (window as any).__copied)).toContain('Certrust for Google Sheets')
  })
})
