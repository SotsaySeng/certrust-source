/**
 * event router
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::event.event', {
  config: {
    find: {
      auth: { strategies: ['users-permissions', 'api-key'] }
    },
    findOne: {
      auth: { strategies: ['users-permissions', 'api-key'] }
    },
    create: {
      auth: { strategies: ['users-permissions', 'api-key'] }
    },
    update: {
      auth: { strategies: ['users-permissions', 'api-key'] }
    },
    delete: {
      auth: { strategies: ['users-permissions'] }
    }
  }
})
