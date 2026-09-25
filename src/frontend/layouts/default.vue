<template>
  <div class="min-h-screen flex flex-col bg-gradient-to-b from-white to-[#D9F2DE]/20">
    <!-- Navigation -->
    <Header />

    <!-- Main Content -->
    <main class="pt-16 flex-grow flex flex-col mb-32">
      <slot />
    </main>

    <!-- Footer -->
    <Footer />

    <!-- Analytics consent banner (renders nothing without a GA4 ID) -->
    <CookieConsent />
  </div>
</template>

<style>
:root {
  --text-primary: #1B2420;
  --text-secondary: #4B5A50;
}

body {
  font-family: 'Space Grotesk', sans-serif;
  color: var(--text-primary);
}

.page-enter-active,
.page-leave-active {
  transition: all 0.2s ease;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
