/**
 * Records the "issue your first certificate" demo video and the screenshots
 * for the /guide manual. Not a test - skipped unless PW_DEMO=1.
 *
 * Each scene holds the screen at least as long as its Kokoro narration
 * (docs/demo-video/tutorial.json `durations`), and the real scene start
 * times go to docs/demo-video/out/timeline.json, so docs/demo-video/build.py
 * can lay the voiceover and captions on top without hand editing.
 * Full recipe: docs/demo-video/README.md.
 */

import type { Locator } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'
import { confirmationLinkFromInbox, inboxFor, waitForHydration } from './support/journey'

const DOCS = fileURLToPath(new URL('../../../docs/demo-video/', import.meta.url))
const SHOTS = fileURLToPath(new URL('../public/guide/', import.meta.url))
const SPEC = JSON.parse(readFileSync(`${DOCS}tutorial.json`, 'utf8')) as { durations: number[] }

// Demo data only - example.* domains are reserved and never deliverable.
const ORG = {
  username: 'kiri.walker',
  email: 'kiri@arohaacademy.example',
  password: 'Aroha#Demo2026',
  organizationName: 'Aroha Academy',
}
const TEMPLATE = 'Course Certificate'
const ACHIEVEMENT = 'Introduction to Data Analytics'
const RECIPIENTS = [
  { name: 'Mere Tane', email: 'mere.tane@example.com' },
  { name: 'James Wilson', email: 'james.wilson@example.com' },
  { name: 'Priya Sharma', email: 'priya.sharma@example.com' },
]

/**
 * A visible cursor (headless video shows none) that glides and pulses on
 * click, plus a 12px scene marker in the bottom-right corner. The recorded
 * video drifts several seconds behind the wall clock, so build.py finds each
 * scene start by the marker flipping red/blue (parity kept in window.name,
 * which survives navigation) and paints the corner over afterwards.
 */
const CURSOR = `(() => {
  if (document.getElementById('__demo_cursor')) return
  const add = () => {
    const m = document.createElement('div')
    m.id = '__demo_sync'
    m.style.cssText = 'position:fixed;z-index:2147483647;right:0;bottom:0;width:12px;height:12px;pointer-events:none;background:' + (window.name === 'odd' ? '#0000ff' : '#ff0000')
    document.documentElement.appendChild(m)
    const c = document.createElement('div')
    c.id = '__demo_cursor'
    c.style.cssText = 'position:fixed;z-index:2147483647;left:-40px;top:-40px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(40,167,69,.35);border:2px solid #1f7a34;pointer-events:none;transition:left .35s ease,top .35s ease,transform .15s'
    document.documentElement.appendChild(c)
    addEventListener('mousemove', e => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px' }, true)
    addEventListener('mousedown', () => { c.style.transform = 'scale(.6)' }, true)
    addEventListener('mouseup', () => { c.style.transform = '' }, true)
  }
  document.documentElement ? add() : addEventListener('DOMContentLoaded', add)
})()`

test.skip(!process.env.PW_DEMO, 'demo recording only runs with PW_DEMO=1')
test.use({ headless: true })

