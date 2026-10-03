/**
 * Organization API keys. Managing keys needs a signed-in member; only
 * GET /api-keys/me accepts a key (see utils/api-key-access.ts).
 */
import { API_KEY_AUTH } from '../../../utils/api-key-access'

const auth = { strategies: ['users-permissions'] }

export default {
  routes: [
    { method: 'GET', path: '/api-keys/me', handler: 'api-key.me', config: { auth: API_KEY_AUTH } },
    { method: 'GET', path: '/api-keys', handler: 'api-key.list', config: { auth } },
    { method: 'POST', path: '/api-keys', handler: 'api-key.create', config: { auth } },
    { method: 'POST', path: '/api-keys/:id/revoke', handler: 'api-key.revoke', config: { auth } },
  ],
}
