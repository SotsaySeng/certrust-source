<script setup lang="ts">
const {
  sections,
  features,
  audience,
  heroTitleBefore,
  heroHighlight,
  heroTitleAfter,
  heroSubtitle,
  heroButtonLabel,
  featuresHeader,
  featuresSubheader,
  howItWorksHeader,
  howItWorksSubheader,
  closingHeader,
  closingSubheader,
  closingButtonLabel,
} = await useHomeContent()
const revealVariants = useRevealMotion()
const ctaHoverLift = useHoverLift(3, 1.03)

// The hero's entrance uses plain CSS animation (.hero-reveal, defined in
// assets/css/main.css) instead of v-motion's JS-scheduled delayed
// transitions - with 5 simultaneous same-tick 'enter'/'visibleOnce'
// bindings at spread-out delays, those proved to race a client-side
// remount that fires ~450ms after initial mount (confirmed via an
// onMounted probe), permanently stranding any element whose delayed
// start hadn't fired yet at their pre-transition opacity:0 state. Native
// CSS animations aren't scheduled by JS and aren't susceptible to that
// race. Below-the-fold sections further down this file keep using
// v-motion's 'visibleOnce' (scroll-triggered, so naturally clear of the
// same near-mount-time race) - only the always-immediately-visible hero
// needed this workaround.
const featuresHeaderMotion = revealVariants(0)
const featureMotions = features.map((_, index) => revealVariants(index * 80))
const howItWorksHeaderMotion = revealVariants(0)
const sectionHoverLift = useHoverLift(4, 1.005)
const sectionMotions = sections.map((_, index) => ({ ...revealVariants(index * 100), ...sectionHoverLift }))
const closingMotion = revealVariants(0)
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
    <!-- Hero -->
    <div class="relative grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center mt-16 mb-28 md:mt-24 md:mb-36">
      <!-- A single precise divider, not a gradient blob - the grid does the work -->
      <div class="hidden lg:block absolute left-[54%] top-4 bottom-4 w-px bg-text-primary/10" aria-hidden="true" />

      <div class="text-center lg:text-left">
        <div class="hero-reveal inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full border border-text-primary/15" style="animation-delay: 0ms;">
          <span class="relative flex size-1.5">
            <span class="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 animate-ping" />
            <span class="relative inline-flex rounded-full size-1.5 bg-primary" />
          </span>
          <span class="font-mono text-[11px] font-medium tracking-widest text-text-secondary uppercase">
            Open Badges 3.0 · W3C Verifiable Credentials
          </span>
        </div>
        <h1 class="hero-reveal text-5xl md:text-6xl xl:text-7xl font-display font-bold mb-7 leading-[0.95] tracking-tight text-balance" style="animation-delay: 120ms;">
          {{ heroTitleBefore }}<span class="text-primary">{{ heroHighlight }}</span>{{ heroTitleAfter }}
        </h1>
        <p class="hero-reveal text-text-secondary text-xl md:text-2xl mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed" style="animation-delay: 240ms;">
          {{ heroSubtitle }}
        </p>
        <NuxtLink
          to="/register"
          class="hero-reveal group inline-flex items-center px-8 py-4 rounded-full bg-text-primary text-white transition-colors hover:bg-primary hover:text-text-primary text-lg font-medium"
          style="animation-delay: 360ms;"
        >
          {{ heroButtonLabel }}
          <span class="i-heroicons-arrow-right ml-2 w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
        </NuxtLink>
      </div>

      <div class="hero-reveal hidden lg:block" style="animation-delay: 200ms;">
        <HomeHeroCredentialCard />
      </div>
    </div>

    <!-- Who it's for -->
    <HomeAudienceGrid :audience="audience" />

    <!-- What it does -->
    <section class="mb-24 md:mb-32">
      <div v-motion="featuresHeaderMotion" class="max-w-2xl mb-12">
        <p class="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-3">
          02 — What it does
        </p>
        <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-balance">
          {{ featuresHeader }}
        </h2>
        <p class="text-text-secondary text-lg mt-4">
          {{ featuresSubheader }}
        </p>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-text-primary/10 border border-text-primary/10 rounded-2xl overflow-hidden">
        <HomeCardFeature
          v-for="(feature, index) in features"
          :key="feature.title"
          v-motion="featureMotions[index]"
          :feature="feature"
        />
      </div>
    </section>

    <!-- How it works -->
    <section class="mb-24 md:mb-32">
      <div v-motion="howItWorksHeaderMotion" class="max-w-2xl mb-12">
        <p class="font-mono text-xs uppercase tracking-[0.2em] text-primary mb-3">
          03 — How it works
        </p>
        <h2 class="text-3xl md:text-4xl font-bold tracking-tight text-balance">
          {{ howItWorksHeader }}
        </h2>
        <p class="text-text-secondary text-lg mt-4">
          {{ howItWorksSubheader }}
        </p>
      </div>
      <div class="space-y-10">
        <HomeSection
          v-for="(section, sectionIndex) in sections"
          :key="section.id"
          v-motion="sectionMotions[sectionIndex]"
          :section="section"
          :step="sectionIndex + 1"
          :reverse="sectionIndex % 2 === 0"
        />
      </div>
    </section>

    <!-- Closing CTA -->
    <section v-motion="closingMotion" class="relative mb-24 text-center rounded-2xl bg-text-primary px-6 py-16 md:py-24 overflow-hidden">
      <div class="absolute top-0 inset-x-0 h-px bg-primary/60" aria-hidden="true" />
      <h2 class="relative text-3xl md:text-5xl font-bold mb-5 tracking-tight text-white text-balance">
        {{ closingHeader }}
      </h2>
      <p class="relative text-white/60 text-lg mb-10 max-w-xl mx-auto">
        {{ closingSubheader }}
      </p>
      <NuxtLink
        v-motion="ctaHoverLift"
        to="/register"
        class="relative inline-flex items-center px-8 py-4 rounded-full bg-primary text-black transition-colors hover:bg-primary/90 text-lg font-medium"
      >
        {{ closingButtonLabel }}
        <span class="i-heroicons-arrow-right ml-2 w-5 h-5" />
      </NuxtLink>
    </section>
  </div>
</template>
