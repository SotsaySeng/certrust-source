/** The caller's organization's brand kit (one per organization). */
const auth = { strategies: ['users-permissions'] }

export default {
  routes: [
    { method: 'GET', path: '/brand-kit', handler: 'brand-kit.mine', config: { auth } },
    { method: 'PUT', path: '/brand-kit', handler: 'brand-kit.save', config: { auth } },
    { method: 'POST', path: '/brand-kit/suggest-colors', handler: 'brand-kit.suggestColors', config: { auth } },
  ],
}
