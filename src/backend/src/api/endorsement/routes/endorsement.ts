/**
 * endorsement router
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::endorsement.endorsement', {
  config: {
    find: {
      middlewares: [],
    },
    findOne: {},
    create: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        { name: 'global::is-in-organization', config: { via: 'body', field: 'endorser' } },
      ],
    },
    update: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        { name: 'global::is-in-organization', config: { via: 'existing', uid: 'api::endorsement.endorsement', field: 'endorser' } },
      ],
    },
    delete: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        { name: 'global::is-in-organization', config: { via: 'existing', uid: 'api::endorsement.endorsement', field: 'endorser' } },
      ],
    },
  },
})