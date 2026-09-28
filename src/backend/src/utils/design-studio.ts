/**
 * Shared server helpers for the Design Studio APIs (design-template,
 * design-asset, custom-attribute, brand-kit).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { errors } from '@strapi/utils'
import type { BrandKit, Design } from './design-core'
import { isEmptyDesign, sampleData, validateDesign } from './design-core'
import { renderDesignPng } from './design-render'
import { isPlatformAdminUser } from './platform-admin'

export interface CallerContext {
  userId: number
  profileId: number | null
  organizationId: number | null
  organization: any | null
  isPlatformAdmin: boolean
}

/** The caller's own profile + organization (published rows) and admin flag. */
export async function callerContext(userId: number): Promise<CallerContext> {
  const profiles: any[] = await strapi.entityService.findMany('api::profile.profile', {
    status: 'published',
    filters: { owner: { id: userId } },
    populate: ['organization'],
  } as any)
  const profile = (profiles || []).find((p: any) => p.organization) ?? profiles?.[0] ?? null
  return {
    userId,
    profileId: profile?.id ?? null,
    organizationId: profile?.organization?.id ?? null,
    organization: profile?.organization ?? null,
    isPlatformAdmin: await isPlatformAdminUser(userId),
  }
}

export async function orgBrandKit(organizationId: number | string | null): Promise<BrandKit | null> {
  if (organizationId == null) return null
  const kit: any = await strapi.db.query('api::brand-kit.brand-kit').findOne({
    where: { organization: organizationId },
  })
  if (!kit) return null
  return {
    logo: kit.logo,
    primary: kit.primary,
    secondary: kit.secondary,
    accent: kit.accent,
    headingFont: kit.headingFont,
    bodyFont: kit.bodyFont,
    signers: Array.isArray(kit.signers) ? kit.signers : [],
  }
}

/**
 * Validate a layoutConfig coming from a client. Returns the parsed design,
 * `null` for an intentionally empty design (`{}`), or throws a 400-able
 * ApplicationError with a readable message.
 */
export function parseDesignInput(input: unknown): Design | null {
  if (input == null || (typeof input === 'object' && !Array.isArray(input) && Object.keys(input as object).length === 0)) return null
  const r = validateDesign(input)
  if (!r.ok) {
    throw new errors.ValidationError(`Invalid design: ${r.error}`)
  }
  return r.design as Design
}

/** Upload a buffer through the upload plugin; returns the file row. */
export async function uploadBuffer(buffer: Buffer, filename: string, mimetype: string): Promise<any> {
  const tmp = path.join(os.tmpdir(), `certrust-${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`)
  await fs.promises.writeFile(tmp, buffer)
  try {
    const uploaded = await strapi.plugin('upload').service('upload').upload({
      data: { fileInfo: { name: filename, alternativeText: filename } },
      files: { filepath: tmp, originalFilename: filename, mimetype, size: buffer.length },
    })
    return Array.isArray(uploaded) ? uploaded[0] : uploaded
  }
  finally {
    fs.promises.unlink(tmp).catch(() => {})
  }
}

/**
 * Re-render a template's gallery thumbnail (sample data, default brand) and
 * attach it as previewImage. Written straight to every row of the document
 * (draft + published) with the query engine: going through
 * documents().update would republish the template under a new numeric id.
 * The previous thumbnail file is deleted. Never throws - a missing
 * thumbnail must not fail a save.
 */
export async function refreshDesignPreview(documentId: string): Promise<void> {
  try {
    const rows: any[] = await strapi.db.query('api::design-template.design-template').findMany({
      where: { documentId },
      populate: ['previewImage'],
    })
    const row = rows.find(r => r.publishedAt) ?? rows[0]
    if (!row || isEmptyDesign(row.layoutConfig)) return
    const r = validateDesign(row.layoutConfig)
    if (!r.ok) return
    const design = r.design as Design
    const png = await renderDesignPng(design, { data: sampleData(), width: design.kind === 'badge' ? 480 : 720 })
    const file = await uploadBuffer(png, `design-${documentId}.png`, 'image/png')
    if (!file?.id) return
    const old = new Set(rows.map(x => x.previewImage?.id).filter(Boolean))
    for (const x of rows) {
      await strapi.db.query('api::design-template.design-template').update({ where: { id: x.id }, data: { previewImage: file.id } })
    }
    for (const id of old) {
      if (id === file.id) continue
      const stillUsed = await strapi.db.query('api::design-template.design-template').count({ where: { previewImage: { id } } })
      if (stillUsed) continue
      const f = await strapi.db.query('plugin::upload.file').findOne({ where: { id } })
      if (f) await strapi.plugin('upload').service('upload').remove(f).catch(() => {})
    }
  }
  catch (err) {
    strapi.log.warn(`[design-studio] preview render failed for ${documentId}: ${(err as Error).message}`)
  }
}
