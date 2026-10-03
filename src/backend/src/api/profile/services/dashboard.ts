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
  /** Credentials this profile issued */
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
      issuanceRows,
    ] = await Promise.all([
      strapi.db.query('api::credential.credential').count({
        where: { issuer: profileId },
      }),
      strapi.db.query('api::credential.credential').count({
        where: { issuer: profileId, revoked: true },
      }),
      strapi.db.query('api::credential.credential').count({
        where: {
          issuer: profileId,
          revoked: false,
          expirationDate: { $lt: now.toISOString() },
        },
      }),
      strapi.db.query('api::credential.credential').count({
        where: { recipient: profileId },
      }),
      strapi.db.query('api::achievement.achievement').count({
        where: { creator: profileId },
      }),
      // For uniqueRecipients we need distinct IDs - fetch minimal fields only
      strapi.db.query('api::credential.credential').findMany({
        where: { issuer: profileId },
        populate: { recipient: { fields: ['id'] } },
        fields: ['id'],
      }),
      // Top achievements: group credentials by achievement id + name
      strapi.db.query('api::credential.credential').findMany({
        where: { issuer: profileId },
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
      // issuanceByMonth: published credentials issued within the trailing-12-month window.
      strapi.db.query('api::credential.credential').findMany({
        where: {
          issuer: profileId,
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
      issuanceByMonth: monthBuckets,
    };
  },
});
