/**
 * Credential lifecycle, end to end, through the real UI.
 *
 * Picks up where the new-organisation journey leaves off and covers the
 * work an organisation actually does day to day:
 *   design a certificate template -> design a badge template ->
 *   issue to a CSV of recipients -> the recipients get an email with a
 *   link to their certificate -> a third party opens that link and sees a
 *   verified credential -> the credential is shareable (LinkedIn, native
 *   share / copy link, QR code, email).
 *
 * Runs against the live local dev stack (Nuxt :3000 + Strapi :1337), with
 * the backend's dev mail catcher on (DEV_MAIL_CATCHER=true) so the test
 * can read the mail the app really sent. Everything is namespaced by
 * RUN_ID, so the spec is re-runnable with no cleanup.
 */

import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import {
  confirmEmail,
  fillField,
  gotoViaNav,
  inboxFor,
  profileFor,
  registerOrganisation,
  signIn,
  sql,
  tokenFor,
  waitForHydration,
} from './support/journey'

const RUN_ID = Date.now().toString(36)

const ORG = {
  username: `pwissuer${RUN_ID}`,
  email: `pwissuer${RUN_ID}@certrust.test`,
  password: 'Playwright#Issue2026',
  organizationName: `Playwright Academy ${RUN_ID}`,
  organizationType: 'Educational',
}

const CERTIFICATE_TEMPLATE = `PW Certificate Design ${RUN_ID}`
const BADGE_TEMPLATE = `PW Badge Design ${RUN_ID}`
const ACHIEVEMENT_NAME = `Advanced TypeScript ${RUN_ID}`

/** Three recipients, delivered the way an issuer really does it: a CSV. */
const RECIPIENTS = [
  { name: 'Ada Lovelace', email: `ada.${RUN_ID}@recipient.test` },
  { name: 'Grace Hopper', email: `grace.${RUN_ID}@recipient.test` },
  { name: 'Alan Turing', email: `alan.${RUN_ID}@recipient.test` },
]
const CSV = `name,email\n${RECIPIENTS.map(r => `${r.name},${r.email}`).join('\n')}\n`

/** Populated as the suite runs, and consumed by the later tests. */
let jwt = ''
let profileId = ''
let achievementId = ''
const credentialUrls = new Map<string, string>()

test.describe.configure({ mode: 'serial' })

