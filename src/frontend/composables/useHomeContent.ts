export interface Section {
  features: string[]
  header: string
  id: 'certificate' | 'recipient' | 'export'
  title: string
  illustrationUrl?: string
  content?: {
    title: string
    features: string[]
  }
}

export interface CardFeature {
  description: string
  icon: string
  title: string
}

export interface AudienceSegment {
  icon: string
  title: string
  description: string
}

export interface AudienceContent {
  header: string
  subheader: string
  segments: AudienceSegment[]
}

interface HomeContent {
  heroTitleBefore: string
  heroHighlight: string
  heroTitleAfter: string
  heroSubtitle: string
  heroButtonLabel: string
  featuresHeader: string
  featuresSubheader: string
  features: CardFeature[]
  howItWorksHeader: string
  howItWorksSubheader: string
  sections: Section[]
  audience: AudienceContent
  closingHeader: string
  closingSubheader: string
  closingButtonLabel: string
}

const DEFAULT_HOME_CONTENT: HomeContent = {
  heroTitleBefore: '',
  heroHighlight: '',
  heroTitleAfter: '',
  heroSubtitle: '',
  heroButtonLabel: '',
  featuresHeader: '',
  featuresSubheader: '',
  features: [],
  howItWorksHeader: '',
  howItWorksSubheader: '',
  sections: [],
  audience: { header: '', subheader: '', segments: [] },
  closingHeader: '',
  closingSubheader: '',
  closingButtonLabel: '',
}

function resolveMediaUrl(apiUrl: string, url?: string | null): string | undefined {
  if (!url) {
    return undefined
  }
  return url.startsWith('http') ? url : `${apiUrl}${url}`
}

function buildSection(raw: any, id: Section['id'], apiUrl: string): Section {
  const section: Section = {
    id,
    title: raw?.title ?? '',
    header: raw?.header ?? '',
    features: [raw?.feature1, raw?.feature2, raw?.feature3, raw?.feature4].filter(Boolean),
    illustrationUrl: resolveMediaUrl(apiUrl, raw?.illustrationImage?.url),
  }

  if (raw?.badgeCalloutTitle) {
    section.content = {
      title: raw.badgeCalloutTitle,
      features: [raw.badgeCalloutFeature1, raw.badgeCalloutFeature2, raw.badgeCalloutFeature3].filter(Boolean),
    }
  }

  return section
}

/**
 * Homepage content (hero, feature grid, how-it-works walkthrough, audience
 * segments, closing CTA), fetched from the admin-editable homepage
 * singleType and reshaped into the same Section/CardFeature/AudienceContent
 * shapes this composable always returned, so HomeSection.vue,
 * HomeCardFeature.vue, and HomeAudienceGrid.vue need no changes.
 *
 * illustrationImage lives one level inside each how-it-works-section
 * component, which Strapi 5's populate=* wildcard does not recurse into
 * (it only expands root-level fields) - the explicit nested populate query
 * below is required to actually get it back; populate=* alone silently
 * omits it.
 *
 * useAsyncData fetches on the server for SSR, hydrates on the client; a
 * failed/unreachable backend falls back to DEFAULT_HOME_CONTENT (empty
 * sections/features) rather than crashing the page.
 */
export default async function useHomeContent(): Promise<HomeContent> {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl || ''

  const { data } = await useAsyncData<HomeContent>('homepage', async () => {
    try {
      const query = new URLSearchParams({
        'populate[certificateSection][populate]': 'illustrationImage',
        'populate[recipientSection][populate]': 'illustrationImage',
        'populate[exportSection][populate]': 'illustrationImage',
        'populate[features]': 'true',
        'populate[audienceSegments]': 'true',
      }).toString()

      const result = await $fetch<{ data: any }>(`${apiUrl}/api/homepage?${query}`)
      const raw = result?.data
      if (!raw) {
        return DEFAULT_HOME_CONTENT
      }

      const features: CardFeature[] = (raw.features ?? []).map((f: any) => ({
        title: f.title,
        description: f.description,
        icon: f.icon,
      }))

      const audience: AudienceContent = {
        header: raw.audienceHeader ?? '',
        subheader: raw.audienceSubheader ?? '',
        segments: (raw.audienceSegments ?? []).map((s: any) => ({
          icon: s.icon,
          title: s.title,
          description: s.description,
        })),
      }

      return {
        heroTitleBefore: raw.heroTitleBefore ?? '',
        heroHighlight: raw.heroHighlight ?? '',
        heroTitleAfter: raw.heroTitleAfter ?? '',
        heroSubtitle: raw.heroSubtitle ?? '',
        heroButtonLabel: raw.heroButtonLabel ?? '',
        featuresHeader: raw.featuresHeader ?? '',
        featuresSubheader: raw.featuresSubheader ?? '',
        features,
        howItWorksHeader: raw.howItWorksHeader ?? '',
        howItWorksSubheader: raw.howItWorksSubheader ?? '',
        sections: [
          buildSection(raw.certificateSection, 'certificate', apiUrl),
          buildSection(raw.recipientSection, 'recipient', apiUrl),
          buildSection(raw.exportSection, 'export', apiUrl),
        ],
        audience,
        closingHeader: raw.closingHeader ?? '',
        closingSubheader: raw.closingSubheader ?? '',
        closingButtonLabel: raw.closingButtonLabel ?? '',
      }
    }
    catch (err) {
      console.error('[useHomeContent] Fetch failed:', err)
      return DEFAULT_HOME_CONTENT
    }
  }, {
    default: () => DEFAULT_HOME_CONTENT,
  })

  return data.value ?? DEFAULT_HOME_CONTENT
}