test('record the issue-your-first-certificate demo', async ({ browser, baseURL }) => {
  test.setTimeout(20 * 60_000)
  mkdirSync(`${DOCS}out/raw`, { recursive: true })
  mkdirSync(SHOTS, { recursive: true })

  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: `${DOCS}out/raw`, size: { width: 1920, height: 1080 } },
  })
  await context.addInitScript(CURSOR)
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  const t0 = Date.now()
  const starts: number[] = []
  const mailBefore = { org: inboxFor(ORG.email).length, recipient: inboxFor(RECIPIENTS[0].email).length }

  async function scene(i: number, actions: () => Promise<void>) {
    const start = Date.now()
    starts[i] = (start - t0) / 1000
    await page.evaluate((parity) => {
      window.name = parity
      const m = document.getElementById('__demo_sync')
      if (m) {
        m.style.background = parity === 'odd' ? '#0000ff' : '#ff0000'
      }
    }, i % 2 ? 'odd' : 'even')
    await actions()
    const remaining = SPEC.durations[i] * 1000 - (Date.now() - start)
    if (remaining > 0) {
      await page.waitForTimeout(remaining)
    }
  }
  const shot = (name: string) => page.screenshot({ path: `${SHOTS}${name}.jpg`, type: 'jpeg', quality: 82, style: '#__demo_cursor,#__demo_sync{display:none!important}' })
  const pause = (ms = 600) => page.waitForTimeout(ms)

  async function click(target: Locator) {
    await target.scrollIntoViewIfNeeded()
    await target.hover()
    await pause(450)
    await target.click()
  }
  /** Types visibly; falls back to fill if Nuxt hydration wiped the keystrokes. */
  async function type(selector: string, value: string) {
    const field = page.locator(selector)
    await click(field)
    await field.pressSequentially(value, { delay: 35 })
    if (await field.inputValue() !== value) {
      await field.fill(value)
    }
    await expect(field).toHaveValue(value)
  }
  /**
   * Select a Design Studio text element from the Layers panel and retype it
   * in the properties panel. Selected via Layers so the Layers panel is
   * shown in the video.
   */
  async function editLayerText(layer: string, current: string, value: string) {
    await click(page.locator('li').filter({ hasText: layer }).first())
    const field = page.locator('textarea.ds-input').first()
    await expect(field).toHaveValue(current)
    await click(field)
    await field.press('ControlOrMeta+a')
    await field.pressSequentially(value, { delay: 45 })
    await pause(300)
  }
  /** Shows a delivered email the way an inbox would, links intact. */
  async function showEmail(raw: string, subject: string, from: string) {
    await page.setContent(inboxView(raw, subject, from))
    await page.evaluate(CURSOR)
  }

  // 0 · Intro: the public homepage.
  await scene(0, async () => {
    await page.goto('/')
    await waitForHydration(page)
    await pause(1500)
    await page.mouse.wheel(0, 500)
  })

  // 1 · Register.
  await scene(1, async () => {
    await page.goto('/register')
    await expect(page.locator('#organizationType option').nth(1)).toBeAttached({ timeout: 20000 })
    await waitForHydration(page)
    await type('#username', ORG.username)
    await type('#email', ORG.email)
    await type('#organizationName', ORG.organizationName)
    await page.locator('#organizationType').selectOption({ label: 'Educational' })
    await type('#password', ORG.password)
    await type('#confirmPassword', ORG.password)
    await click(page.locator('#terms'))
    await shot('step-1-register')
    await click(page.locator('button[type="submit"]'))
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({ timeout: 20000 })
  })

  // 2 · Confirmation email -> sign in -> dashboard.
  await scene(2, async () => {
    await pause(1200)
    // The mail log is shared across runs and dev servers: wait for this run's message.
    await expect.poll(() => inboxFor(ORG.email).length, { timeout: 30000 }).toBeGreaterThan(mailBefore.org)
    const mail = inboxFor(ORG.email).at(-1)!
    await showEmail(rawFor(ORG.email), mail.subject, 'Certrust')
    await pause(1200)
    // Strapi's stock confirmation email prints the link as plain text.
    await page.getByText(/email-confirmation/).first().hover()
    await pause(500)
    // The demo stack's FRONTEND_URL is https://certrust.app (so links look
    // real on screen): confirm via the API, then open the local login page.
    const confirm = await page.request.get(confirmationLinkFromInbox(ORG.email)!, { maxRedirects: 0 })
    expect(confirm.status()).toBe(302)
    await page.goto('/login?confirmed=true')
    await waitForHydration(page)
    await type('#email', ORG.email)
    await type('#password', ORG.password)
    await click(page.locator('button[type="submit"]'))
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 })
    await pause(1500)
    await shot('step-2-dashboard')
  })

  // 3 · Design a certificate.
  await scene(3, async () => {
    await page.goto('/design-templates')
    await waitForHydration(page)
    await click(page.getByTestId('new-design'))
    await expect(page).toHaveURL(/\/design-templates\/create/)
    await waitForHydration(page)
    await click(page.getByTestId('wizard-certificate'))
    await click(page.getByRole('button', { name: 'Classic Guilloché' }))
    await shot('step-3a-choose-layout')
    await click(page.getByTestId('wizard-next'))
    await click(page.getByTestId('wizard-skip-brand'))
    await type('#design-name', TEMPLATE)
    await click(page.getByTestId('wizard-create'))
    await expect(page).toHaveURL(/\/design-templates\/(?!create)[a-z0-9]+(?:\?|$)/, { timeout: 20000 })
    await expect(page.getByText('Preparing fonts…')).toHaveCount(0, { timeout: 30000 })
    // The first-visit tour opens a moment after the editor does.
    const skipTour = page.getByRole('button', { name: 'Skip tour' })
    if (await skipTour.waitFor({ timeout: 5000 }).then(() => true, () => false)) {
      await click(skipTour)
    }
    // Fill in the signature blocks the layout ships with.
    await click(page.getByRole('navigation', { name: 'Design tools' }).getByRole('button', { name: 'Layers', exact: true }))
    await editLayerText('Signer 1 name', 'Name Surname', 'Kiri Walker')
    await editLayerText('Signer 1 title', 'Title', 'Programme Lead')
    await editLayerText('Signer 2 name', 'Name Surname', 'Dr Sam Lee')
    await editLayerText('Signer 2 title', 'Title', 'Director')
    await page.mouse.click(1000, 1050, { delay: 150 })
    await expect(page.getByText('outside the page')).toHaveCount(0)
    await pause(800)
    await shot('step-3b-design-studio')
    await click(page.locator('[data-tour="save"]'))
    await expect(page.getByText('All changes saved')).toBeVisible({ timeout: 20000 })
  })

  // 4 · Create the achievement.
  await scene(4, async () => {
    await page.goto('/issue')
    await waitForHydration(page)
    await click(page.getByRole('link', { name: 'New achievement' }))
    await expect(page).toHaveURL(/\/achievements\/create/)
    await waitForHydration(page)
    await type('#achievementName', ACHIEVEMENT)
    await type('#achievementDescription', 'Awarded for completing the six-week Introduction to Data Analytics course.')
    await page.getByRole('radio', { name: 'Certificate' }).check()
    await type('#achievementCriteria', 'Attended every session and passed the final project.')
    await shot('step-4-achievement')
    await click(page.getByRole('button', { name: 'Create achievement' }))
    await expect(page).toHaveURL(/\/issue\?achievement=\d+/, { timeout: 20000 })
  })

  // 5 · Issue to a CSV of recipients.
  await scene(5, async () => {
    await pause(800)
    const csv = `name,email\n${RECIPIENTS.map(r => `${r.name},${r.email}`).join('\n')}\n`
    await page.locator('#csv-upload').setInputFiles({ name: 'data-analytics-class.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') })
    await expect(page.getByText(`${RECIPIENTS.length} recipients loaded from CSV`)).toBeVisible({ timeout: 20000 })
    await page.getByText(`${RECIPIENTS.length} recipients loaded from CSV`).scrollIntoViewIfNeeded()
    await pause(1500)
    await shot('step-5a-recipients')
    await click(page.getByRole('button', { name: 'Issue Certificates', exact: true }))
    await expect(page.getByText('Certificates issued successfully!')).toBeVisible({ timeout: 60000 })
    await page.getByText('Certificates issued successfully!').scrollIntoViewIfNeeded()
    await pause(1200)
    await shot('step-5b-issued')
    // Wait for delivery here, so scene 6 opens on the email itself.
    await expect.poll(() => inboxFor(RECIPIENTS[0].email).length, { timeout: 30000 }).toBeGreaterThan(mailBefore.recipient)
  })

  // 6 · The recipient's email.
  let credentialUrl = ''
  await scene(6, async () => {
    const recipient = RECIPIENTS[0]
    const mail = inboxFor(recipient.email).filter(m => m.subject.includes(ACHIEVEMENT)).at(-1)!
    credentialUrl = mail.links.find(link => link.includes('/credentials/'))!.replace(/^https?:\/\/[^/]+/, '')
    await showEmail(rawFor(recipient.email, ACHIEVEMENT), mail.subject, `${ORG.organizationName} via Certrust`)
    await pause(1500)
    await shot('step-6-email')
    await page.locator('a[href*="/credentials/"]').first().hover()
    await pause(800)
  })

  // 7 · The verified certificate.
  await scene(7, async () => {
    await page.goto(credentialUrl)
    await expect(page.getByText('Credential verified')).toBeVisible({ timeout: 30000 })
    await pause(1500)
    await shot('step-7-certificate')
    await page.mouse.wheel(0, 700)
    await pause(1500)
  })

  // 8 · Sharing.
  await scene(8, async () => {
    const linkedIn = page.getByRole('link', { name: /Add this certificate to your LinkedIn profile/i }).first()
    await linkedIn.scrollIntoViewIfNeeded()
    await linkedIn.hover()
    await pause(1200)
    await page.getByRole('img', { name: /QR code/i }).first().scrollIntoViewIfNeeded()
    await pause(1000)
    await shot('step-8-share')
  })

  // 9 · Dashboard.
  await scene(9, async () => {
    await page.goto('/dashboard')
    await waitForHydration(page)
    const rows = page.getByTestId('issued-row')
    await expect(rows).toHaveCount(RECIPIENTS.length, { timeout: 30000 })
    await rows.first().scrollIntoViewIfNeeded()
    await pause(800)
    await shot('step-9-dashboard')
    await click(page.getByTestId('issued-search'))
    await page.getByTestId('issued-search').pressSequentially('Priya', { delay: 60 })
    await expect(rows).toHaveCount(1)
    await pause(1000)
  })

  // 10 · Outro on the homepage.
  await scene(10, async () => {
    await page.goto('/')
    await waitForHydration(page)
  })

  await page.waitForTimeout(1000)
  const end = (Date.now() - t0) / 1000
  const video = await page.video()!.path()
  await context.close()
  const target = `${DOCS}out/raw/tutorial.webm`
  renameSync(video, target)
  writeFileSync(`${DOCS}out/timeline.json`, `${JSON.stringify({ video: target, starts, end }, null, 1)}\n`)
})

