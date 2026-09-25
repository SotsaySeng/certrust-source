export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'http://localhost:1337'),
  // Behind Cloudflare (or any reverse proxy) trust X-Forwarded-For, so
  // ctx.ip is the visitor rather than the proxy - otherwise the
  // users-permissions rate limit becomes one shared bucket for everyone.
  proxy: { koa: env.bool('IS_PROXIED', false) },
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
});
