<script setup lang="ts">
const LEGAL_LINKS = LEGAL
const runtimeConfig = useRuntimeConfig()
const analyticsConfigured = computed(() => !!((runtimeConfig.public as any).gtag?.id || (runtimeConfig.public as any).gtag?.tags?.[0]?.id))
const cookieConsentOpen = useState('cookie-consent-open', () => false)

const { globalSettings } = useGlobalSettings()
</script>

<template>
  <footer class="w-full bg-gradient-to-b from-white to-[#D9F2DE]/20 pt-16 pb-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
        <!-- Logo Column -->
        <div class="md:col-span-2">
          <div class="flex items-center gap-3">
            <img :src="globalSettings.logo.src" :alt="globalSettings.logo.alt" class="h-14 w-auto">
          </div>
          <p class="mt-4 text-text-secondary max-w-sm">
            {{ globalSettings.description }}
          </p>
          <div class="flex space-x-4 mt-6">
            <a
              v-if="globalSettings.socialGithubUrl"
              :href="globalSettings.socialGithubUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-[#28A745]  text-white hover:opacity-80 transition-opacity"
              title="GitHub"
            >
              <div class="i-lucide-github w-4 h-4 color-[#000]" />
            </a>
            <a
              v-if="globalSettings.socialDiscordUrl"
              :href="globalSettings.socialDiscordUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-[#28A745] text-white hover:opacity-80 transition-opacity"
              title="Discord"
            >
              <div class="i-lucide-message-circle w-4 h-4 color-[#000]" />
            </a>
            <a
              v-if="globalSettings.socialTwitterUrl"
              :href="globalSettings.socialTwitterUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="w-8 h-8 flex items-center justify-center rounded-full bg-[#28A745] text-white hover:opacity-80 transition-opacity"
              title="Twitter"
            >
              <div class="i-lucide-twitter w-4 h-4 color-[#000]" />
            </a>
          </div>
        </div>

        <!-- Quick Links -->
        <div class="space-y-4">
          <h3 class="font-bold text-lg">
            Quick Links
          </h3>
          <ul class="space-y-2">
            <li v-for="link in globalSettings.quickLinks" :key="link.url">
              <FooterLink :label="link.label" :url="link.url" />
            </li>
          </ul>
        </div>

        <!-- Resources -->
        <div class="space-y-4">
          <h3 class="font-bold text-lg">
            Resources
          </h3>
          <ul class="space-y-2">
            <li v-for="link in globalSettings.resourceLinks" :key="link.url">
              <FooterLink :label="link.label" :url="link.url" />
            </li>
          </ul>
        </div>

        <!-- Contact -->
        <div class="space-y-4">
          <h3 class="font-bold text-lg">
            Contact
          </h3>
          <ul class="space-y-2">
            <li v-if="globalSettings.contactEmail">
              <a
                :href="`mailto:${globalSettings.contactEmail}`"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ globalSettings.contactEmail }}
              </a>
            </li>
            <li v-if="globalSettings.contactWebsiteUrl">
              <a
                :href="globalSettings.contactWebsiteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="text-text-secondary hover:text-text-primary transition-colors"
              >
                {{ globalSettings.contactWebsiteLabel || globalSettings.contactWebsiteUrl }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <!-- Copyright -->
      <div class="text-center text-text-secondary pt-8 border-t border-gray-200">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4">
          <p>{{ globalSettings.copyrightText.replace('{year}', String(new Date().getFullYear())) }}</p>
          <div class="flex space-x-6">
            <FooterLink
              v-for="link in globalSettings.legalLinks"
              :key="link.url"
              :label="link.label"
              :url="link.url"
              small
            />
          </div>
        </div>
        <!-- Not CMS-driven on purpose: the DPA, sub-processor list and report
             channel are promised by the Terms and Privacy Policy, and the
             source-code link is required by the AGPL-3.0 (section 13). -->
        <div class="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm md:justify-end">
          <NuxtLink to="/data-processing-agreement" class="hover:text-text-primary">
            Data Processing Agreement
          </NuxtLink>
          <NuxtLink to="/subprocessors" class="hover:text-text-primary">
            Sub-processors
          </NuxtLink>
          <NuxtLink to="/report" class="hover:text-text-primary">
            Report a problem
          </NuxtLink>
          <a :href="LEGAL_LINKS.sourceCodeUrl" target="_blank" rel="noopener" class="hover:text-text-primary">Source code (AGPL-3.0)</a>
          <button v-if="analyticsConfigured" type="button" class="hover:text-text-primary" @click="cookieConsentOpen = true">
            Cookie settings
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>
