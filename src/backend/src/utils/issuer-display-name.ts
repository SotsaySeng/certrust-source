/**
 * The name to show recipients for whoever issued a credential.
 *
 * An issuer is a profile, but for an organisation's issuing profile the
 * profile's own `name` is the admin's username (e.g. "lumen_admin" - it is
 * also that person's recipient profile, profileType 'Both'). The issuer a
 * recipient should see is the organisation ("Lumen Certification Academy"),
 * so prefer that whenever the profile belongs to one. Display-only: the
 * signed credential payload references the issuer by id, never by name.
 */
export function issuerDisplayName(
  profile: { name?: string | null; organization?: { name?: string | null } | null } | null | undefined,
  fallback = 'Certrust'
): string {
  return profile?.organization?.name?.trim() || profile?.name?.trim() || fallback
}