test.describe('credential lifecycle', () => {
  test('a new organisation signs up, confirms its email and signs in', async ({ page, request }) => {
    await registerOrganisation(page, ORG)
    await confirmEmail(page, ORG.email)
    await signIn(page, ORG.email, ORG.password)

    jwt = await tokenFor(page)
    const profile = await profileFor(request, jwt)
    profileId = String(profile.id)
    expect(profile.organization?.name).toBe(ORG.organizationName)
  })

  test('designs a certificate template and saves the design', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await gotoViaNav(page, 'Design Templates', /\/design-templates/)

    await page.getByRole('link', { name: /Create Template/i }).first().click()
    await expect(page).toHaveURL(/\/design-templates\/create/)

    await page.getByRole('button', { name: 'Certificate', exact: true }).click()
    await fillField(page, '#newTemplateName', CERTIFICATE_TEMPLATE)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    // Lands in the designer for the new template.
    await expect(page).toHaveURL(/\/design-templates\/[^/]+$/, { timeout: 20000 })
    await expect(page.locator('#templateName')).toHaveValue(CERTIFICATE_TEMPLATE, { timeout: 20000 })

    // Actually design it: description plus a real layout config.
    await fillField(page, '#templateDescription', 'Formal completion certificate, landscape, gold seal.')
    await fillField(
      page,
      '#templateLayoutConfig',
      JSON.stringify({ orientation: 'landscape', accentColor: '#28A745', seal: 'gold', showQr: true }, null, 2)
    )
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText('Template saved successfully')).toBeVisible({ timeout: 20000 })

    // A saved design is a persisted design.
    const saved = sql(`
      select dt.type, dt.description
      from design_templates dt
      where dt.name='${CERTIFICATE_TEMPLATE}' and dt.published_at is not null;`)
    expect(saved).toBe('certificate|Formal completion certificate, landscape, gold seal.')
  })

  test('designs a badge template and sees both designs in the gallery', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await gotoViaNav(page, 'Design Templates', /\/design-templates/)

    await page.getByRole('link', { name: /Create Template/i }).first().click()
    await page.getByRole('button', { name: 'Badge', exact: true }).click()
    await fillField(page, '#newTemplateName', BADGE_TEMPLATE)
    await page.getByRole('button', { name: 'Create', exact: true }).click()

    await expect(page).toHaveURL(/\/design-templates\/[^/]+$/, { timeout: 20000 })
    await fillField(page, '#templateDescription', 'Circular skill badge, green ring, centred icon.')
    await page.locator('button[type="submit"]').click()
    await expect(page.getByText('Template saved successfully')).toBeVisible({ timeout: 20000 })

    await page.getByRole('link', { name: 'Back to Design Templates' }).first().click()
    await expect(page).toHaveURL(/\/design-templates$/, { timeout: 20000 })
    await expect(page.getByText(CERTIFICATE_TEMPLATE, { exact: true }).first()).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(BADGE_TEMPLATE, { exact: true }).first()).toBeVisible()

    const types = sql(`
      select group_concat(type)
      from (select type from design_templates
            where name in ('${CERTIFICATE_TEMPLATE}', '${BADGE_TEMPLATE}')
              and published_at is not null order by type);`)
    expect(types).toBe('badge,certificate')
  })

  test('creates the achievement that will be issued, through the form', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await gotoViaNav(page, 'Issue Badges', /\/issue/)

    // A brand-new organisation has nothing to issue yet; the empty state
    // leads straight to the achievement form.
    await expect(page.getByText('You haven\'t created anything to issue yet')).toBeVisible({ timeout: 20000 })
    await page.getByRole('link', { name: 'New achievement' }).click()
    await expect(page).toHaveURL(/\/achievements\/create/)
    await waitForHydration(page)

    await fillField(page, '#achievementName', ACHIEVEMENT_NAME)
    await fillField(page, '#achievementDescription', 'Awarded for completing the advanced TypeScript programme.')
    await page.getByText('Certificate', { exact: true }).click()
    await fillField(page, '#achievementCriteria', 'Completed every module and the final project.')
    await page.getByRole('button', { name: 'Create achievement' }).click()

    // Back on /issue with the new achievement preselected.
    await expect(page).toHaveURL(/\/issue\?achievement=\d+/, { timeout: 20000 })
    achievementId = new URL(page.url()).searchParams.get('achievement') ?? ''
    expect(achievementId).not.toBe('')
    await expect(page.locator('div.cursor-pointer', { hasText: ACHIEVEMENT_NAME }).first()).toHaveClass(/bg-\[#28A745\]\/5/, { timeout: 20000 })

    // Stored for this organisation's profile, as a published certificate.
    const stored = sql(`
      select a.name || '|' || a.template_type || '|' || a.achievement_type || '|' || (a.published_at is not null) || '|' || l.profile_id
      from achievements a join achievements_creator_lnk l on l.achievement_id = a.id
      where a.id = ${achievementId};`)
    expect(stored).toBe(`${ACHIEVEMENT_NAME}|certificate|Certificate|1|${profileId}`)
  })

  test('issues certificates to a CSV of recipients', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await gotoViaNav(page, 'Issue Badges', /\/issue/)

    // The achievement created above is now offered as a template to issue.
    const card = page.locator('div').filter({ hasText: ACHIEVEMENT_NAME }).last()
    await expect(page.getByText(ACHIEVEMENT_NAME).first()).toBeVisible({ timeout: 20000 })
    await card.click()

    // Upload the CSV rather than typing a recipient by hand.
    await page.locator('#csv-upload').setInputFiles({
      name: `recipients-${RUN_ID}.csv`,
      mimeType: 'text/csv',
      buffer: Buffer.from(CSV, 'utf8'),
    })

    await expect(page.getByText(`${RECIPIENTS.length} recipients loaded from CSV`)).toBeVisible({ timeout: 20000 })
    for (const recipient of RECIPIENTS) {
      await expect(page.getByText(`${recipient.name} <${recipient.email}>`)).toBeVisible()
    }

    await page.getByRole('button', { name: 'Issue Certificates', exact: true }).click()

    await expect(page.getByText('Certificates issued successfully!')).toBeVisible({ timeout: 60000 })

    // Every row in the batch result table reports success.
    const rows = page.locator('table tbody tr')
    await expect(rows).toHaveCount(RECIPIENTS.length)
    await expect(page.getByText('Failed')).toHaveCount(0)
    for (const recipient of RECIPIENTS) {
      await expect(rows.filter({ hasText: recipient.email }).getByText('Success')).toBeVisible()
    }

    const issued = sql(`
      select count(*) from credentials c
      join credentials_achievement_lnk l on l.credential_id = c.id
      where l.achievement_id = ${achievementId} and c.published_at is not null;`)
    expect(Number(issued)).toBeGreaterThanOrEqual(RECIPIENTS.length)
  })

  test('emails every recipient a link to their certificate', async () => {
    for (const recipient of RECIPIENTS) {
      const messages = inboxFor(recipient.email)
      expect(messages.length, `${recipient.email} should have received mail`).toBeGreaterThan(0)

      const issuance = messages.find(message => message.subject.includes(ACHIEVEMENT_NAME))
      expect(issuance, `${recipient.email} should have an issuance email`).toBeTruthy()
      // Subject names the issuing organisation (recipients recognise it).
      expect(issuance!.subject).toBe(`Your certificate from ${ORG.organizationName}: ${ACHIEVEMENT_NAME}`)

      // One call to action: straight to the credential. LinkedIn, download
      // and sharing live on the credential page (checked below), not in the
      // email - fewer links and no "set your password" block keep it out of
      // spam folders.
      const credentialLink = issuance!.links.find(link => link.includes('/credentials/'))
      expect(credentialLink, 'the email should link to the credential').toBeTruthy()
      credentialUrls.set(recipient.email, credentialLink!)
      expect(issuance!.links.some(link => link.includes('linkedin.com'))).toBe(false)
      expect(issuance!.body).not.toMatch(/Set Your Password|Username:/i)
    }
  })

  test('the emailed link opens a verified credential for anyone who receives it', async ({ browser }) => {
    const recipient = RECIPIENTS[0]
    const url = credentialUrls.get(recipient.email)
    expect(url, 'the issuance email should have carried a credential link').toBeTruthy()

    // A brand-new context: no session, no cookies - a third party checking
    // the certificate they were sent.
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(url!)

    await expect(page.getByText('Credential verified')).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('heading', { name: ACHIEVEMENT_NAME }).first()).toBeVisible()
    await expect(page.getByText(recipient.name).first()).toBeVisible()

    // The verification checks all rendered, and none of them failed.
    await expect(page.getByRole('heading', { name: 'Verification Checks' })).toBeVisible()
    await expect(page.getByText('Credential verification failed')).toHaveCount(0)

    await context.close()
  })

  test('the credential page offers LinkedIn, QR and copy-link sharing', async ({ browser }) => {
    const recipient = RECIPIENTS[0]
    const url = credentialUrls.get(recipient.email)!

    const context = await browser.newContext()
    const page = await context.newPage()

    // Stub the two browser APIs the share button uses, before the page loads:
    //  - navigator.share exists on desktop Chrome and would open a native
    //    share sheet the test cannot drive, so force the copy-link fallback.
    //  - writeText is recorded rather than performed. Asserting via
    //    clipboard.readText() would read (and this is not hypothetical) the
    //    real clipboard of whoever is running the suite.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      ;(window as any).__copiedText = []
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as any).__copiedText.push(text)
          },
        },
      })
    })

    await page.goto(url)
    await expect(page.getByText('Credential verified')).toBeVisible({ timeout: 30000 })

    // "Add to LinkedIn" carries the credential through to LinkedIn's
    // add-to-profile flow. The link is labelled by aria-label, not its text.
    const linkedIn = page.getByRole('link', { name: /Add this certificate to your LinkedIn profile/i }).first()
    await expect(linkedIn).toBeVisible()
    // Parsed as a URL rather than string-matched: URLSearchParams encodes
    // spaces as '+', which decodeURIComponent does not undo.
    const linkedInUrl = new URL((await linkedIn.getAttribute('href'))!)
    expect(linkedInUrl.host).toBe('www.linkedin.com')
    expect(linkedInUrl.pathname).toBe('/profile/add')
    expect(linkedInUrl.searchParams.get('startTask')).toBe('CERTIFICATION_NAME')
    expect(linkedInUrl.searchParams.get('name')).toBe(ACHIEVEMENT_NAME)
    expect(linkedInUrl.searchParams.get('certUrl')).toContain('/credentials/')
    expect(linkedInUrl.searchParams.get('certId')).toContain('urn:uuid:')

    // The shareable URL is shown, and a QR code encodes it. The page builds
    // it with an encoded credential id, so it is not byte-identical to the
    // link in the email - both resolve to the same credential.
    const shareLink = page.getByRole('link', { name: /\/credentials\// }).first()
    await expect(shareLink).toBeVisible()
    const shareableUrl = (await shareLink.getAttribute('href'))!
    expect(decodeURIComponent(shareableUrl)).toBe(decodeURIComponent(url))
    await expect(page.getByRole('img', { name: /QR code/i })).toBeVisible()

    // The share button copies the credential link when there is no native
    // share sheet to hand off to.
    await page.getByTitle('Share credential').click()
    await expect
      .poll(async () => page.evaluate(() => (window as any).__copiedText), { timeout: 15000 })
      .toEqual([shareableUrl])

    await context.close()
  })

  test('the issuer dashboard reflects the issuance and offers sharing', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)

    // Usage moved off zero and counts every certificate issued. The limit
    // depends on the plan (new orgs start on a Pro trial), so only the count
    // is pinned.
    await expect(page.getByText(new RegExp(`\\b${RECIPIENTS.length} / \\d+\\b`))).toBeVisible({ timeout: 30000 })
    await expect(page.getByText('Issued Badges')).toBeVisible()
    await expect(page.getByText(ACHIEVEMENT_NAME).first()).toBeVisible()

    // Each issued certificate card exposes the sharing actions behind its
    // overflow menu. Anchor on the heading and walk up to the card root,
    // rather than guessing at a class-based container.
    const card = page
      .getByRole('heading', { name: ACHIEVEMENT_NAME })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
    await card.getByRole('button').first().click()

    const linkedIn = page.getByRole('link', { name: /Add this certificate to your LinkedIn profile/i }).first()
    await expect(linkedIn).toBeVisible({ timeout: 15000 })
    expect(await linkedIn.getAttribute('href')).toContain('linkedin.com/profile/add')

    const emailShare = page.getByRole('link', { name: 'Share via Email' }).first()
    await expect(emailShare).toBeVisible()
    expect(await emailShare.getAttribute('href')).toMatch(/^mailto:/)
  })
})
