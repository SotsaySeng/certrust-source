/** Template gallery categories: public read, managed in Strapi /admin. */
import { factories } from '@strapi/strapi'

export default factories.createCoreRouter('api::design-category.design-category', {
  only: ['find', 'findOne'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
})
