/**
 * Custom achievement routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/achievements/creator/:creatorId',
      handler: 'achievement.findByCreator',
      config: {
        auth: { strategies: ['users-permissions'] },
      },
    },
  ],
}
