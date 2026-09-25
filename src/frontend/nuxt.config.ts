// https://nuxt.com/docs/api/configuration/nuxt-config
import { defineNuxtConfig } from 'nuxt/config'

// Public site URL, fixed at build time (constants/index.ts's WEBSITE_URL reads
// the same variable). deploy/cloudflare/deploy.sh sets it for production.
const websiteUrl = process.env.NUXT_PUBLIC_WEBSITE_URL || 'http://localhost:3000'

export default defineNuxtConfig({
  compatibilityDate: '2025-06-12',
  devtools: { enabled: false },
  modules: [
    '@nuxt/test-utils/module',
    '@nuxtjs/color-mode',
    '@pinia/nuxt',
    '@una-ui/nuxt',
    '@unocss/nuxt',
    'nuxt-svgo',
    '@nuxt/image',
    '@nuxt/icon',
    '@vueuse/motion/nuxt',
    // Google Analytics 4 loads only after the visitor accepts it in the
    // cookie banner (components/CookieConsent.vue), with Consent Mode v2
    // defaults of "denied", and never on credential verification pages -
    // see the Privacy Policy s.7. No ID = no analytics at all.
    ['nuxt-gtag', {
      id: process.env.NUXT_PUBLIC_GA4_ID || '',
      initMode: 'manual',
      initCommands: [
        ['consent', 'default', {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'denied',
        }],
      ],
      config: {
        send_page_view: true,
      },
      debug: false,
    }],
    ['@nuxtjs/sitemap', {
      hostname: websiteUrl,
      gzip: true,
      trailingSlash: false,
      // Static routes always in sitemap. Credential pages are deliberately
      // absent: they carry people's names and are noindex (Privacy Policy s.4).
      staticRoutes: ['/', '/verify', '/login'],
      exclude: ['/credentials/**'],
    }],
  ],
  svgo: {
    autoImportPath: './assets/svg/'
  },
  colorMode: {
    preference: 'light',
    fallback: 'light',
  },
  icon: {
    // Only what <BaseIcon>/<Icon> actually renders server-side (all
    // heroicons today; `i-*` utility classes come from UnoCSS at build time).
    // Bundling all five sets made the Cloudflare Worker ~9 MB, mostly
    // simple-icons, which slows every cold start. Anything else still
    // renders - @nuxt/icon fetches it client-side.
    serverBundle: {
      collections: ['heroicons']
    }
  },
  // Only `preflight` belongs here. @unocss/nuxt resolves this whole block
  // into an options object it passes as `defaults` into @unocss/config's
  // loadConfig(), which then does `Object.assign(defaults, result.config)`
  // once it finds the standalone uno.config.ts below (verified directly
  // against node_modules/@unocss/config/dist/index.mjs) - a shallow,
  // top-level merge, so any key uno.config.ts also sets (presets, which
  // subsumes icons/collections, and safelist) fully replaces this block's
  // value rather than merging with it. `preflight` is the one exception:
  // @unocss/nuxt reads it directly off the raw Nuxt options before that
  // merge ever runs (node_modules/@unocss/nuxt/dist/index.mjs's
  // addPluginTemplate step), so it's the only key here that does anything.
  // Add icons/safelist/presets/theme to uno.config.ts, not here.
  unocss: {
    preflight: true,
  },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'manifest', href: '/site.webmanifest' },

        { rel: 'canonical', href: websiteUrl },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
        },
      ],
      htmlAttrs: {
        // lang is updated dynamically per-request in app.vue via useHead()
        lang: 'en'
      }
    }
  },
  // constants/index.ts reads import.meta.env.NUXT_PUBLIC_WEBSITE_URL, but
  // Vite only exposes VITE_* variables there, so WEBSITE_URL silently fell
  // back to http://localhost:3000 in production: every share link, QR code
  // and LinkedIn "Credential URL" pointed at localhost. Bake it in instead.
  vite: {
    define: {
      'import.meta.env.NUXT_PUBLIC_WEBSITE_URL': JSON.stringify(websiteUrl),
    },
  },
  // Verification pages: never indexed, whatever a crawler makes of the meta tag.
  routeRules: {
    '/credentials/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
  },
  runtimeConfig: {
    public: {
      apiUrl: process.env.NUXT_PUBLIC_API_URL,
      // Read by server routes via useRuntimeConfig (server/utils/public-urls.ts);
      // NUXT_PUBLIC_WEBSITE_URL overrides it at runtime too.
      websiteUrl,
    }
  },
  imports: {
    dirs: ['stores', 'constants'],
  },
  css: [
    '~/assets/css/main.css',
  ],
  plugins: [
    '~/plugins/api.ts',
    '~/plugins/auth.ts',
    // The auth-init plugin is client-only and will be auto-imported
    '~/plugins/i18n.client.ts',
  ],
})
