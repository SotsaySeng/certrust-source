/**
 * design-template router
 *
 * All actions already require real auth (below). Organization scoping -
 * both read (find) and write (create/update/delete) - is enforced in
 * controllers/design-template.ts instead of a `global::is-in-organization`
 * route policy here: that policy (src/policies/is-in-organization.ts) is
 * built to resolve down to a *profile* id and can't be configured to
 * stop one hop earlier at design-template's *direct* `organization`
 * relation without a code change to the policy itself - see the
 * controller's header comment for the full verified reasoning.
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::design-template.design-template', {
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
