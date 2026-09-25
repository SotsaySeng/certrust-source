/**
 * Full new-organisation journey, end to end, through the real UI.
 *
 * Covers the whole self-service path a brand-new business takes:
 *   register -> email confirmation gate -> confirm -> sign in ->
 *   dashboard (free tier) -> design templates -> events -> issue page,
 *   plus the multi-tenant isolation guarantees that back all of it.
 *
 * Runs against the live local dev stack (Nuxt :3000 + Strapi :1337 with
 * the sqlite dev DB). Every account it creates is namespaced by RUN_ID,
 * so the spec is safely re-runnable without cleanup.
 *
 * Email confirmation: the test clicks the link out of the REAL confirmation
 * email. With DEV_MAIL_CATCHER=true the backend catches its own outgoing mail
 * (src/bootstrap/dev-mail-catcher.ts) and indexes it at
 * src/backend/.tmp/mail/index.jsonl, which this spec reads by default; set
 * MAIL_SINK to point at a different JSONL inbox. If no caught mail is found
 * it falls back to the confirmation token in the dev sqlite DB, which
 * produces the identical URL.
 */

import { expect, test } from '@playwright/test'
import {
  API,
  checkBox,
  confirmationLinkFromInbox,
  fillField,
  gotoViaNav,
  MAIL_SINK,
  openManageMenu,
  selectOptionByLabel,
  signIn as signInAs,
  sql,
  tokenFor,
  waitForHydration,
} from './support/journey'

const RUN_ID = Date.now().toString(36)
const ORG_NAME = `Playwright Test Org ${RUN_ID}`
const ORG_TYPE_LABEL = 'Educational'
const USERNAME = `pwadmin${RUN_ID}`
const EMAIL = `pwadmin${RUN_ID}@certrust.test`
const PASSWORD = 'Playwright#Org2026'
const [TRIAL_DAYS, TRIAL_REQUIRES_CARD, TRIAL_TIER] = (sql(`select trial_days, trial_requires_card, trial_tier from billing_settings limit 1;`) || '0|1|pro').split('|')
const EXPECTED_TIER = Number(TRIAL_DAYS) > 0 && TRIAL_REQUIRES_CARD !== '1' ? TRIAL_TIER : 'free'

const TEMPLATE_NAME = `PW Completion Certificate ${RUN_ID}`
const EVENT_NAME = `PW Graduation Ceremony ${RUN_ID}`

/** Templates/events belonging to OTHER organisations - must never leak into this org's UI. */
const FOREIGN_TEMPLATE_NAMES = ['Course Completion Badge', 'Python Fundamentals Badge', 'Meridian Certificate of Completion']
const FOREIGN_EVENT_NAME = 'Python Fundamentals — Cohort Graduation Ceremony'
/** Platform-curated global templates (organization: null) - every org is meant to see these. */
const GLOBAL_TEMPLATE_NAMES = ['Classic Certificate', 'Achievement Medal']

/** Token used by the JWT-scoped API isolation checks. */
let jwt = ''

test.describe.configure({ mode: 'serial' })

