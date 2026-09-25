/**
 * Custom routes for authenticated credential access
 */

export default {
  routes: [
    // Authenticated route for getting all credentials
    {
      method: 'GET',
      path: '/credentials',
      handler: 'credential.find',
      config: {
        auth: {
          strategies: ['users-permissions']
        }
      }
    },
    // Authenticated route for creating a credential
    {
      method: 'POST',
      path: '/credentials',
      handler: 'credential.create',
      config: {
        auth: {
          strategies: ['users-permissions']
        },
        policies: [
          { name: 'global::is-in-organization', config: { via: 'body', field: 'issuer' } },
        ],
      }
    },
    // Authenticated route for updating a credential
    {
      method: 'PUT',
      path: '/credentials/:id',
      handler: 'credential.update',
      config: {
        auth: {
          strategies: ['users-permissions']
        },
        policies: [
          { name: 'global::is-in-organization', config: { via: 'existing', uid: 'api::credential.credential', field: 'issuer' } },
        ],
      }
    },
    // Authenticated route for deleting a credential
    {
      method: 'DELETE',
      path: '/credentials/:id',
      handler: 'credential.delete',
      config: {
        auth: {
          strategies: ['users-permissions']
        },
        policies: [
          { name: 'global::is-in-organization', config: { via: 'existing', uid: 'api::credential.credential', field: 'issuer' } },
        ],
      }
    },
    // Authenticated route for issuing a credential. `issue` has no
    // `issuer` field of its own in the body (the target achievement's own
    // creator becomes the credential's issuer - see credential.ts
    // controller/service) - resolve organization membership through the
    // achievement instead, the same one-hop shape evidence's routes
    // already use for evidence.credential -> credential.issuer. Without
    // this, any authenticated user could issue a credential "from" any
    // other organization's achievement.
    {
      method: 'POST',
      path: '/credentials/issue',
      handler: 'credential.issue',
      config: {
        auth: {
          strategies: ['users-permissions']
        },
        policies: [
          { name: 'global::is-in-organization', config: { via: 'body', field: 'achievementId', through: { uid: 'api::achievement.achievement', field: 'creator' } } },
        ],
      }
    },
    // Recipient or issuing organisation makes a credential public/private.
    // Ownership is checked in the controller (either side may call it).
    {
      method: 'PUT',
      path: '/credentials/:id/visibility',
      handler: 'credential.setVisibility',
      config: {
        auth: {
          strategies: ['users-permissions']
        }
      }
    },
    // Authenticated route for exporting a credential
    {
      method: 'GET',
      path: '/credentials/:id/export',
      handler: 'credential.export',
      config: {
        auth: {
          strategies: ['users-permissions']
        }
      }
    },
    // Authenticated route for importing a credential
    {
      method: 'POST',
      path: '/credentials/import',
      handler: 'credential.import',
      config: {
        auth: {
          strategies: ['users-permissions']
        }
      }
    },
    // Authenticated route for revoking a credential
    {
      method: 'POST',
      path: '/credentials/:id/revoke',
      handler: 'credential.revoke',
      config: {
        auth: {
          strategies: ['users-permissions']
        }
      }
    },
    // Authenticated route for batch issuing credentials. Same
    // achievement-scoped policy as /credentials/issue above, and for the
    // same reason.
    {
      method: 'POST',
      path: '/credentials/batch-issue',
      handler: 'credential.batchIssue',
      config: {
        auth: {
          strategies: ['users-permissions']
        },
        policies: [
          { name: 'global::is-in-organization', config: { via: 'body', field: 'achievementId', through: { uid: 'api::achievement.achievement', field: 'creator' } } },
        ],
      }
    },
    // Authenticated route for renewing a credential (re-issue with new expiration)
    {
      method: 'POST',
      path: '/credentials/:id/renew',
      handler: 'credential.renew',
      config: {
        auth: {
          strategies: ['users-permissions']
        }
      }
    },
    // Admin-only route to manually trigger the expiration notification scan
    {
      method: 'POST',
      path: '/credentials/expiration-check',
      handler: 'credential.expirationCheck',
      config: {
        auth: {
          strategies: ['users-permissions']
        }
      }
    }
  ]
} 