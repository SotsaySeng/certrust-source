/**
 * Shared helpers for the end-to-end journey specs.
 *
 * Not a spec file itself (Playwright's default testMatch only picks up
 * .spec.ts / *.test.ts), so it is safe to keep alongside them.
 */

import type { APIRequestContext, Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'

export const API = process.env.E2E_API_URL || 'http://localhost:1337'
// E2E_DB_PATH points the specs at a backend started on a different sqlite
// file (e.g. an isolated verify DB), so test orgs never land in real data.
export const DB_PATH = process.env.E2E_DB_PATH || fileURLToPath(new URL('../../../backend/.tmp/local.db', import.meta.url))

/**
 * JSONL index written by the backend's dev mail catcher
 * (DEV_MAIL_CATCHER=true - see src/backend/src/bootstrap/dev-mail-catcher.ts).
 * Reading it is how these specs assert on mail the app really sent, and how
 * they follow links a recipient would click in their inbox.
 */
export const MAIL_SINK = process.env.MAIL_SINK || fileURLToPath(new URL('../../../backend/.tmp/mail/index.jsonl', import.meta.url))

export function sql(query: string): string {
  return execFileSync('sqlite3', [DB_PATH, query], { encoding: 'utf8' }).trim()
}

/** Nodemailer sends these bodies quoted-printable, which line-wraps URLs with `=\n`. */
export function decodeQuotedPrintable(body: string): string {
  return body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
}

export interface CaughtMail {
  to: string[]
  subject: string
  body: string
  links: string[]
}

/** Every message the app has delivered to `recipient`, oldest first. */
export function inboxFor(recipient: string): CaughtMail[] {
  if (!existsSync(MAIL_SINK)) {
    return []
  }
  return readFileSync(MAIL_SINK, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line))
    .filter((message: any) => (message.to || []).some((addr: string) => addr.includes(recipient)))
    .map((message: any) => {
      const body = decodeQuotedPrintable(message.raw as string)
      return {
        to: message.to,
        subject: message.subject || '',
        body,
        links: [...new Set([...body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(match => match[0]))]
      }
    })
}

export function confirmationLinkFromInbox(recipient: string): string | null {
  const messages = inboxFor(recipient)
  for (let i = messages.length - 1; i >= 0; i--) {
    const link = messages[i].links.find(candidate => candidate.includes('email-confirmation?confirmation='))
    if (link) {
      return link
    }
  }
  return null
}

/**
 * Nuxt SSRs these pages, so server-rendered inputs exist in the DOM a beat
 * before Vue hydrates them. Filling in that window sets a raw DOM value that
 * hydration then wipes (and v-model never sees). These helpers retry until
 * the value actually sticks.
 */
/**
 * Wait until Vue has mounted over the SSR markup. fillField's retry can't
 * catch every case: a pre-hydration fill "sticks" as a raw DOM value, and a
 * submit clicked in that window is a native form GET (credentials end up in
 * the URL) instead of the app's @submit.prevent handler. On a cold browser
 * context against the Vite dev server that window lasts several seconds.
 */
export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as any)?.__vue_app__), undefined, { timeout: 30000 })
}

export async function fillField(page: Page, selector: string, value: string) {
  const field = page.locator(selector)
  await expect(field).toBeVisible({ timeout: 20000 })
  await expect(async () => {
    await field.fill(value)
    await expect(field).toHaveValue(value, { timeout: 1500 })
  }).toPass({ timeout: 20000 })
}

export async function selectOptionByLabel(page: Page, selector: string, label: string) {
  const field = page.locator(selector)
  await expect(async () => {
    await field.selectOption({ label })
    await expect(field).not.toHaveValue('', { timeout: 1500 })
  }).toPass({ timeout: 20000 })
}

export async function checkBox(page: Page, selector: string) {
  const field = page.locator(selector)
  await expect(async () => {
    await field.check()
    await expect(field).toBeChecked({ timeout: 1500 })
  }).toPass({ timeout: 20000 })
}

/**
 * Follow a header link instead of page.goto(). Client-side navigation is the
 * path a real user takes; deep loads are covered by their own regression test.
 */
export async function gotoViaNav(page: Page, linkName: string, expectedUrl: RegExp) {
  const link = page.locator('nav').first().getByRole('link', { name: linkName }).first()
  await expect(link).toBeVisible({ timeout: 20000 })
  await link.click()
  await expect(page).toHaveURL(expectedUrl, { timeout: 20000 })
}

export interface NewOrganisation {
  username: string
  email: string
  password: string
  organizationName: string
  organizationType?: string
}

/** Register through the real sign-up form and land on the "check your email" panel. */
export async function registerOrganisation(page: Page, org: NewOrganisation) {
  await page.goto('/register')
  // Org-type options are fetched client-side, so their presence doubles as
  // the signal that the page has hydrated and is safe to type into.
  await expect(page.locator('#organizationType option').nth(1)).toBeAttached({ timeout: 20000 })

  await fillField(page, '#username', org.username)
  await fillField(page, '#email', org.email)
  await fillField(page, '#organizationName', org.organizationName)
  if (org.organizationType) {
    await selectOptionByLabel(page, '#organizationType', org.organizationType)
  }
  await fillField(page, '#password', org.password)
  await fillField(page, '#confirmPassword', org.password)
  await checkBox(page, '#terms')
  await page.locator('button[type="submit"]').click()

  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({ timeout: 20000 })
}

/** Click the confirmation link exactly as it was delivered to the inbox. */
export async function confirmEmail(page: Page, email: string) {
  const token = sql(`select confirmation_token from up_users where email='${email}';`)
  expect(token, 'a confirmation token should have been generated').not.toBe('')

  const emailedLink = confirmationLinkFromInbox(email)
  if (emailedLink) {
    expect(emailedLink).toContain(token)
  }

  await page.goto(emailedLink || `${API}/api/auth/email-confirmation?confirmation=${token}`)
  await expect(page).toHaveURL(/\/login\?confirmed=true/, { timeout: 20000 })
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await waitForHydration(page)
  await fillField(page, '#email', email)
  await fillField(page, '#password', password)
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })
}

/**
 * The signed-in user's JWT, for driving the API directly. The website keeps
 * it only in the HttpOnly `certrust_jwt` cookie (page scripts cannot read
 * it, which is the point), so read it from the browser context instead.
 */
export async function tokenFor(page: Page): Promise<string> {
  const cookies = await page.context().cookies(API)
  const token = cookies.find(c => c.name === 'certrust_jwt')?.value
  expect(token, 'expected the HttpOnly session cookie after sign-in').toBeTruthy()
  expect(await page.evaluate(() => localStorage.getItem('token')), 'no token may be left in localStorage').toBeNull()
  return token as string
}

export async function profileFor(request: APIRequestContext, jwt: string): Promise<any> {
  const response = await request.get(`${API}/api/profiles/me`, { headers: { Authorization: `Bearer ${jwt}` } })
  expect(response.ok(), 'profiles/me should resolve for a signed-in user').toBeTruthy()
  const body = await response.json()
  return Array.isArray(body.data) ? body.data[0] : body.data
}
