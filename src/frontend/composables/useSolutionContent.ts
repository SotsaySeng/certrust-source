export interface PricingLimits {
  credentials: string
  designTemplates: string
  achievements: string
}

export interface PricingTier {
  id: string
  name: string
  tagline: string
  price: string
  limits: PricingLimits
  features: string[]
  ctaLabel: string
  ctaHref: string
  highlighted?: boolean
  note?: string
}

export interface PricingContent {
  header: string
  subheader: string
  limitLabels: PricingLimits
  mostPopularLabel: string
  tiers: PricingTier[]
}

const DEFAULT_SOLUTION_CONTENT: PricingContent = {
  header: '',
  subheader: '',
  limitLabels: { credentials: '', designTemplates: '', achievements: '' },
  mostPopularLabel: '',
  tiers: [],
}

/**
 * The /solution page's pricing plans, fetched from the admin-editable
 * solution-page singleType and reshaped into the PricingContent/PricingTier
 * shape HomePricing.vue already expects, so that component needs no
 * changes. useAsyncData fetches on the server for SSR, hydrates on the
 * client; a failed/unreachable backend falls back to
 * DEFAULT_SOLUTION_CONTENT (empty tiers) rather than crashing the page.
 */
export default async function useSolutionContent(): Promise<PricingContent> {
  const config = useRuntimeConfig()
  const apiUrl = config.public.apiUrl || ''

  const { data } = await useAsyncData<PricingContent>('solution-page', async () => {
    try {
      const result = await $fetch<{ data: any }>(`${apiUrl}/api/solution-page`, {
        query: { populate: '*' },
      })
      const raw = result?.data
      if (!raw) {
        return DEFAULT_SOLUTION_CONTENT
      }

      const coreFeatures = [raw.coreFeature1, raw.coreFeature2, raw.coreFeature3].filter(Boolean)

      const tiers: PricingTier[] = (raw.tiers ?? []).map((tier: any) => ({
        id: tier.tierId,
        name: tier.name,
        tagline: tier.tagline ?? '',
        price: tier.price,
        limits: {
          credentials: tier.credentialsLimit,
          designTemplates: tier.designTemplatesLimit,
          achievements: tier.achievementsLimit,
        },
        features: tier.extraFeature ? [...coreFeatures, tier.extraFeature] : coreFeatures,
        ctaLabel: tier.ctaLabel,
        ctaHref: tier.ctaHref,
        highlighted: Boolean(tier.highlighted),
        note: tier.note ?? undefined,
      }))

      return {
        header: raw.header ?? '',
        subheader: raw.subheader ?? '',
        mostPopularLabel: raw.mostPopularLabel ?? '',
        limitLabels: {
          credentials: raw.limitLabelCredentials ?? '',
          designTemplates: raw.limitLabelDesignTemplates ?? '',
          achievements: raw.limitLabelAchievements ?? '',
        },
        tiers,
      }
    }
    catch (err) {
      console.error('[useSolutionContent] Fetch failed:', err)
      return DEFAULT_SOLUTION_CONTENT
    }
  }, {
    default: () => DEFAULT_SOLUTION_CONTENT,
  })

  return data.value ?? DEFAULT_SOLUTION_CONTENT
}
