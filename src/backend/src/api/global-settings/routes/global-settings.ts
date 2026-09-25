/**
 * global-settings router
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::global-settings.global-settings', {
  config: {
    find: {
      auth: false
    }
    // singleTypes have no findOne. create/update/delete are intentionally
    // left out of this config, which keeps them on Strapi's implicit
    // default (authenticated, permission-checked). No role is granted
    // these actions in bootstrap/permissions-setup.ts, so this content can
    // only be edited from the admin panel's Content Manager (its own admin
    // RBAC, not this REST permissions system), never over the public API.
  }
})
