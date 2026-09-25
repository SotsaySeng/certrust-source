<script setup lang="ts">
const { t } = useI18n()
const { globalSettings } = useGlobalSettings()
const router = useRouter()
const authStore = useAuthStore()
const userMenuRef = ref<HTMLElement | null>(null)
const showUserMenu = ref(false)
const WINDOW_VERTICAL_SCROLL_THRESHOLD = 20
const { y } = useWindowScroll()

const hasWindowScrolled = computed(() => {
  return y.value > WINDOW_VERTICAL_SCROLL_THRESHOLD
})

const isMobileMenuOpen = shallowRef(false)
const mobileMenuRef = useTemplateRef('mobile-menu')

onClickOutside(mobileMenuRef, () => isMobileMenuOpen.value = false)

// computed() directly against the live store (not copied into a
// separate ref inside a watch callback) so this actually updates right
// after a client-side login/logout - the store's own isAuthenticated/
// isIssuer are themselves computed refs (see stores/auth.ts), so this
// stays reactive end-to-end.
const isAuthenticated = computed(() => authStore.isAuthenticated)
const isIssuer = computed(() => authStore.isIssuer)
const isPlatformAdmin = computed(() => authStore.isPlatformAdmin)
const userName = computed(() => {
  const user = authStore.user
  if (!user) {
    return ''
  }
  return user.username || (user.email ? user.email.split('@')[0] : '')
})

const visibleNavLinks = computed(() => HEADER_NAV_LINKS.filter((link) => {
  if (link.requiresIssuer) {
    return isAuthenticated.value && isIssuer.value
  }
  if (link.requiresAuth) {
    return isAuthenticated.value
  }
  return true
}))

// Issuers get their working pages (dashboard, issue, templates, events...)
// in one "Manage" menu instead of four more links in the bar. Everyone
// else keeps the plain links (a recipient only has Dashboard).
const route = useRoute()
const manageMenuRef = useTemplateRef('manage-menu')
const showManageMenu = ref(false)
onClickOutside(manageMenuRef, () => showManageMenu.value = false)
watch(() => route.fullPath, () => {
  showManageMenu.value = false
  isMobileMenuOpen.value = false
})

const barNavLinks = computed(() => isIssuer.value
  ? visibleNavLinks.value.filter(link => !link.requiresAuth)
  : visibleNavLinks.value)
const isManageActive = computed(() => MANAGE_MENU_LINKS.some(link => route.path === link.href || route.path.startsWith(`${link.href}/`)))

function handleLogout() {
  authStore.logout()
  router.push('/')
  showUserMenu.value = false
}
</script>

