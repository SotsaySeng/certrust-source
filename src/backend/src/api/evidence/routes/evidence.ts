/**
 * evidence router
 */

import { factories } from '@strapi/strapi'

// Evidence has no profile field of its own - it only carries a
// `credential` relation, so tenancy is resolved through one extra hop:
// evidence.credential -> credential.issuer -> profile. See
// src/policies/is-in-organization.ts.
export default factories.createCoreRouter('api::evidence.evidence', {
  config: {
    create: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        {
          name: 'global::is-in-organization',
          config: {
            via: 'body',
            field: 'credential',
            through: { uid: 'api::credential.credential', field: 'issuer' },
          },
        },
      ],
    },
    update: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        {
          name: 'global::is-in-organization',
          config: {
            via: 'existing',
            uid: 'api::evidence.evidence',
            field: 'credential',
            through: { uid: 'api::credential.credential', field: 'issuer' },
          },
        },
      ],
    },
    delete: {
      auth: { strategies: ['users-permissions'] },
      policies: [
        {
          name: 'global::is-in-organization',
          config: {
            via: 'existing',
            uid: 'api::evidence.evidence',
            field: 'credential',
            through: { uid: 'api::credential.credential', field: 'issuer' },
          },
        },
      ],
    },
  },
})