/**
 * The consent screen behind "Connect Certrust" (website page
 * /oauth/authorize). Signed-in members only; API keys can't reach these.
 * The OAuth endpoints apps call themselves (/oauth/register, /oauth/token,
 * /.well-known/...) are mounted at the root by oauth/routes.ts.
 */
const auth = { strategies: ['users-permissions'] }

export default {
  routes: [
    { method: 'GET', path: '/oauth/consent', handler: 'oauth-client.describe', config: { auth } },
    { method: 'POST', path: '/oauth/consent', handler: 'oauth-client.decide', config: { auth } },
  ],
}
