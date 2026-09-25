/**
 * GET /.well-known/oauth-protected-resource
 *
 * OAuth 2.0 Protected Resource Metadata per RFC 9728.
 * Tells agents which authorization server issues tokens for Certrust's API.
 * https://www.rfc-editor.org/rfc/rfc9728
 */
export default defineEventHandler((event) => {
  const { site, api } = publicUrls(event)
  return {
    resource: `${api}/api`,
    // The authorization server metadata is served by this site
    // (/.well-known/oauth-authorization-server), so this site is its issuer.
    authorization_servers: [
      site,
    ],
    // Strapi uses bearer tokens — API tokens or user JWTs
    bearer_methods_supported: ['header'],
    scopes_supported: [
      'credential:read',
      'credential:write',
      'credential:revoke',
      'achievement:read',
      'achievement:write',
      'profile:read',
      'profile:export',
    ],
    resource_documentation: `${api}/documentation`,
    resource_signing_alg_values_supported: ['HS256', 'RS256'],
  }
})
