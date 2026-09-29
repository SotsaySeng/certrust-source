/**
 * homepage controller
 */

import { factories } from '@strapi/strapi'
import type { PlatformCounts } from '../services/homepage'

interface StatItem {
  key: 'organizations' | 'achievements' | 'events' | 'credentials'
  label: string
  value: number
}

/**
 * Decide whether the live platform-stats strip is published, and build its
 * payload if so.
 *
 * The gate is enforced HERE, server-side, rather than with a v-if in the Nuxt
 * component. Hiding the numbers in the frontend would still ship them inside
 * the SSR payload for anyone to read out of the page source, which defeats the
 * entire point of having a minimum: on a young install the counts are exactly
 * what we do not want to advertise. When the gate is shut this returns null and
 * no count appears anywhere in the response.
 *
 * Every failure path returns null (fail closed), so the worst case is the
 * homepage rendering exactly as it did before this feature existed.
 */
async function buildStats(strapi: any, cfg: any): Promise<{ heading: string; items: StatItem[] } | null> {
  // `!== true`, not `!== false`: records created before these columns existed
  // hold NULL, and NULL must mean OFF. An install whose seed back-fill failed
  // should stay as it was, never publish a strip of unlabelled numbers.
  if (!cfg || cfg.statsEnabled !== true) {
    return null
  }

  // Clamp to >= 1 so a legacy NULL or a hand-typed 0 can never publish
  // "Organizations - 0". The schema deliberately carries no `min` (see its
  // description); this is the real guard.
  const minimum = Math.max(1, Number(cfg.statsMinimumCount) || 1)

  let counts: PlatformCounts
  try {
    counts = await strapi.service('api::homepage.homepage').getPlatformCounts()
  }
  catch (error) {
    // A failed count must never 500 the public homepage - drop the strip and
    // serve the CMS content, which is the rest of the response.
    const message = error instanceof Error ? error.message : String(error)
    strapi.log.warn(`[homepage.find] Platform stats unavailable, omitting strip: ${message}`)
    return null
  }

  const items: StatItem[] = [
    { key: 'organizations', label: cfg.statsOrganizationsLabel, value: counts.organizations },
    { key: 'achievements', label: cfg.statsAchievementsLabel, value: counts.achievements },
    { key: 'events', label: cfg.statsEventsLabel, value: counts.events },
    { key: 'credentials', label: cfg.statsCredentialsLabel, value: counts.credentials },
  ]

  // All four must clear the minimum, not just one: a strip rendering 3 of 4
  // metrics reads as broken. A blank label means the back-fill never ran on
  // this install, so hide the whole thing rather than show a number with
  // nothing naming it.
  if (items.some(item => item.value < minimum || !item.label)) {
    return null
  }

  return { heading: cfg.statsHeading ?? '', items }
}

export default factories.createCoreController('api::homepage.homepage', ({ strapi }) => ({
  /**
   * The counts ride along on the existing public GET /api/homepage rather than
   * living on their own endpoint. Three reasons: this route already has
   * auth: false and 'api::homepage.homepage.find' is already in
   * PUBLIC_PERMISSIONS (a separate route would hit the implicit auth.scope
   * trap documented in api/organization/routes/organization-usage.ts); the
   * homepage does exactly one SSR fetch today and a second endpoint would add
   * a serial round trip to the marketing page's LCP; and the gate config plus
   * the labels live on this very record anyway.
   *
   * The payload goes on `meta`, never `data` - these are computed values, not
   * attributes of the singleType, and meta cannot collide with a future real
   * attribute. super.find() has already sanitized `data` by this point, so
   * nothing added here is touched.
   */
  async find(ctx: any) {
    const result: any = await super.find(ctx)
    if (!result?.data) {
      // Nothing seeded yet - leave the response exactly as the core action
      // built it.
      return result
    }

    // Re-read through the Document Service rather than reaching into
    // result.data: statsEnabled and statsMinimumCount are `private`, so
    // sanitizeOutput has already stripped them from the response. The Document
    // Service does not sanitize, so they come back here. One primary-key read
    // on a single-row table - and keeping it OUT of the service's 5-minute
    // count cache is what makes an admin's toggle take effect on the very next
    // page load.
    const cfg: any = await strapi.documents('api::homepage.homepage').findFirst()

    result.meta = { ...(result.meta ?? {}), stats: await buildStats(strapi, cfg) }
    return result
  },
}))
