/**
 * Privacy and trust safeguards on the public verification page, through the
 * real UI:
 *   the issuer signs in (HttpOnly session cookie, nothing in localStorage) ->
 *   makes a credential private -> an anonymous visitor sees only that a valid
 *   credential exists -> public again -> the visitor reports the credential
 *   through "Report this credential" -> the issuer signs out.
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
  sql,
  tokenFor,
  waitForHydration,
} from './support/journey'

const RUN_ID = Date.now().toString(36)
const ORG = {
  username: `pwprivacy${RUN_ID}`,
  email: `pwprivacy${RUN_ID}@certrust.test`,
  password: 'Playwright#Privacy2026',
  organizationName: `Privacy Academy ${RUN_ID}`,
}
const RECIPIENT = { name: 'Rosalind Franklin', email: `rosalind.${RUN_ID}@recipient.test` }
const ACHIEVEMENT = `Crystallography ${RUN_ID}`

let credentialPath = ''

test.describe.configure({ mode: 'serial' })

test.describe('credential privacy and reporting', () => {
  test('an issuer signs up and signs in with a cookie session only', async ({ page }) => {
    await registerOrganisation(page, ORG)
    await confirmEmail(page, ORG.email)
    await signIn(page, ORG.email, ORG.password)

    const jwt = await tokenFor(page) // also asserts nothing is in localStorage
    const auth = { Authorization: `Bearer ${jwt}` }
    const me = await (await page.request.get(`${API}/api/profiles/me`, { headers: auth })).json()
    const profile = Array.isArray(me.data) ? me.data[0] : me.data

    const created = await page.request.post(`${API}/api/achievements`, {
      headers: auth,
      data: { data: { name: ACHIEVEMENT, description: 'X-ray diffraction', templateType: 'certificate', achievementType: 'Certificate', achievementId: `crystal-${RUN_ID}`, criteria: { narrative: 'Completed the lab' }, creator: profile.id, publishedAt: new Date().toISOString() } },
    })
    expect(created.ok()).toBeTruthy()
    const achievementId = (await created.json()).data.id

    const issued = await page.request.post(`${API}/api/credentials/batch-issue`, {
      headers: auth,
      data: { data: { achievementId, recipients: [RECIPIENT] } },
    })
    expect(issued.ok()).toBeTruthy()
    const credentialId = (await issued.json()).results[0].data.credential.credentialId
    credentialPath = `/credentials/${encodeURIComponent(credentialId)}`
  })

  test('the issuer makes the credential private from its page', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await page.goto(credentialPath)
    await waitForHydration(page)

    const control = page.getByTestId('credential-privacy-control')
    await expect(control).toContainText('This credential is public', { timeout: 20000 })
    await control.getByRole('button', { name: 'Make private' }).click()
    await expect(control).toContainText('This credential is private', { timeout: 20000 })
    // The owner still sees everything.
    await expect(page.getByText(RECIPIENT.name).first()).toBeVisible()
  })

  test('an anonymous visitor sees only that a valid credential exists', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const response = await page.goto(credentialPath)
    expect(response?.headers()['x-robots-tag']).toContain('noindex')
    await waitForHydration(page)

    await expect(page.getByTestId('credential-private-notice')).toContainText(`A valid credential was issued by ${ORG.organizationName}`, { timeout: 20000 })
    await expect(page.getByRole('note', { name: 'What this verification means' })).toContainText('does not confirm that the holder met the underlying requirements')
    await expect(page.getByText(RECIPIENT.name)).toHaveCount(0)
    await expect(page.getByText(ACHIEVEMENT)).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Add this certificate to your LinkedIn profile/ })).toHaveCount(0)
    expect(await page.content()).not.toContain(RECIPIENT.email)
    await context.close()
  })

  test('public again: the visitor sees the credential, and can report it', async ({ page, browser }) => {
    await signIn(page, ORG.email, ORG.password)
    await page.goto(credentialPath)
    await waitForHydration(page)
    const control = page.getByTestId('credential-privacy-control')
    await control.getByRole('button', { name: 'Make public' }).click({ timeout: 20000 })
    await expect(control).toContainText('This credential is public', { timeout: 20000 })

    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(credentialPath)
    await waitForHydration(visitor)
    await expect(visitor.getByText(RECIPIENT.name).first()).toBeVisible({ timeout: 20000 })
    expect(await visitor.content()).not.toContain(RECIPIENT.email)

    await visitor.getByRole('link', { name: 'Report this credential' }).click()
    await expect(visitor).toHaveURL(/\/report\?target=/, { timeout: 20000 })
    await waitForHydration(visitor)
    expect(await visitor.locator('#targetUrl').inputValue()).toContain(credentialPath)
    await visitor.locator('#category').selectOption('impersonation')
    await visitor.locator('#details').fill(`${ORG.organizationName} is not the institution it claims to be (${RUN_ID}).`)
    await visitor.locator('#reporterEmail').fill(`reporter.${RUN_ID}@example.org`)
    await visitor.getByRole('button', { name: 'Send report' }).click()
    await expect(visitor.getByRole('status')).toContainText('we have received your report', { timeout: 20000 })
    await context.close()

    expect(sql(`select category from reports where reporter_email='reporter.${RUN_ID}@example.org';`)).toBe('impersonation')
  })

  test('the issuer asks to be verified, and a platform admin approves it', async ({ page, browser }) => {
    await signIn(page, ORG.email, ORG.password)
    await page.goto('/profile')
    await waitForHydration(page)
    const panel = page.getByTestId('issuer-verification')
    await expect(panel).toBeVisible({ timeout: 20000 })
    await panel.locator('#verification-domain').fill('https://www.certrust.test/')
    await panel.getByRole('button', { name: 'Request' }).click()
    await expect(panel).toContainText('Request received for certrust.test', { timeout: 20000 })
    await expect(panel).toContainText('Your sign-up email is on this domain')

    // Promote the issuer to Platform Admin (Strapi admin does this in production).
    const roleId = sql(`select id from up_roles where type='platform-admin';`)
    const userId = sql(`select id from up_users where email='${ORG.email}';`)
    sql(`update up_users_role_lnk set role_id=${roleId} where user_id=${userId};`)

    const admin = await browser.newContext()
    const adminPage = await admin.newPage()
    await signIn(adminPage, ORG.email, ORG.password)
    await adminPage.goto('/admin/trust')
    await waitForHydration(adminPage)
    const card = adminPage.getByTestId('trust-org').filter({ hasText: ORG.organizationName })
    await expect(card).toContainText('pending', { timeout: 20000 })
    await card.getByRole('button', { name: 'Verify' }).click()
    await expect(card).toContainText('verified', { timeout: 20000 })
    await expect(adminPage.getByTestId('trust-report').filter({ hasText: RUN_ID })).toContainText('impersonation')
    await admin.close()

    const context = await browser.newContext()
    const visitor = await context.newPage()
    await visitor.goto(credentialPath)
    await waitForHydration(visitor)
    await expect(visitor.getByRole('note', { name: 'What this verification means' })).toContainText('Verified issuer', { timeout: 20000 })
    await context.close()
  })

  test('signing out ends the cookie session', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    expect((await page.context().cookies(API)).some(c => c.name === 'certrust_jwt' && c.httpOnly)).toBe(true)

    await page.getByRole('button', { name: ORG.username }).first().click()
    await page.getByRole('button', { name: 'Sign out' }).first().click()

    await expect.poll(async () => (await page.context().cookies(API)).find(c => c.name === 'certrust_jwt')?.value ?? '', { timeout: 20000 }).toBe('')
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 })
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => /token|jwt/i.test(k)))).toEqual([])
  })
})
