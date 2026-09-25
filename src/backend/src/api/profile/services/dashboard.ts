/**
 * Per-issuer dashboard statistics.
 *
 * Queries credential/achievement tables for the given profile id and returns
 * aggregated counts suitable for the frontend profile dashboard. All counts are
 * scoped to the authenticated user's own profile so no cross-tenant data leaks.
 */

interface TopAchievement {
  id: number;
  name: string;
  count: number;
}

interface MonthlyIssuance {
  /** Calendar month in YYYY-MM form, this profile's local server time. */
  month: string;
  count: number;
}

export interface DashboardStats {
  /** Credentials this profile issued (published_at IS NOT NULL) */
  credentialsIssued: number;
  /** Issued credentials that have been revoked */
  credentialsRevoked: number;
  /** Issued credentials past their expirationDate (and not revoked) */
  credentialsExpired: number;
  /** Credentials where this profile is the recipient */
  credentialsReceived: number;
  /** Achievements created by this profile */
  achievementsCreated: number;
  /** Distinct recipient profiles across all issued credentials */
  uniqueRecipients: number;
  /** Top 5 achievements by number of credentials issued against them */
  topAchievements: TopAchievement[];
  /** ISO 8601 creation timestamp of the underlying users-permissions user */
  memberSince: string;
  /** This user's scheduled-issuance rows still pending (not yet issued/cancelled/failed) */
  scheduledCredentials: number;
  /**
   * documentIds issued by this profile that have a draft row but no
   * published row at all - NOT a naive `publishedAt: null` count. Every
   * normally-issued credential also has an auto-generated draft
   * shadow-row sharing its documentId (draftAndPublish's create behavior
   * - see api::organization.usage's header comment for the same
   * double-row hazard), so counting raw publishedAt: null rows would
   * count every issued credential's harmless shadow draft as if it were
   * itself an unpublished/incomplete credential.
   */
  draftCredentials: number;
  /** Trailing 12 calendar months (oldest first, including the current one), zero-filled, from published credentials' issuanceDate */
  issuanceByMonth: MonthlyIssuance[];
}

/**
 * Trailing 12 calendar-month buckets, oldest first, ending at (and
 * including) referenceDate's own month - zero-filled so issuanceByMonth
 * never has gaps for months with no issuances.
 */
function buildEmptyMonthBuckets(referenceDate: Date): MonthlyIssuance[] {
  const months: MonthlyIssuance[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, count: 0 });
  }
  return months;
}

