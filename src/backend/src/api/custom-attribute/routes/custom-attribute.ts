/** Organization-scoped custom recipient attributes (Design Studio "Attributes" panel, issue form, CSV columns). */
const auth = { strategies: ['users-permissions'] }

export default {
  routes: [
    { method: 'GET', path: '/custom-attributes', handler: 'custom-attribute.list', config: { auth } },
    { method: 'POST', path: '/custom-attributes', handler: 'custom-attribute.add', config: { auth } },
    { method: 'PUT', path: '/custom-attributes/:id', handler: 'custom-attribute.edit', config: { auth } },
    { method: 'DELETE', path: '/custom-attributes/:id', handler: 'custom-attribute.remove', config: { auth } },
  ],
}
