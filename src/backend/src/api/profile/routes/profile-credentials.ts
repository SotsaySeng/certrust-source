export default {
  routes: [
    {
      method: 'GET',
      path: '/profiles/:id/issued-credentials',
      handler: 'profile.findIssuedCredentials',
      config: {
        auth: {
          strategies: ['users-permissions', 'api-key']
        },
      },
    },
    {
      method: 'GET',
      path: '/profiles/:id/received-credentials',
      handler: 'profile.findReceivedCredentials',
      config: {
        auth: {
          strategies: ['users-permissions']
        },
      },
    },
  ],
} 