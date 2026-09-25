/**
 * org-type router
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::org-type.org-type', {
  config: {
    find: {
      auth: false
    },
    findOne: {
      auth: false
    }
    // create/update/delete are intentionally left out of this config, which
    // keeps them on Strapi's implicit default (authenticated, permission-
    // checked). No role - public, authenticated, or otherwise - is granted
    // these actions in bootstrap/permissions-setup.ts, so org types can only
    // be created/edited/deleted from the admin panel (Content Manager, which
    // uses its own admin RBAC, not this REST permissions system), never over
    // the public API. Admin-panel-only by omission.
  }
})
