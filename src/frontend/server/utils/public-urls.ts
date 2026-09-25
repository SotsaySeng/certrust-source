import type { H3Event } from 'h3'

/**
 * Public origins for the machine-readable discovery documents
 * (/auth.md, /.well-known/*).
 *
 * - `site`: this Nuxt app (serves auth.md, .well-known/*, agent skills).
 *   runtimeConfig.public.websiteUrl, i.e. NUXT_PUBLIC_WEBSITE_URL.
 * - `api`: the Strapi backend, a SEPARATE origin: REST under /api, admin
 *   panel under /admin, Swagger UI under /documentation.
 *   runtimeConfig.public.apiUrl, i.e. NUXT_PUBLIC_API_URL.
 *
 * Call it inside the request handler: on Cloudflare Workers, env/runtime
 * config is only available during a request, not at module load.
 */
export function publicUrls(event: H3Event) {
  const { public: pub } = useRuntimeConfig(event)
  const trim = (url: unknown, fallback: string) => String(url || fallback).replace(/\/+$/, '')
  return {
    site: trim(pub.websiteUrl, 'http://localhost:3000'),
    api: trim(pub.apiUrl, 'http://localhost:1337'),
  }
}
