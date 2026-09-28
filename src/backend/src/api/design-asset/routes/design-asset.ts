/**
 * Design Studio images. Custom routes only (no core router): uploads go
 * through the sanitising upload action, never the generic create.
 */
const auth = { strategies: ['users-permissions'] }

export default {
  routes: [
    { method: 'GET', path: '/design-assets', handler: 'design-asset.list', config: { auth } },
    { method: 'POST', path: '/design-assets/upload', handler: 'design-asset.upload', config: { auth } },
    { method: 'PUT', path: '/design-assets/:id', handler: 'design-asset.rename', config: { auth } },
    { method: 'DELETE', path: '/design-assets/:id', handler: 'design-asset.remove', config: { auth } },
  ],
}
