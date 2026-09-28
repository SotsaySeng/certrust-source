/**
 * Design Studio, end to end, through the real UI.
 *
 * A new organisation turns a library template into its own design with
 * the quick-start wizard, edits it in the editor (add text, undo/redo,
 * save), adds a custom attribute, puts the design on an achievement,
 * issues to a CSV with a custom column and gets a rendered certificate
 * (PNG + PDF) that does not change when the template is edited later.
 * Also covers the Premium lock and the saved-design limit for a
 * trial/free organisation.
 *
 * Runs against the live local dev stack (see support/journey.ts for the
 * E2E_* overrides) with the design library seeded (the default: see
 * backend src/bootstrap/design-library/seed.ts). Namespaced by RUN_ID, so
 * it is re-runnable without cleanup.
 */

import type { Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import {
  API,
  confirmEmail,
  fillField,
  registerOrganisation,
  signIn,
  sql,
  tokenFor,
  waitForHydration,
} from './support/journey'

const RUN_ID = Date.now().toString(36)

const ORG = {
  username: `pwstudio${RUN_ID}`,
  email: `pwstudio${RUN_ID}@certrust.test`,
  password: 'Playwright#Studio2026',
  organizationName: `Playwright Studio ${RUN_ID}`,
  organizationType: 'Educational',
}

const DESIGN_NAME = `PW Training Certificate ${RUN_ID}`
const ACHIEVEMENT_NAME = `PW First Aid ${RUN_ID}`
const RECIPIENTS = [
  { name: 'Ada Lovelace', email: `ada.studio.${RUN_ID}@recipient.test`, location: 'Vientiane' },
  { name: 'ສົມສະໄໝ ພົມມະວົງ', email: `lao.studio.${RUN_ID}@recipient.test`, location: 'Luang Prabang' },
]
const CSV = `name,email,Location\n${RECIPIENTS.map(r => `${r.name},${r.email},${r.location}`).join('\n')}\n`

let jwt = ''
let designId = ''
let achievementId = ''

test.describe.configure({ mode: 'serial' })

function designRow(name: string): { layout: any, org: string } {
  const row = sql(`
    select dt.layout_config || char(9) || coalesce(o.name, '')
    from design_templates dt
    left join design_templates_organization_lnk l on l.design_template_id = dt.id
    left join organizations o on o.id = l.organization_id
    where dt.name = '${name.replace(/'/g, '\'\'')}' and dt.published_at is not null;`)
  const [layout, org] = row.split('\t')
  return { layout: JSON.parse(layout || 'null'), org }
}

async function openEditor(page: Page, id: string) {
  await page.goto(`/design-templates/${id}`)
  await expect(page.getByText('Preparing fonts…')).toHaveCount(0, { timeout: 30000 })
  const skipTour = page.getByRole('button', { name: 'Skip tour' })
  if (await skipTour.isVisible().catch(() => false)) {
    await skipTour.click()
  }
}

/** Open a left-hand panel (clicking the active one would close it). */
async function openPanel(page: Page, name: string) {
  const button = page.getByRole('navigation', { name: 'Design tools' }).getByRole('button', { name, exact: true })
  if (await button.getAttribute('aria-pressed') !== 'true') {
    await button.click()
  }
  await expect(button).toHaveAttribute('aria-pressed', 'true')
}

test.describe('design studio', () => {
  test('a new organisation signs up and signs in', async ({ page }) => {
    await registerOrganisation(page, ORG)
    await confirmEmail(page, ORG.email)
    await signIn(page, ORG.email, ORG.password)
    jwt = await tokenFor(page)
    expect(jwt).not.toBe('')
  })

  test('the wizard turns a library template into the organisation\'s own design', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await page.goto('/design-templates')
    await expect(page.getByRole('heading', { name: 'Design Studio' })).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Create your first design')).toBeVisible()

    await page.getByTestId('new-design').click()
    await expect(page).toHaveURL(/\/design-templates\/create/)
    await waitForHydration(page)
    await page.getByTestId('wizard-certificate').click()
    await page.getByRole('button', { name: 'Training Completion' }).click()
    await page.getByTestId('wizard-next').click()
    await page.getByTestId('wizard-skip-brand').click()
    await expect(page.locator('#design-name')).toHaveValue('Training Completion')
    await fillField(page, '#design-name', DESIGN_NAME)
    await page.getByTestId('wizard-create').click()

    await expect(page).toHaveURL(/\/design-templates\/(?!create)[a-z0-9]+(?:\?|$)/, { timeout: 30000 })
    designId = new URL(page.url()).pathname.split('/').pop() ?? ''
    await expect(page.getByText('Preparing fonts…')).toHaveCount(0, { timeout: 30000 })
    // First visit: the tour offers itself, and can be skipped.
    await page.getByRole('button', { name: 'Skip tour' }).click()
    await expect(page.locator('[data-tour="canvas"] svg').first()).toBeVisible()

    // An editable copy owned by this organisation, with the brand baked in.
    const { layout, org } = designRow(DESIGN_NAME)
    expect(org).toBe(ORG.organizationName)
    expect(layout.kind).toBe('certificate')
    expect(layout.elements.length).toBeGreaterThan(10)
    expect(JSON.stringify(layout)).not.toContain('$brand')
    expect(JSON.stringify(layout)).toContain('{{recipient.name}}')
  })

  test('edits the design: add a heading, undo, redo, save', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await openEditor(page, designId)
    const before = designRow(DESIGN_NAME).layout.elements.length

    await openPanel(page, 'Text')
    await page.getByRole('button', { name: 'Add a heading' }).click()
    await expect(page.getByText('Unsaved changes')).toBeVisible()
    await page.getByTitle(/^Undo/).click()
    await page.getByTitle(/^Redo/).click()
    await page.locator('[data-tour="save"]').click()
    await expect(page.getByText('All changes saved')).toBeVisible({ timeout: 20000 })

    const after = designRow(DESIGN_NAME).layout
    expect(after.elements.length).toBe(before + 1)
    expect(JSON.stringify(after)).toContain('Add a heading')

    // Persisted: a reload shows the saved state, not a local draft prompt.
    await page.reload()
    await expect(page.getByText('Preparing fonts…')).toHaveCount(0, { timeout: 30000 })
    await expect(page.getByText('All changes saved')).toBeVisible()
    await expect(page.getByText('You have unsaved changes from your last visit.')).toHaveCount(0)
  })

  test('adds a custom attribute and places it on the design', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await openEditor(page, designId)

    await openPanel(page, 'Attributes')
    await page.getByRole('button', { name: 'Add custom attribute' }).click()
    await page.getByPlaceholder('e.g. Location, Training date').fill('Location')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    const row = page.locator('li', { hasText: 'Location' })
    await expect(row).toBeVisible({ timeout: 20000 })
    await row.getByRole('button', { name: 'Use' }).click()
    await page.locator('[data-tour="save"]').click()
    await expect(page.getByText('All changes saved')).toBeVisible({ timeout: 20000 })

    expect(sql(`
      select ca.key || '|' || ca.type from custom_attributes ca
      join custom_attributes_organization_lnk l on l.custom_attribute_id = ca.id
      join organizations o on o.id = l.organization_id
      where o.name = '${ORG.organizationName}';`)).toBe('location|text')
    expect(JSON.stringify(designRow(DESIGN_NAME).layout)).toContain('{{custom.location}}')
  })

  test('puts the design on an achievement and issues to a CSV with a custom column', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await page.goto('/achievements/create')
    await waitForHydration(page)
    await fillField(page, '#achievementName', ACHIEVEMENT_NAME)
    await fillField(page, '#achievementDescription', 'Awarded for completing first aid training.')
    await page.getByRole('radio', { name: 'Certificate' }).check()
    await fillField(page, '#achievementCriteria', 'Attended the full course and passed the practical.')
    // The organisation's only certificate design is offered by default;
    // otherwise pick it.
    const certificatePicker = page.getByRole('button', { name: new RegExp(`${DESIGN_NAME}|Classic Certrust certificate`) }).first()
    if (!(await certificatePicker.textContent())?.includes(DESIGN_NAME)) {
      await certificatePicker.click()
      await page.getByTitle(DESIGN_NAME).click()
    }
    await expect(page.getByRole('button', { name: new RegExp(`${DESIGN_NAME} Your design`) })).toBeVisible()
    await page.getByRole('button', { name: 'Create achievement' }).click()

    await expect(page).toHaveURL(/\/issue\?achievement=\d+/, { timeout: 20000 })
    achievementId = new URL(page.url()).searchParams.get('achievement') ?? ''
    expect(sql(`select certificate_design_id from achievements where id = ${achievementId};`)).toBe(designId)

    // The issue page offers the achievement's design and the custom column.
    await expect(page.getByText(DESIGN_NAME).first()).toBeVisible({ timeout: 20000 })
    await page.locator('#csv-upload').setInputFiles({ name: `studio-${RUN_ID}.csv`, mimeType: 'text/csv', buffer: Buffer.from(CSV, 'utf8') })
    await expect(page.getByText(`${RECIPIENTS.length} recipients loaded from CSV`)).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Custom columns found: Location')).toBeVisible()
    await page.getByRole('button', { name: 'Issue Certificates', exact: true }).click()
    await expect(page.getByText('Certificates issued successfully!')).toBeVisible({ timeout: 60000 })

    const rows = sql(`
      select c.custom_fields || char(9) || (length(c.certificate_design_snapshot) > 0) || char(9) || c.design_template_id
      from credentials c join credentials_achievement_lnk l on l.credential_id = c.id
      where l.achievement_id = ${achievementId} and c.published_at is not null order by c.id;`).split('\n')
    expect(rows).toHaveLength(RECIPIENTS.length)
    // Batch issuance runs in parallel, so rows are not in CSV order.
    const issued = rows.map((r) => {
      const [fields, hasSnapshot, templateId] = r.split('\t')
      return { ...JSON.parse(fields), hasSnapshot, templateId }
    }).sort((a, b) => a.location.localeCompare(b.location))
    expect(issued).toEqual(RECIPIENTS.map(r => ({ location: r.location, hasSnapshot: '1', templateId: designId }))
      .sort((a, b) => a.location.localeCompare(b.location)))
  })

  test('the issued certificate renders as PNG and PDF and ignores later template edits', async ({ request }) => {
    const credentialId = sql(`
      select c.credential_id from credentials c join credentials_achievement_lnk l on l.credential_id = c.id
      where l.achievement_id = ${achievementId} and c.published_at is not null order by c.id limit 1;`)
    const url = `${API}/api/credentials/${encodeURIComponent(credentialId)}/certificate`

    const png = await request.get(`${url}?format=png`)
    expect(png.status()).toBe(200)
    const before = await png.body()
    expect(before.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4E, 0x47]))
    const pdf = await request.get(`${url}?format=pdf`)
    expect(pdf.status()).toBe(200)
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF')

    // Edit the template: black background.
    const auth = { Authorization: `Bearer ${jwt}` }
    const layout = designRow(DESIGN_NAME).layout
    layout.background.color = '#000000'
    const put = await request.put(`${API}/api/design-templates/${designId}`, { headers: auth, data: { data: { layoutConfig: layout } } })
    expect(put.status()).toBe(200)

    const after = await (await request.get(`${url}?format=png`)).body()
    expect(after.equals(before)).toBe(true)
  })

  test('Premium templates are locked for a trial or free organisation', async ({ page }) => {
    await signIn(page, ORG.email, ORG.password)
    await page.goto('/design-templates?tab=library')
    const card = page.locator('article', { hasText: 'Formal Navy & Gold' })
    await expect(card.getByText('Premium')).toBeVisible({ timeout: 20000 })
    await card.getByRole('button', { name: 'Use this template' }).click()
    await expect(page.getByRole('heading', { name: 'Premium template' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'See plans' })).toBeVisible()
  })

  test('at the saved-design limit, New design asks to upgrade but existing designs still save', async ({ page, request }) => {
    const auth = { Authorization: `Bearer ${jwt}` }
    const limits = (await (await request.get(`${API}/api/design-templates/limits`, { headers: auth })).json()).data
    const column = limits.source as string
    const cmp = sql(`select cmp_id from tier_settings_cmps where field = '${column}';`)
    const original = sql(`select coalesce(design_template_limit, 'null') from components_settings_usage_limits where id = ${cmp};`)
    sql(`update components_settings_usage_limits set design_template_limit = ${limits.used} where id = ${cmp};`)
    try {
      await signIn(page, ORG.email, ORG.password)
      await page.goto('/design-templates')
      await expect(page.getByText(`${limits.used} of ${limits.used} saved designs`)).toBeVisible({ timeout: 20000 })
      await page.getByTestId('new-design').click()
      await expect(page.getByRole('heading', { name: 'You\'ve used all your saved designs' })).toBeVisible()
      await page.getByRole('button', { name: 'Not now' }).click()

      // Saving changes to a design the organisation already has is not a new design.
      await openEditor(page, designId)
      await openPanel(page, 'Text')
      await page.getByRole('button', { name: 'Add a subheading' }).click()
      await page.locator('[data-tour="save"]').click()
      await expect(page.getByText('All changes saved')).toBeVisible({ timeout: 20000 })
    }
    finally {
      sql(`update components_settings_usage_limits set design_template_limit = ${original} where id = ${cmp};`)
    }
  })
})
