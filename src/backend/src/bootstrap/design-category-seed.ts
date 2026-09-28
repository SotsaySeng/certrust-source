/**
 * Seeds the Design Studio's template gallery categories once (admin-editable
 * afterwards under Content Manager > Design Category).
 */
const DEFAULT_CATEGORIES = [
  'Education',
  'Training & Courses',
  'Corporate',
  'Events & Participation',
  'Awards & Excellence',
  'Appreciation',
  'Health & Safety',
  'Membership',
]

export async function seedDesignCategories(strapi: any): Promise<void> {
  try {
    const count = await strapi.db.query('api::design-category.design-category').count()
    if (count > 0) return
    for (const [i, name] of DEFAULT_CATEGORIES.entries()) {
      const slug = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      await strapi.documents('api::design-category.design-category').create({ data: { name, slug, sortOrder: i } } as any)
    }
    strapi.log.info(`[Seed] Design categories seeded (${DEFAULT_CATEGORIES.length}).`)
  }
  catch (error) {
    strapi.log.error(`[Seed] Error seeding design categories: ${error instanceof Error ? error.message : String(error)}`)
  }
}