test.describe('new organisation: registration', () => {
  test('sign-up form creates the account, the organisation and the profile', async ({ page }) => {
    await page.goto('/register')

    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible()

    // Org-type options are fetched client-side from the public
    // /api/org-types endpoint, so their presence doubles as the signal
    // that the page has hydrated and is safe to type into.
    await expect(page.locator('#organizationType option', { hasText: ORG_TYPE_LABEL })).toHaveCount(1, { timeout: 20000 })

    await fillField(page, '#username', USERNAME)
    await fillField(page, '#email', EMAIL)
    await fillField(page, '#organizationName', ORG_NAME)
    await selectOptionByLabel(page, '#organizationType', ORG_TYPE_LABEL)
    await fillField(page, '#password', PASSWORD)
    await fillField(page, '#confirmPassword', PASSWORD)
    await checkBox(page, '#terms')

    await page.locator('button[type="submit"]').click()

    // Email confirmation is on, so registration returns no JWT: the page
    // must show the "check your email" panel, not redirect to /dashboard.
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(EMAIL, { exact: false })).toBeVisible()
    await expect(page).toHaveURL(/\/register$/)

    // Server-side provisioning: user unconfirmed, org on the free tier,
    // profile linked to both the user (owner) and the org.
    const user = sql(`select confirmed, confirmation_token is not null from up_users where email='${EMAIL}';`)
    expect(user).toBe('0|1')

    // New organisations start on the trial tier when a card-less trial is
    // configured (api::billing initialBillingFields), otherwise on free.
    const org = sql(`select name, tier from organizations where name='${ORG_NAME}' and published_at is not null;`)
    expect(org).toBe(`${ORG_NAME}|${EXPECTED_TIER}`)

    // A confirmation email is really dispatched (checked only when a mail
    // sink is wired up - see this file's header comment).
    if (MAIL_SINK) {
      expect(confirmationLinkFromInbox(EMAIL), 'a confirmation email should have been delivered').not.toBeNull()
    }

    const profile = sql(`
      select p.name, p.profile_type, o.name
      from profiles p
      join profiles_owner_lnk pol on pol.profile_id = p.id
      join up_users u on u.id = pol.user_id
      join profiles_organization_lnk pln on pln.profile_id = p.id
      join organizations o on o.id = pln.organization_id
      where u.email='${EMAIL}' and p.published_at is not null;`)
    expect(profile).toBe(`${USERNAME}|Both|${ORG_NAME}`)
  })

  test('sign-in is blocked until the email is confirmed', async ({ page }) => {
    await page.goto('/login')
    await waitForHydration(page)
    await fillField(page, '#email', EMAIL)
    await fillField(page, '#password', PASSWORD)
    await page.locator('button[type="submit"]').click()

    await expect(page.getByText('Your account email is not confirmed')).toBeVisible({ timeout: 20000 })
    await expect(page.getByRole('button', { name: 'Resend confirmation email' })).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('a duplicate email cannot register a second organisation', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('#organizationType option')).not.toHaveCount(1, { timeout: 20000 })
    await fillField(page, '#username', `${USERNAME}dup`)
    await fillField(page, '#email', EMAIL)
    await fillField(page, '#organizationName', `${ORG_NAME} Duplicate`)
    await fillField(page, '#password', PASSWORD)
    await fillField(page, '#confirmPassword', PASSWORD)
    await checkBox(page, '#terms')
    await page.locator('button[type="submit"]').click()

    // Form stays put and surfaces an error; no second org is created.
    await expect(page.getByRole('heading', { name: 'Check your email' })).toHaveCount(0)
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 15000 })

    const dupOrgs = sql(`select count(*) from organizations where name='${ORG_NAME} Duplicate';`)
    expect(dupOrgs).toBe('0')
  })

  test('the confirmation link activates the account', async ({ page }) => {
    const token = sql(`select confirmation_token from up_users where email='${EMAIL}';`)
    expect(token, 'a confirmation token should have been generated').not.toBe('')

    const emailedLink = confirmationLinkFromInbox(EMAIL)
    if (emailedLink) {
      // The app really sent this address an email; assert the link in it
      // is the one that activates this exact account.
      expect(emailedLink).toContain(token)
    }
    const confirmationUrl = emailedLink || `${API}/api/auth/email-confirmation?confirmation=${token}`

    // Clicking it redirects to the configured frontend target on success.
    await page.goto(confirmationUrl)
    await expect(page).toHaveURL(/\/login\?confirmed=true/)
    await expect(page.getByText('Your email has been confirmed')).toBeVisible()

    expect(sql(`select confirmed from up_users where email='${EMAIL}';`)).toBe('1')
  })
})