<template>
  <nav
    class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
    :class="{ 'bg-white/80 backdrop-blur-lg shadow-sm': hasWindowScrolled }"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <NuxtLink to="/" class="flex items-center gap-2">
          <img
            :src="globalSettings.logo.src"
            :alt="globalSettings.logo.alt"
            class="h-10 w-auto"
          >
        </NuxtLink>

        <!-- Desktop Navigation -->
        <div class="hidden lg:flex items-center gap-6">
          <NuxtLink
            v-for="link in barNavLinks"
            :key="link.name"
            :to="link.href"
            class="text-text-secondary hover:text-text-primary transition-colors font-medium"
          >
            {{ t(`nav.${link.i18nKey}`) || link.name }}
          </NuxtLink>

          <!-- Issuer "Manage" menu -->
          <div v-if="isAuthenticated && isIssuer" ref="manage-menu" class="relative">
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors"
              :class="isManageActive || showManageMenu ? 'bg-[#28A745]/10 text-text-primary' : 'text-text-secondary hover:text-text-primary'"
              :aria-expanded="showManageMenu"
              aria-controls="manage-menu-panel"
              data-testid="manage-menu-button"
              @click="showManageMenu = !showManageMenu"
            >
              <span class="i-heroicons-squares-2x2 w-5 h-5" aria-hidden="true" />
              {{ t('nav.manage') }}
              <span class="i-heroicons-chevron-down w-4 h-4 transition-transform" :class="{ 'rotate-180': showManageMenu }" aria-hidden="true" />
            </button>
            <div
              v-if="showManageMenu"
              id="manage-menu-panel"
              class="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg ring-1 ring-black/5 py-2 z-50"
            >
              <NuxtLink
                v-for="link in MANAGE_MENU_LINKS"
                :key="link.href"
                :to="link.href"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50"
                :class="route.path === link.href ? 'text-[#1e7e34] font-medium' : 'text-text-secondary hover:text-text-primary'"
                @click="showManageMenu = false"
              >
                <span :class="link.icon" class="w-5 h-5 shrink-0" aria-hidden="true" />
                {{ t(link.i18nKey) }}
              </NuxtLink>
            </div>
          </div>

          <!-- Auth Buttons -->
          <div class="flex items-center gap-4 ml-6">
            <LanguageSwitcher />
            <template v-if="isAuthenticated && userName">
              <div class="relative">
                <button
                  ref="userMenuRef"
                  class="flex items-center gap-2 text-text-primary hover:text-text-secondary transition-colors"
                  @click="showUserMenu = !showUserMenu"
                >
                  <span class="font-medium">{{ userName }}</span>
                  <div
                    class="w-5 h-5 i-heroicons-chevron-down"
                    :class="{ 'rotate-180': showUserMenu }"
                  />
                </button>

                <!-- User Menu Dropdown -->
                <div
                  v-if="showUserMenu"
                  class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50"
                >
                  <NuxtLink
                    to="/profile"
                    class="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-50"
                    @click="showUserMenu = false"
                  >
                    {{ t('nav.profile') }}
                  </NuxtLink>
                  <NuxtLink
                    v-if="isIssuer"
                    to="/billing"
                    class="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-50"
                    @click="showUserMenu = false"
                  >
                    {{ t('nav.billing') }}
                  </NuxtLink>
                  <NuxtLink
                    v-if="isPlatformAdmin"
                    to="/admin/revenue"
                    class="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-50"
                    @click="showUserMenu = false"
                  >
                    {{ t('nav.revenue') }}
                  </NuxtLink>
                  <NuxtLink
                    v-if="isPlatformAdmin"
                    to="/admin/trust"
                    class="block px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-50"
                    @click="showUserMenu = false"
                  >
                    Trust &amp; safety
                  </NuxtLink>
                  <button
                    class="block w-full text-left px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-gray-50"
                    @click="handleLogout"
                  >
                    {{ t('nav.logout') }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <NuxtLink
                to="/login"
                class="font-medium text-text-primary hover:text-text-secondary transition-colors"
              >
                {{ t('nav.login') }}
              </NuxtLink>
              <NuxtLink
                to="/register"
                class="px-4 py-2 bg-[#28A745] rounded-full font-medium hover:bg-[#28A745]/90 transition-colors text-text-primary"
              >
                {{ t('nav.getStarted') }}
              </NuxtLink>
            </template>
          </div>
        </div>

        <!-- Mobile Menu Button -->
        <button
          aria-label="Toggle mobile menu"
          class="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          @click="isMobileMenuOpen = !isMobileMenuOpen"
        >
          <div v-if="!isMobileMenuOpen" class="w-6 h-6 i-heroicons-bars-3" />
          <div v-else class="w-6 h-6 i-heroicons-x-mark" />
        </button>
      </div>
    </div>

    <!-- Mobile Menu -->
    <div v-if="isMobileMenuOpen" ref="mobile-menu" class="lg:hidden bg-white border-t">
      <div class="px-4 py-2 space-y-1">
        <NuxtLink
          v-for="link in barNavLinks"
          :key="link.name"
          :to="link.href"
          class="block py-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {{ t(`nav.${link.i18nKey}`) || link.name }}
        </NuxtLink>
        <div v-if="isAuthenticated && isIssuer" class="pt-3 mt-2 border-t">
          <p class="pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
            {{ t('nav.manage') }}
          </p>
          <NuxtLink
            v-for="link in MANAGE_MENU_LINKS"
            :key="link.href"
            :to="link.href"
            class="flex items-center gap-3 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            <span :class="link.icon" class="w-5 h-5 shrink-0" aria-hidden="true" />
            {{ t(link.i18nKey) }}
          </NuxtLink>
        </div>
        <div class="pt-4 space-y-2">
          <template v-if="isAuthenticated && userName">
            <NuxtLink
              to="/profile"
              class="block w-full py-2 text-text-primary hover:text-text-secondary transition-colors"
            >
              {{ t('nav.profile') }}
            </NuxtLink>
            <NuxtLink
              v-if="isIssuer"
              to="/billing"
              class="block w-full py-2 text-text-primary hover:text-text-secondary transition-colors"
            >
              {{ t('nav.billing') }}
            </NuxtLink>
            <NuxtLink
              v-if="isPlatformAdmin"
              to="/admin/revenue"
              class="block w-full py-2 text-text-primary hover:text-text-secondary transition-colors"
            >
              {{ t('nav.revenue') }}
            </NuxtLink>
            <NuxtLink
              v-if="isPlatformAdmin"
              to="/admin/trust"
              class="block w-full py-2 text-text-primary hover:text-text-secondary transition-colors"
            >
              Trust &amp; safety
            </NuxtLink>
            <button
              class="block w-full py-2 text-text-primary hover:text-text-secondary transition-colors"
              @click="handleLogout"
            >
              {{ t('nav.logout') }}
            </button>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
              class="block w-full py-2 text-center text-text-primary hover:text-text-secondary transition-colors"
            >
              {{ t('nav.login') }}
            </NuxtLink>
            <NuxtLink
              to="/register"
              class="block w-full py-2 text-center bg-[#28A745] text-white rounded-full hover:bg-[#28A745]/90 transition-colors"
            >
              {{ t('nav.getStarted') }}
            </NuxtLink>
          </template>
        </div>
      </div>
    </div>
  </nav>
</template>
