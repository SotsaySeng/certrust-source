export default {
  routes: [
    {
      method: 'GET',
      path: '/achievements/:id/credentials',
      handler: 'achievement.findWithCredentials',
      // Lists every recipient of the achievement (names, emails): issuer only.
      config: {
        auth: {
          strategies: ['users-permissions'],
        },
      },
    },
  ],
} 