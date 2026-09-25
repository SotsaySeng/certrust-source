/**
 * event router
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::event.event', {
  config: {
    find: {
      auth: { strategies: ['users-permissions'] }
    },
    findOne: {
      auth: { strategies: ['users-permissions'] }
    },
    create: {
      auth: { strategies: ['users-permissions'] }
    },
    update: {
      auth: { strategies: ['users-permissions'] }
    },
    delete: {
      auth: { strategies: ['users-permissions'] }
    }
  }
})
