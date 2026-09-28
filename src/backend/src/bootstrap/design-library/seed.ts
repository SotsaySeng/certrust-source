/**
 * Seeds the Design Studio's starter library: system templates (gallery)
 * and system elements (Elements panel), both with no organization.
 *
 * Each item is seeded once, tracked by slug in the core store, so:
 *  - a restart after a partial run picks up where it left off;
 *  - templates/elements a platform admin later edits or deletes are never
 *    recreated or overwritten;
 *  - items added to templates.ts / elements.ts in a later release are
 *    seeded on the next boot.
 * Set DESIGN_LIBRARY_SEED=false to skip it (e.g. for a lean test database).
 */
import { refreshDesignPreview, uploadBuffer } from '../../utils/design-studio'
import { SYSTEM_ELEMENTS } from './elements'
import { SYSTEM_TEMPLATES } from './templates'

const DT = 'api::design-template.design-template'
const ASSET = 'api::design-asset.design-asset'
const CATEGORY = 'api::design-category.design-category'

interface SeedState {
  templates: string[]
  elements: string[]
}

export async function seedDesignLibrary(strapi: any): Promise<void> {
  if (String(process.env.DESIGN_LIBRARY_SEED ?? '').toLowerCase() === 'false') return
  const store = strapi.store({ type: 'core', name: 'design-studio', key: 'library-seed' })
  try {
    const saved: Partial<SeedState> = (await store.get()) || {}
    const state: SeedState = { templates: saved.templates ?? [], elements: saved.elements ?? [] }
    const save = () => store.set({ value: state })

    const pendingTemplates = SYSTEM_TEMPLATES.filter(t => !state.templates.includes(t.slug))
    const pendingElements = SYSTEM_ELEMENTS.filter(e => !state.elements.includes(e.slug))
    if (!pendingTemplates.length && !pendingElements.length) return
    strapi.log.info(`[Seed] Design library: seeding ${pendingTemplates.length} templates and ${pendingElements.length} elements...`)

    const categories: any[] = await strapi.db.query(CATEGORY).findMany({ select: ['documentId', 'slug'] })
    const categoryBySlug = new Map(categories.map(c => [c.slug, c.documentId]))

    for (const [i, t] of SYSTEM_TEMPLATES.entries()) {
      if (state.templates.includes(t.slug)) continue
      const exists = await strapi.db.query(DT).count({ where: { slug: t.slug } })
      if (!exists) {
        const categoryId = categoryBySlug.get(t.category)
        const created = await strapi.documents(DT).create({
          data: {
            name: t.name,
            description: t.description,
            slug: t.slug,
            type: t.design.kind,
            kind: t.design.kind,
            orientation: t.design.page.orientation,
            schemaVersion: t.design.version,
            layoutConfig: t.design,
            isPremium: t.isPremium,
            isDefault: false,
            sortOrder: i,
            organization: null,
            ...(categoryId ? { category: { connect: [{ documentId: categoryId }] } } : {}),
          },
          status: 'published',
        } as any)
        await refreshDesignPreview(created.documentId)
      }
      state.templates.push(t.slug)
      await save()
    }

    for (const [i, e] of SYSTEM_ELEMENTS.entries()) {
      if (state.elements.includes(e.slug)) continue
      const file = await uploadBuffer(Buffer.from(e.svg), `element-${e.slug}.svg`, 'image/svg+xml')
      await strapi.documents(ASSET).create({
        data: { name: e.name, file: file.id, kind: 'element', elementCategory: e.category, width: e.w, height: e.h, sortOrder: i, organization: null },
      } as any)
      state.elements.push(e.slug)
      await save()
    }
    strapi.log.info('[Seed] Design library seeded.')
  }
  catch (error) {
    strapi.log.error(`[Seed] Error seeding the design library: ${error instanceof Error ? error.message : String(error)}`)
  }
}
