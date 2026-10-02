/**
 * Evidence links to its credential one way (evidence.credential), so a
 * credential's evidence is queried rather than populated. A two-way link
 * is wiped whenever Strapi republishes the credential.
 */
export async function attachEvidence<T extends { id?: number | string, evidence?: any[] }>(
  strapi: any,
  credentials: T[],
): Promise<T[]> {
  const ids = credentials.map(c => c?.id).filter(id => id != null)
  if (!ids.length) return credentials
  const rows = await strapi.db.query('api::evidence.evidence').findMany({
    where: { credential: { id: { $in: ids } }, publishedAt: { $notNull: true } },
    populate: ['credential'],
  })
  const byCredential = new Map<string, any[]>()
  for (const { credential, ...row } of rows) {
    const key = String(credential?.id)
    byCredential.set(key, [...(byCredential.get(key) ?? []), row])
  }
  for (const c of credentials) {
    if (c) c.evidence = byCredential.get(String(c.id)) ?? []
  }
  return credentials
}