test.describe('new organisation: using the system', () => {
  test('signs in and lands on a free-tier dashboard', async ({ page }) => {
    await page.goto('/login')
    await waitForHydration(page)
    await fillField(page, '#email', EMAIL)
    await fillField(page, '#password', PASSWORD)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })

    // Usage panel for the starting tier, at zero usage for a brand-new org.
    await expect(page.getByText(EXPECTED_TIER === 'free' ? 'Free' : 'Pro', { exact: true }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/0\s*\/\s*\d+/)).toBeVisible()

    jwt = await tokenFor(page)
  })

  test('issuer navigation is available to the organisation admin', async ({ page }) => {
    await signIn(page)
    const nav = page.locator('nav').first()
    await openManageMenu(page)
    await expect(nav.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Design Templates' }).first()).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Events' }).first()).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Issue Badges' }).first()).toBeVisible()
  })

  test('design template gallery shows only global templates, then the org can create its own', async ({ page }) => {
    await signIn(page)
    // Navigated via the header link, not page.goto: a hard load of this
    // route bounces an issuer to /dashboard - see the deep-link test at
    // the bottom of this file.
    await gotoViaNav(page, 'Design Templates', /\/design-templates/)

    // Platform-curated templates are visible to every org...
    for (const name of GLOBAL_TEMPLATE_NAMES) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 20000 })
    }
    // ...but no other organisation's templates are.
    for (const name of FOREIGN_TEMPLATE_NAMES) {
      await expect(page.getByText(name, { exact: true })).toHaveCount(0)
    }

    await page.getByRole('link', { name: /Create Template/i }).first().click()
    await expect(page).toHaveURL(/\/design-templates\/create/)

    await page.getByRole('button', { name: 'Certificate', exact: true }).click()
    await fillField(page, '#newTemplateName', TEMPLATE_NAME)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Lands in the editor for the new template.
    await expect(page).toHaveURL(/\/design-templates\/[^/]+$/, { timeout: 20000 })

    await page.getByRole('link', { name: 'Back to Design Templates' }).first().click()
    await expect(page).toHaveURL(/\/design-templates$/, { timeout: 20000 })
    await expect(page.getByText(TEMPLATE_NAME, { exact: true }).first()).toBeVisible({ timeout: 20000 })

    // Persisted against this org, not global and not another org's.
    const row = sql(`
      select dt.type, o.name
      from design_templates dt
      join design_templates_organization_lnk l on l.design_template_id = dt.id
      join organizations o on o.id = l.organization_id
      where dt.name='${TEMPLATE_NAME}' and dt.published_at is not null;`)
    expect(row).toBe(`certificate|${ORG_NAME}`)
  })

  test('events start empty and the org can create one', async ({ page }) => {
    await signIn(page)
    await gotoViaNav(page, 'Events', /\/events/)

    // Another org's event must not be visible here.
    await expect(page.getByText('No events yet')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(FOREIGN_EVENT_NAME, { exact: true })).toHaveCount(0)

    await page.getByRole('link', { name: /Create (Your First )?Event/i }).first().click()
    await expect(page).toHaveURL(/\/events\/create/)

    await fillField(page, '#eventName', EVENT_NAME)
    await fillField(page, '#eventDescription', 'Created by the Playwright new-organisation journey spec.')
    await fillField(page, '#eventStartDate', '2026-10-01T09:00')
    await fillField(page, '#eventEndDate', '2026-10-02T17:00')
    await fillField(page, '#eventLocation', 'Online')
    await page.locator('#eventStatus').selectOption('scheduled')

    await page.getByRole('button', { name: 'Create Event', exact: true }).click()
    await expect(page).toHaveURL(/\/events\/[^/]+$/, { timeout: 20000 })

    await page.getByRole('link', { name: 'Back to Events' }).first().click()
    await expect(page).toHaveURL(/\/events$/, { timeout: 20000 })
    await expect(page.getByText(EVENT_NAME, { exact: true }).first()).toBeVisible({ timeout: 20000 })

    const row = sql(`
      select e.status, o.name
      from events e
      join events_organization_lnk l on l.event_id = e.id
      join organizations o on o.id = l.organization_id
      where e.name='${EVENT_NAME}' and e.published_at is not null;`)
    expect(row).toBe(`scheduled|${ORG_NAME}`)
  })

  test('issue page is reachable and shows no badges for a brand-new org', async ({ page }) => {
    await signIn(page)
    await gotoViaNav(page, 'Issue Badges', /\/issue/)

    await expect(page).toHaveURL(/\/issue/)
    await expect(page.getByRole('heading', { name: 'Issue Certificate' })).toBeVisible({ timeout: 20000 })
    // No achievements exist yet for this org, so nothing is offered to issue.
    await expect(page.getByText(/Python Fundamentals|Course Completion/)).toHaveCount(0)
  })

  /**
   * Regression guard. A hard load of an issuer-only route (bookmark,
   * refresh, pasted URL) used to bounce the user to /dashboard:
   * middleware/auth.ts reads authStore.isIssuer, which comes from
   * profile.profileType, but on a fresh page load it only waited on
   * authStore.isLoading - still false before plugins/auth-init.client.ts
   * has started init() - so the store looked logged out, the issuer route
   * redirected to /login, and /login's own guard (initialized by then)
   * redirected on to /dashboard. Fixed by awaiting authStore.init() in
   * both middlewares.
   */
  test('deep-linking and refreshing an issuer route keeps the user there', async ({ page }) => {
    await signIn(page)

    await page.goto('/design-templates')
    await expect(page).toHaveURL(/\/design-templates/, { timeout: 20000 })
    await expect(page.getByRole('heading', { name: 'Design Templates' }).first()).toBeVisible({ timeout: 20000 })

    await page.reload()
    await expect(page).toHaveURL(/\/design-templates/, { timeout: 20000 })

    await page.goto('/issue')
    await expect(page).toHaveURL(/\/issue/, { timeout: 20000 })
  })

  test('a signed-out visitor is still redirected away from protected routes', async ({ browser }) => {
    // The deep-link fix must not have opened these routes up to anyone.
    const anonymous = await browser.newContext()
    const page = await anonymous.newPage()
    for (const route of ['/design-templates', '/issue', '/dashboard']) {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/, { timeout: 20000 })
    }
    await anonymous.close()
  })

  test('API layer scopes every listing to the new organisation', async ({ request }) => {
    expect(jwt, 'expected a JWT captured at sign-in').not.toBe('')
    const auth = { Authorization: `Bearer ${jwt}` }

    const templates = await (await request.get(`${API}/api/design-templates?pagination[pageSize]=100`, { headers: auth })).json()
    const templateNames = (templates.data || []).map((t: any) => t.name)
    expect(templateNames).toContain(TEMPLATE_NAME)
    expect(templateNames).toEqual(expect.arrayContaining(GLOBAL_TEMPLATE_NAMES))
    for (const foreign of FOREIGN_TEMPLATE_NAMES) {
      expect(templateNames).not.toContain(foreign)
    }

    const events = await (await request.get(`${API}/api/events?pagination[pageSize]=100`, { headers: auth })).json()
    const eventNames = (events.data || []).map((e: any) => e.name)
    expect(eventNames).toContain(EVENT_NAME)
    expect(eventNames).not.toContain(FOREIGN_EVENT_NAME)

    const usage = await (await request.get(`${API}/api/organizations/usage`, { headers: auth })).json()
    expect(usage.data?.tier).toBe('free')
  })
})

async function signIn(page: import('@playwright/test').Page) {
  await signInAs(page, EMAIL, PASSWORD)
}
