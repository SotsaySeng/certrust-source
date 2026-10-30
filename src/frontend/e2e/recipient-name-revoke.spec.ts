/**
 * The same email issued under two names keeps each name on its own
 * credential, and the issuer can revoke the wrong one from the dashboard.
 *
 * Runs against the local stack like credential-lifecycle.spec.ts, with the
 * dev mail catcher on. Namespaced by RUN_ID, so it is re-runnable.
 */

import { expect, test } from '@playwright/test'
import {
  API,
  confirmEmail,
  registerOrganisation,
  signIn,
  tokenFor,
  waitForHydration,
} from './support/journey'

const RUN_ID = Date.now().toString(36)
const ORG = {
  username: `pwrevoke${RUN_ID}`,
  email: `pwrevoke${RUN_ID}@certrust.test`,
  password: 'Playwright#Revoke2026',
  organizationName: `Revoke Academy ${RUN_ID}`,
}
const EMAIL = `sanga.${RUN_ID}@recipient.test`
const WRONG = 'Sanga Mispelt'
const RIGHT = 'Sanga Corrected'

const credentialIds = new Map<string, string>()

test.describe.configure({ mode: 'serial' })

test.describe('recipient name and revoking', () => {
  test('one email issued under two names keeps both names', async ({ page }) => {
    await registerOrganisation(page, ORG)
    await confirmEmail(page, ORG.email)
    await signIn(page, ORG.email, ORG.password)

    const auth = { Authorization: `Bearer ${await tokenFor(page)}` }
    const me = await (await page.request.get(`${API}/api/profiles/me`, { headers: auth })).json()
    const profile = Array.isArray(me.data) ? me.data[0] : me.data
    const created = await page.request.post(`${API}/api/achievements`, {
      headers: auth,
      data: { data: { name: `TETL ${RUN_ID}`, description: 'Course', templateType: 'certificate', achievementType: 'Certificate', achievementId: `tetl-${RUN_ID}`, criteria: { narrative: 'Completed' }, creator: profile.id, publishedAt: new Date().toISOString() } },
    })
    expect(created.ok()).toBeTruthy()
    const achievementId = (await created.json()).data.id

    for (const name of [WRONG, RIGHT]) {
      const issued = await page.request.post(`${API}/api/credentials/batch-issue`, {
        headers: auth,
        data: { data: { achievementId, recipients: [{ name, email: EMAIL }] } },
      })
      expect(issued.ok()).toBeTruthy()
      credentialIds.set(name, (await issued.json()).results[0].data.credential.credentialId)
    }

    // Anyone verifying sees the name on that credential.
    for (const name of [WRONG, RIGHT]) {
      const context = await page.context().browser()!.newContext()
      const visitor = await context.newPage()
      await visitor.goto(`/credentials/${encodeURIComponent(credentialIds.get(name)!)}`)
      await waitForHydration(visitor)
      await expect(visitor.getByText(name).first()).toBeVisible({ timeout: 20000 })
      await context.close()
    }
  })

  test('the issuer revokes the wrong one from the dashboard', async ({ page, browser }) => {
    await signIn(page, ORG.email, ORG.password)
    await page.goto('/dashboard')
    await waitForHydration(page)

    const wrongRow = page.getByTestId('issued-row').filter({ hasText: WRONG })
    const rightRow = page.getByTestId('issued-row').filter({ hasText: RIGHT })
    await expect(wrongRow).toBeVisible({ timeout: 20000 })
    await expect(rightRow).toBeVisible()

    // Cancelling changes nothing.
    await wrongRow.getByTestId('revoke-credential').click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(wrongRow).toContainText('Active')
    await wrongRow.getByTestId('revoke-credential').click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('revoke-reason')).toHaveCount(0)

    await wrongRow.getByTestId('revoke-credential').click()
    await page.getByTestId('revoke-reason').fill('Name misspelled')
    await page.getByTestId('revoke-confirm').click()

    await expect(wrongRow).toContainText('Revoked', { timeout: 20000 })
    await expect(wrongRow.getByTestId('revoke-credential')).toHaveCount(0)
    await expect(rightRow).toContainText('Active')

    // The change is saved, not just shown.
    await page.reload()
    await waitForHydration(page)
    await expect(wrongRow).toContainText('Revoked', { timeout: 20000 })
    await expect(rightRow).toContainText('Active')

    const context = await browser.newContext()
    const anonymous = await context.request.post(`${API}/api/credentials/${encodeURIComponent(credentialIds.get(RIGHT)!)}/revoke`, { data: { reason: 'no' } })
    expect(anonymous.ok()).toBeFalsy()
    await context.close()
  })
})
