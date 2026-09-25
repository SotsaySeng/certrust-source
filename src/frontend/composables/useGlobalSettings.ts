export interface LinkItem {
  label: string
  url: string
}

export interface GlobalSettings {
  logo: { src: string, alt: string }
  tagline: string
  description: string
  socialGithubUrl: string | null
  socialDiscordUrl: string | null
  socialTwitterUrl: string | null
  contactEmail: string | null
  contactWebsiteLabel: string | null
  contactWebsiteUrl: string | null
  copyrightText: string
  quickLinks: LinkItem[]
  resourceLinks: LinkItem[]
  legalLinks: LinkItem[]
}

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  logo: { src: '/certrust-logo-text.svg', alt: 'Certrust Logo' },
  tagline: '',
  description: '',
  socialGithubUrl: null,
  socialDiscordUrl: null,
  socialTwitterUrl: null,
  contactEmail: null,
  contactWebsiteLabel: null,
  contactWebsiteUrl: null,
  copyrightText: 'Certrust © {year}. All rights reserved.',
  quickLinks: [],
  resourceLinks: [],
  legalLinks: [],
}

function resolveMediaUrl(apiUrl: string, url: string): string {
  return url.startsWith('http') ? url : `${apiUrl}${url}`
}

/**
 * Site-wide chrome (header/footer logo, footer content, social/contact
 * links) fetched from the admin-editable global-settings singleType.
 * Consumed by Header.vue/Footer.vue, which are shared layout components
 * rendered on every route (not pages) - deliberately NOT awaited here like
 * useHomeContent/useSolutionContent are from their pages, since a
 * top-level await in a plain component's <script setup> turns it into an
 * async component that needs a <Suspense> ancestor, and Header/Footer sit
 * directly in layouts/default.vue with no guarantee one wraps them. Nuxt's
 * useAsyncData still blocks SSR completion until this resolves regardless
 * of whether the call site awaits it, so this stays correct for SSR/SEO;
 * the returned `data` ref is simply consumed reactively (auto-unwrapped in
 * the template) instead.
 */
export default function useGlobalSettings() {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl || ''

  const { data } = useAsyncData<GlobalSettings>('global-settings', async () => {
    try {
      const result = await $fetch<{ data: any }>(`${apiUrl}/api/global-settings`, {
        query: { populate: '*' },
      })
      const raw = result?.data
      if (!raw) {
        return DEFAULT_GLOBAL_SETTINGS
      }

      return {
        logo: raw.logo?.url
          ? { src: resolveMediaUrl(apiUrl, raw.logo.url), alt: raw.logo.alternativeText || 'Certrust Logo' }
          : DEFAULT_GLOBAL_SETTINGS.logo,
        tagline: raw.tagline ?? '',
        description: raw.description ?? '',
        socialGithubUrl: raw.socialGithubUrl || null,
        socialDiscordUrl: raw.socialDiscordUrl || null,
        socialTwitterUrl: raw.socialTwitterUrl || null,
        contactEmail: raw.contactEmail || null,
        contactWebsiteLabel: raw.contactWebsiteLabel || null,
        contactWebsiteUrl: raw.contactWebsiteUrl || null,
        copyrightText: raw.copyrightText || DEFAULT_GLOBAL_SETTINGS.copyrightText,
        quickLinks: raw.quickLinks ?? [],
        resourceLinks: raw.resourceLinks ?? [],
        legalLinks: raw.legalLinks ?? [],
      }
    }
    catch (err) {
      console.error('[useGlobalSettings] Fetch failed:', err)
      return DEFAULT_GLOBAL_SETTINGS
    }
  }, {
    default: () => DEFAULT_GLOBAL_SETTINGS,
  })

  return { globalSettings: data }
}