/** Raw MIME source of the newest delivered message for `recipient`. */
function rawFor(recipient: string, subjectIncludes = ''): string {
  const sink = fileURLToPath(new URL('../../backend/.tmp/mail/index.jsonl', import.meta.url))
  const all = readFileSync(process.env.MAIL_SINK || sink, 'utf8').trim().split('\n').map(line => JSON.parse(line))
  const mine = all.filter((m: any) => (m.to || []).some((a: string) => a.includes(recipient)) && (m.subject || '').includes(subjectIncludes))
  return mine.at(-1).raw
}

/** The message's HTML body, with cid: images inlined, under a plain inbox header. */
function inboxView(raw: string, subject: string, from: string): string {
  let html = ''
  const images = new Map<string, string>()
  const parts = raw.split(/\r?\n--[^\r\n]+/)
  for (const part of parts) {
    const split = part.search(/\r?\n\r?\n/)
    if (split < 0) {
      continue
    }
    const headers = part.slice(0, split)
    const body = part.slice(split).trim()
    const type = /Content-Type:\s*([^;\s]+)/i.exec(headers)?.[1] ?? ''
    const encoding = /Content-Transfer-Encoding:\s*(\S+)/i.exec(headers)?.[1]?.toLowerCase()
    const decode = () => encoding === 'base64'
      ? Buffer.from(body.replace(/\s/g, ''), 'base64')
      : encoding === 'quoted-printable'
        ? Buffer.from(body.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16))), 'latin1')
        : Buffer.from(body, 'utf8')
    if (type === 'text/html') {
      html = decode().toString('utf8')
    }
    const cid = /Content-ID:\s*<([^>]+)>/i.exec(headers)?.[1]
    if (cid && type.startsWith('image/')) {
      images.set(cid, `data:${type};base64,${decode().toString('base64')}`)
    }
  }
  for (const [cid, uri] of images) {
    html = html.split(`cid:${cid}`).join(uri)
  }
  const bar = `<div style="font:15px/1.5 Inter,system-ui,sans-serif;background:#f3f4f6;border-bottom:1px solid #e5e7eb;padding:18px 32px;color:#111">
    <div style="font-size:20px;font-weight:600;margin-bottom:4px">${escapeHtml(subject)}</div>
    <div style="color:#6b7280">From ${escapeHtml(from)}</div></div>`
  return /<body[^>]*>/i.test(html) ? html.replace(/<body[^>]*>/i, m => m + bar) : bar + html
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
}
