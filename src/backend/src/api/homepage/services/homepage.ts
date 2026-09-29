/**
 * homepage service
 */

import { factories } from '@strapi/strapi'

export interface PlatformCounts {
  organizations: number
  achievements: number
  events: number
  credentials: number
}

/**
 * Four COUNT(*)s over tables that only ever grow, behind a page that is hit on
 * every marketing visit. Module-level state is safe here for exactly the reason
 * api/billing/controllers/billing.ts's plansCache documents: the API runs as a
 * single container instance.
 *
 * 5 minutes rather than billing's 10 - these numbers move continuously (every
 * issuance bumps one) where Stripe prices essentially never change. This caps
 * the database cost at four counts per 5 minutes regardless of traffic while
 * still feeling live.
 *
 * Only the COUNTS are cached. The gate configuration (statsEnabled /
 * statsMinimumCount) is deliberately read fresh on every request in
 * controllers/homepage.ts, so an admin toggling the strip sees the effect on
 * the very next page load instead of waiting out this TTL.
 */
const COUNTS_TTL_MS = 5 * 60 * 1000
let countsCache: { at: number; value: PlatformCounts } | null = null

export default factories.createCoreService('api::homepage.homepage', ({ strapi }) => ({
  /**
   * Platform-wide totals for the marketing homepage's stats strip.
   *
   * publishedAt: { $notNull: true } on every one of these is mandatory, not
   * tidiness - the same trap documented at length in
   * api/organization/services/usage.ts and api/profile/services/dashboard.ts.
   * All four of these content types are draftAndPublish: true, and a create
   * writes TWO physical rows per entry (a draft and a published copy sharing
   * one documentId). strapi.db.query is the low-level query engine below the
   * Document Service and has no notion of status, so without this filter every
   * number on the public homepage would be exactly double the truth.
   *
   * No status filtering beyond that, by product decision: "Organizations"
   * therefore includes organizations with closedAt or suspendedAt set, and
   * "Credentials issued" includes revoked ones (issued is issued). That is
   * intentional - do not "fix" it without checking, and note it deliberately
   * differs from the per-issuer dashboard counts, which do filter on revoked.
   *
   * This is the one cross-tenant read in the codebase: every other
   * organization-touching path is scoped to the caller's org. It returns
   * scalars only - no names, no documentIds - so nothing tenant-identifying
   * can leak through it.
   */
  async getPlatformCounts(): Promise<PlatformCounts> {
    if (countsCache && Date.now() - countsCache.at < COUNTS_TTL_MS) {
      return countsCache.value
    }

    // Each `where` is written out separately rather than hoisting one shared
    // object - Strapi's query layer is free to mutate what it is handed.
    const [organizations, achievements, events, credentials] = await Promise.all([
      strapi.db.query('api::organization.organization').count({
        where: { publishedAt: { $notNull: true } },
      } as any),
      strapi.db.query('api::achievement.achievement').count({
        where: { publishedAt: { $notNull: true } },
      } as any),
      strapi.db.query('api::event.event').count({
        where: { publishedAt: { $notNull: true } },
      } as any),
      strapi.db.query('api::credential.credential').count({
        where: { publishedAt: { $notNull: true } },
      } as any),
    ])

    const value: PlatformCounts = { organizations, achievements, events, credentials }
    countsCache = { at: Date.now(), value }
    return value
  },
}))
