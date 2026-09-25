import { expect, test } from '@playwright/test'

test('homepage loads and displays main content', async ({ page }) => {
  await page.goto('/')
  // 1 h1 (hero) + 4 h2 (audience, features, how-it-works, closing) - pricing
  // moved to its own /solution page, dropping this from 6 to 5.
  await expect(page.locator('h1, h2')).toHaveCount(5, { timeout: 5000 })
  // Adjust selector and text as needed for your homepage
})

test('solution page loads and displays pricing content', async ({ page }) => {
  await page.goto('/solution')
  await expect(page.locator('h1, h2')).toHaveCount(1, { timeout: 5000 })
})
