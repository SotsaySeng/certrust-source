export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware if it's a server route
  if (import.meta.server) {
    return
  }

  const authStore = useAuthStore()

  // Wait for auth state to be restored before reading it.
  //
  // Awaiting init() rather than only watching isLoading: on a hard page
  // load (a bookmark, a refresh, a pasted URL) this middleware runs before
  // plugins/auth-init.client.ts has started init(), so isLoading is still
  // false and there is nothing to wait on. The store then looked logged
  // out, an issuer route bounced to /login, and /login's own guard - by
  // then initialized - bounced on to /dashboard. Net effect: refreshing
  // /design-templates or /issue kicked a signed-in issuer to the
  // dashboard, every time. init() is idempotent and shares one in-flight
  // promise, so awaiting it here is safe on every navigation.
  await authStore.init()

  // init() resolves once the profile fetch has settled, but a navigation
  // that races an in-flight login() can still land here mid-flight - keep
  // the original isLoading wait as a second guard.
  if (authStore.isLoading) {
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => authStore.isLoading,
        (loading) => {
          if (!loading) {
            unwatch()
            resolve()
          }
        },
        { immediate: true }
      )
    })
  }

  // Protected routes that require authentication
  const protectedRoutes = ['/dashboard', '/profile', '/billing', '/admin']
  const isProtectedRoute = protectedRoutes.some(route =>
    to.path === route || to.path.startsWith(`${route}/`)
  )

  // Routes that require Issuer role
  const issuerRoutes = ['/issue', '/design-templates', '/achievements']
  const isIssuerRoute = issuerRoutes.some(route =>
    to.path === route || to.path.startsWith(`${route}/`)
  )

  // If user is not authenticated and trying to access a protected route
  if (!authStore.isAuthenticated && (isProtectedRoute || isIssuerRoute)) {
    return navigateTo('/login')
  }

  // If user is not an issuer and trying to access issuer routes
  if (isIssuerRoute && !authStore.isIssuer) {
    return navigateTo('/dashboard')
  }

  // Platform revenue pages: Platform Admin role only
  if (to.path.startsWith('/admin') && !authStore.isPlatformAdmin) {
    return navigateTo('/dashboard')
  }

  // If user is authenticated and trying to access auth pages
  if (authStore.isAuthenticated && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/dashboard')
  }
})
