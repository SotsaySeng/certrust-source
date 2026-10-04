/**
 * Background issuance jobs. Creating one is checked like batch-issue: the
 * achievement must belong to the caller's organization.
 */
import { API_KEY_AUTH } from '../../../utils/api-key-access'

export default {
  routes: [
    {
      method: 'POST',
      path: '/issuance-jobs',
      handler: 'issuance-job.create',
      config: {
        auth: API_KEY_AUTH,
        policies: [
          { name: 'global::is-in-organization', config: { via: 'body', field: 'achievementId', through: { uid: 'api::achievement.achievement', field: 'creator' } } },
        ],
      },
    },
    { method: 'GET', path: '/issuance-jobs', handler: 'issuance-job.list', config: { auth: API_KEY_AUTH } },
    { method: 'GET', path: '/issuance-jobs/:id', handler: 'issuance-job.get', config: { auth: API_KEY_AUTH } },
    { method: 'POST', path: '/issuance-jobs/:id/cancel', handler: 'issuance-job.cancel', config: { auth: API_KEY_AUTH } },
  ],
}
