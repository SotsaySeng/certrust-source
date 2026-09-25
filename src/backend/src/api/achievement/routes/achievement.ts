/**
 * achievement router
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::achievement.achievement', {
  config: {
    find: {
      auth: false
    },
    findOne: {
      auth: false
    },
    // create/update/delete used to be auth: false (fully public) - fixed
    // as part of the multi-tenancy rollout (see src/policies/is-in-organization.ts).
    create: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        { name: 'global::is-in-organization', config: { via: 'body', field: 'creator' } },
      ],
    },
    update: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        { name: 'global::is-in-organization', config: { via: 'existing', uid: 'api::achievement.achievement', field: 'creator' } },
      ],
    },
    delete: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        { name: 'global::is-in-organization', config: { via: 'existing', uid: 'api::achievement.achievement', field: 'creator' } },
      ],
    }
  }
})