export default ({ strapi }: { strapi: any }) => ({
  async getStats(userId: number, profileId: number): Promise<DashboardStats> {
    const now = new Date();

    // issuanceByMonth's zero-filled buckets, and the earliest date they
    // cover - computed up front so the query below can filter to exactly
    // that window.
    const monthBuckets = buildEmptyMonthBuckets(now);
    const bucketIndexByMonth = new Map(monthBuckets.map((b, i) => [b.month, i]));
    const earliestBucketStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // Run independent queries in parallel
    const [
      credentialsIssued,
      credentialsRevoked,
      credentialsExpired,
      credentialsReceived,
      achievementsCreated,
      issuedWithRecipient,
      topRaw,
      user,
      scheduledCredentials,
      draftRows,
      publishedRows,
      issuanceRows,
    ] = await Promise.all([
      // publishedAt: { $notNull: true } on every one of these, for the same
      // reason api::organization.usage documents at length: this is
      // strapi.db.query(), the low-level query engine below the Document
      // Service, and a draftAndPublish create writes *two* physical rows per
      // entry (a draft and a published copy sharing one documentId), each
      // with its own fully-attached relations. Without the filter both rows
      // match and every count comes back at exactly double. The queries
      // further down this same list already had it; these did not, so the
      // dashboard reported twice the credentials actually issued, received,
      // revoked and expired - and, because dashboard.vue feeds
      // credentialsIssued into the Plan Usage bar's numerator, a free-tier
      // organization saw "50 / 50, limit reached" after 25 real credentials.
      // (Enforcement itself was never wrong: the lifecycle hooks count
      // through api::organization.usage, which has always filtered.)
      strapi.db.query('api::credential.credential').count({
        where: { issuer: profileId, publishedAt: { $notNull: true } },
      }),
      strapi.db.query('api::credential.credential').count({
        where: { issuer: profileId, revoked: true, publishedAt: { $notNull: true } },
      }),
      strapi.db.query('api::credential.credential').count({
        where: {
          issuer: profileId,
          revoked: false,
          expirationDate: { $lt: now.toISOString() },
          publishedAt: { $notNull: true },
        },
      }),
      strapi.db.query('api::credential.credential').count({
        where: { recipient: profileId, publishedAt: { $notNull: true } },
      }),
      strapi.db.query('api::achievement.achievement').count({
        where: { creator: profileId, publishedAt: { $notNull: true } },
      }),
      // For uniqueRecipients we need distinct IDs - fetch minimal fields only
      strapi.db.query('api::credential.credential').findMany({
        where: { issuer: profileId, publishedAt: { $notNull: true } },
        populate: { recipient: { fields: ['id'] } },
        fields: ['id'],
      }),
      // Top achievements: group credentials by achievement id + name
      strapi.db.query('api::credential.credential').findMany({
        where: { issuer: profileId, publishedAt: { $notNull: true } },
        populate: { achievement: { fields: ['id', 'achievementName'] } },
        fields: ['id'],
      }),
      strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        select: ['createdAt'],
      }),
      // Scheduled (not yet issued/cancelled/failed) issuances this user scheduled.
      strapi.db.query('api::scheduled-issuance.scheduled-issuance').count({
        where: { scheduledById: userId, status: 'pending' },
      }),
      // draftCredentials: documentIds with a draft row (publishedAt: null) ...
      strapi.db.query('api::credential.credential').findMany({
        where: { issuer: profileId, publishedAt: null },
        select: ['documentId'],
      }),
      // ... minus documentIds that also have a published row (see
      // DashboardStats.draftCredentials's doc comment for why this can't
      // be a naive publishedAt: null count).
      strapi.db.query('api::credential.credential').findMany({
        where: { issuer: profileId, publishedAt: { $notNull: true } },
        select: ['documentId'],
      }),
      // issuanceByMonth: published credentials issued within the trailing-12-month window.
      strapi.db.query('api::credential.credential').findMany({
        where: {
          issuer: profileId,
          publishedAt: { $notNull: true },
          issuanceDate: { $gte: earliestBucketStart.toISOString() },
        },
        select: ['issuanceDate'],
      }),
    ]);

    // Unique recipients
    const recipientIds = new Set(
      (issuedWithRecipient as any[])
        .map((c) => c.recipient?.id)
        .filter(Boolean)
    );

    // Top achievements (up to 5)
    const achievementCounts = new Map<number, { name: string; count: number }>();
    for (const cred of topRaw as any[]) {
      const ach = cred.achievement;
      if (!ach?.id) continue;
      const entry = achievementCounts.get(ach.id);
      if (entry) {
        entry.count += 1;
      } else {
        achievementCounts.set(ach.id, {
          name: ach.achievementName || `Achievement ${ach.id}`,
          count: 1,
        });
      }
    }
    const topAchievements: TopAchievement[] = Array.from(achievementCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([id, { name, count }]) => ({ id, name, count }));

    // draftCredentials = draft-row documentIds minus published-row
    // documentIds (set difference) - see DashboardStats.draftCredentials's
    // doc comment.
    const publishedDocumentIds = new Set(
      (publishedRows as any[]).map((r) => r.documentId).filter((id) => id != null)
    );
    const draftOnlyDocumentIds = new Set(
      (draftRows as any[])
        .map((r) => r.documentId)
        .filter((id) => id != null && !publishedDocumentIds.has(id))
    );

    // issuanceByMonth - bucket each published credential's issuanceDate
    // into its calendar month; buckets outside the trailing-12-month
    // window were never fetched, so nothing to filter here.
    for (const row of issuanceRows as any[]) {
      if (!row.issuanceDate) continue;
      const d = new Date(row.issuanceDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const idx = bucketIndexByMonth.get(key);
      if (idx !== undefined) monthBuckets[idx].count += 1;
    }

    return {
      credentialsIssued,
      credentialsRevoked,
      credentialsExpired,
      credentialsReceived,
      achievementsCreated,
      uniqueRecipients: recipientIds.size,
      topAchievements,
      memberSince: user?.createdAt ?? new Date().toISOString(),
      scheduledCredentials,
      draftCredentials: draftOnlyDocumentIds.size,
      issuanceByMonth: monthBuckets,
    };
  },
});
