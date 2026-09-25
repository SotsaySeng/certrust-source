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
            v-for="link in visibleNavLinks"
            :key="link.name"
            :to="link.href"
            class="text-text-secondary hover:text-text-primary transition-colors font-medium"
          >
            {{ t(`nav.${link.i18nKey}`) || link.name }}
          </NuxtLink>

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
          v-for="link in visibleNavLinks"
          :key="link.name"
          :to="link.href"
          class="block py-2 text-text-secondary hover:text-text-primary transition-colors"
        >
          {{ link.name }}
        </NuxtLink>
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
