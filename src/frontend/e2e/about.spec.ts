import { expect, test } from '@playwright/test'

test('about page loads and displays content', async ({ page }) => {
  await page.goto('/about')
  await expect(page.locator('h1, h2')).toHaveCount(7, { timeout: 5000 })
  await expect(page.locator('text=About').first()).toBeVisible()
})

test('about page names the operator and links the AGPL source', async ({ page }) => {
  // Legal requirements: keep these through any copy rewrite.
  await page.goto('/about')
  const legal = page.getByTestId('about-legal')
  await expect(legal).toContainText('Certrust is operated by')
  await expect(legal).toContainText('Auckland, New Zealand')
  await expect(legal.getByRole('link', { name: 'source code of the version running here' })).toHaveAttribute('href', 'https://github.com/SotsaySeng/certrust-source')
})
