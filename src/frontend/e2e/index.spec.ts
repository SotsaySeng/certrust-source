import { expect, test } from '@playwright/test'

test('homepage loads and displays main content', async ({ page }) => {
  await page.goto('/')
  // 1 h1 (hero) + 5 h2 (audience, features, how-it-works, integrations,
  // closing). Pricing lives on its own /solution page.
  await expect(page.locator('h1, h2')).toHaveCount(6, { timeout: 5000 })
  // Adjust selector and text as needed for your homepage
})

test('solution page loads and displays pricing content', async ({ page }) => {
  await page.goto('/solution')
  await expect(page.locator('h1, h2')).toHaveCount(1, { timeout: 5000 })
})
